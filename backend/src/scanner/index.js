const { DescribeInstancesCommand } = require('@aws-sdk/client-ec2');
const { ListFunctionsCommand } = require('@aws-sdk/client-lambda');
const { ListBucketsCommand } = require('@aws-sdk/client-s3');
const { ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const { DescribeDBInstancesCommand } = require('@aws-sdk/client-rds');
const { GetRestApisCommand } = require('@aws-sdk/client-api-gateway');
const { DescribeLoadBalancersCommand } = require('@aws-sdk/client-elastic-load-balancing-v2');
const { ListDistributionsCommand } = require('@aws-sdk/client-cloudfront');

const { PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { GetResourcesCommand } = require('@aws-sdk/client-resource-groups-tagging-api');
const { putItem } = require('../shared/db');
const {
    ec2Client,
    lambdaClient,
    s3Client,
    dynamoDbClient,
    rdsClient,
    apiGatewayClient,
    elbClient,
    cloudfrontClient,
    taggingClient
} = require('../shared/aws');

// In local mode, you would provide the table name via ENV var
const TABLE_NAME = process.env.RESOURCES_TABLE || 'skymind-resources';

exports.handler = async (event, context) => {
    console.log('Skymind Scanner starting...');
    const resources = [];
    const connections = [];
    const skymindResourceARNs = new Set();
    const skymindResourceNames = new Set();

    try {
        // 0. Identify SkyMind resources via tags
        // Find everything tagged with aws:cloudformation:stack-name containing "SkyMind"
        // Also allow specific custom tags if users want to mark things for SkyMind explicitly
        try {
            let tagPaginationToken = undefined;
            do {
                const tagRes = await taggingClient.send(new GetResourcesCommand({
                    TagFilters: [
                        { Key: 'aws:cloudformation:stack-name', Values: [] }
                    ],
                    PaginationToken: tagPaginationToken
                }));
                tagRes.ResourceTagMappingList?.forEach(mapping => {
                    const stackNameTag = mapping.Tags.find(t => t.Key === 'aws:cloudformation:stack-name');
                    if (stackNameTag && stackNameTag.Value.includes('SkyMind')) {
                        skymindResourceARNs.add(mapping.ResourceARN);
                        // Extract name from ARN if possible (crude fallback for matching)
                        const parts = mapping.ResourceARN.split(':');
                        const lastPart = parts[parts.length - 1];
                        if (lastPart.includes('/')) {
                            skymindResourceNames.add(lastPart.split('/').pop());
                        } else {
                            skymindResourceNames.add(lastPart);
                        }
                    }
                });
                tagPaginationToken = tagRes.PaginationToken;
            } while (tagPaginationToken);
            console.log(`Identified ${skymindResourceARNs.size} SkyMind resources via tagging API.`);
        } catch (e) {
            console.error("Tag scanning error", e);
        }

        const isSkyMind = (arn, name) => {
            if (arn && skymindResourceARNs.has(arn)) return true;
            if (name && skymindResourceNames.has(name)) return true;
            // Best effort CDK ID matching fallback just in case tagging API drops something
            const CDK_CONSTRUCT_IDS = ['resourcestable', 'metricstable', 'alertstable', 'skyminddatalake', 'scannerfunction', 'metricsfunction', 'analyzerfunction', 'healerfunction', 'costfunction', 'chatfunction', 'alertsfunction', 'metricsreaderfunction', 'skymindapi', 'skymind dashboard api', 'scannerschedule', 'metricsschedule', 'analyzerschedule', 'healerschedule', 'githuboidcprovider', 'skymindgithubdeployrole', 'customS3autodeleteobjects'];
            if (name && CDK_CONSTRUCT_IDS.some(id => name.toLowerCase().includes(id.toLowerCase()))) return true;
            return false;
        };
        // 1. Scan EC2 Instances
        const ec2Res = await ec2Client.send(new DescribeInstancesCommand({}));
        ec2Res.Reservations?.forEach(reservation => {
            reservation.Instances?.forEach(instance => {
                if (instance.State?.Name === 'terminated') return;

                const nameTag = instance.Tags?.find(t => t.Key === 'Name')?.Value || instance.InstanceId;
                // EC2 ARNs are typically: arn:aws:ec2:region:account-id:instance/instance-id
                // We'll just rely on Name acting as ID here since we don't have account ID easily without STS
                resources.push({
                    id: instance.InstanceId,
                    type: 'EC2',
                    name: nameTag,
                    skymind: isSkyMind(null, nameTag),
                    status: getStatus(instance.State?.Name),
                    region: ec2Client.config.region || 'us-east-1',
                    instanceType: instance.InstanceType,
                    az: instance.Placement?.AvailabilityZone,
                    lastUpdated: new Date().toISOString()
                });
            });
        });

        // 2. Scan Lambda Functions
        const lambdaRes = await lambdaClient.send(new ListFunctionsCommand({}));
        lambdaRes.Functions?.forEach(fn => {
            resources.push({
                id: fn.FunctionName,
                type: 'Lambda',
                name: fn.FunctionName,
                skymind: isSkyMind(fn.FunctionArn, fn.FunctionName),
                status: (!fn.State || fn.State === 'Active') ?
                    (fn.Runtime?.includes('nodejs18') ? 'warning' : 'healthy') :
                    'critical',
                region: lambdaClient.config.region || 'us-east-1',
                runtime: fn.Runtime,
                memory: fn.MemorySize,
                lastUpdated: new Date().toISOString()
            });

            // Parse Environment Variables for Connections
            if (fn.Environment && fn.Environment.Variables) {
                Object.values(fn.Environment.Variables).forEach(val => {
                    // If env var value matches another resource name we will link them
                    // Since we map target IDs later, we just store the raw value for now
                    if (typeof val === 'string' && val.length > 3) {
                        connections.push({ source: fn.FunctionName, targetRaw: val });
                    }
                });
            }
        });

        // 3. Scan S3 Buckets
        try {
            const s3Res = await s3Client.send(new ListBucketsCommand({}));
            s3Res.Buckets?.forEach(bucket => {
                resources.push({
                    id: bucket.Name,
                    type: 'S3',
                    name: bucket.Name,
                    // S3 ARN: arn:aws:s3:::bucket_name
                    skymind: isSkyMind(`arn:aws:s3:::${bucket.Name}`, bucket.Name),
                    status: 'healthy',
                    region: s3Client.config.region || 'us-east-1',
                    lastUpdated: new Date().toISOString()
                });
            });
        } catch (e) { console.error("S3 scan error", e); }

        // 4. Scan DynamoDB Tables
        try {
            const ddbRes = await dynamoDbClient.send(new ListTablesCommand({}));
            ddbRes.TableNames?.forEach(tableName => {
                resources.push({
                    id: tableName,
                    type: 'DynamoDB',
                    name: tableName,
                    skymind: isSkyMind(null, tableName), // Hard to guess ARN exactly without account ID
                    status: 'healthy',
                    region: dynamoDbClient.config.region || 'us-east-1',
                    lastUpdated: new Date().toISOString()
                });
            });
        } catch (e) { console.error("DynamoDB scan error", e); }

        // 5. Scan RDS Instances
        try {
            const rdsRes = await rdsClient.send(new DescribeDBInstancesCommand({}));
            rdsRes.DBInstances?.forEach(db => {
                resources.push({
                    id: db.DBInstanceIdentifier,
                    type: 'RDS',
                    name: db.DBInstanceIdentifier,
                    skymind: isSkyMind(db.DBInstanceArn, db.DBInstanceIdentifier),
                    status: db.DBInstanceStatus === 'available' ? 'healthy' : 'warning',
                    region: rdsClient.config.region || 'us-east-1',
                    lastUpdated: new Date().toISOString()
                });
            });
        } catch (e) { console.error("RDS scan error", e); }

        // 6. Scan API Gateways
        try {
            const apiRes = await apiGatewayClient.send(new GetRestApisCommand({}));
            apiRes.items?.forEach(api => {
                resources.push({
                    id: api.id,
                    type: 'APIGateway',
                    name: api.name,
                    skymind: isSkyMind(null, api.name),
                    status: 'healthy',
                    region: apiGatewayClient.config.region || 'us-east-1',
                    lastUpdated: new Date().toISOString()
                });
            });
        } catch (e) { console.error("APIGW scan error", e); }

        // 7. Scan ELBs
        try {
            const elbRes = await elbClient.send(new DescribeLoadBalancersCommand({}));
            elbRes.LoadBalancers?.forEach(elb => {
                resources.push({
                    id: elb.LoadBalancerArn,
                    type: 'ELB',
                    name: elb.LoadBalancerName,
                    skymind: isSkyMind(elb.LoadBalancerArn, elb.LoadBalancerName),
                    status: elb.State?.Code === 'active' ? 'healthy' : 'warning',
                    region: elbClient.config.region || 'us-east-1',
                    lastUpdated: new Date().toISOString()
                });
            });
        } catch (e) { console.error("ELB scan error", e); }

        // 8. Scan CloudFront Distributions
        try {
            const cfRes = await cloudfrontClient.send(new ListDistributionsCommand({}));
            cfRes.DistributionList?.Items?.forEach(dist => {
                resources.push({
                    id: dist.Id,
                    type: 'CloudFront',
                    name: dist.DomainName,
                    skymind: isSkyMind(dist.ARN, dist.DomainName),
                    status: dist.Status === 'Deployed' ? 'healthy' : 'warning',
                    region: 'global',
                    lastUpdated: new Date().toISOString()
                });
            });
        } catch (e) { console.error("CloudFront scan error", e); }

        // Save to DynamoDB
        let savedCount = 0;
        for (const res of resources) {
            // In production you would use batch write. For POC we do sequential puts.
            await putItem(TABLE_NAME, res);
            savedCount++;
        }

        // Resolve connections: only keep connections where targetRaw matches an actual resource ID or Name
        const validConnections = [];
        connections.forEach(c => {
            const targetRes = resources.find(r => r.id === c.targetRaw || r.name === c.targetRaw);
            if (targetRes) {
                validConnections.push({ source: c.source, target: targetRes.id });
            }
        });

        console.log(`Scanner finished successfully. Found ${savedCount} resources and ${validConnections.length} connections.`);
        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Scan complete', count: savedCount, resources, connections: validConnections })
        };

    } catch (error) {
        console.error('Error scanning resources:', error);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Scan failed', error: error.message })
        };
    }
};

function getStatus(ec2State) {
    if (ec2State === 'running') return 'healthy';
    if (ec2State === 'pending' || ec2State === 'stopping') return 'warning';
    return 'critical'; // stopped, shutting-down
}
