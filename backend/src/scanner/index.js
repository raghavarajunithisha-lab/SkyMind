const { DescribeInstancesCommand } = require('@aws-sdk/client-ec2');
const { ListFunctionsCommand } = require('@aws-sdk/client-lambda');
const { putItem, PutCommand, UpdateCommand } = require('../shared/db');
const { ec2Client, lambdaClient } = require('../shared/aws');

// In local mode, you would provide the table name via ENV var
const TABLE_NAME = process.env.RESOURCES_TABLE || 'skymind-resources';

exports.handler = async (event, context) => {
    console.log('Skymind Scanner starting...');
    const resources = [];

    try {
        // 1. Scan EC2 Instances
        const ec2Res = await ec2Client.send(new DescribeInstancesCommand({}));
        ec2Res.Reservations?.forEach(reservation => {
            reservation.Instances?.forEach(instance => {
                if (instance.State?.Name === 'terminated') return;

                const nameTag = instance.Tags?.find(t => t.Key === 'Name')?.Value || instance.InstanceId;
                resources.push({
                    id: instance.InstanceId,
                    type: 'EC2',
                    name: nameTag,
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
                status: fn.State === 'Active' ? 'healthy' : 'warning',
                region: lambdaClient.config.region || 'us-east-1',
                runtime: fn.Runtime,
                memory: fn.MemorySize,
                lastUpdated: new Date().toISOString()
            });
        });

        // Note: For a true POC, you'd add DynamoDB, S3, RDS scanners here.
        // For brevity, we stick to EC2 and Lambda in this prototype scanner.

        // 3. Save to DynamoDB
        let savedCount = 0;
        for (const res of resources) {
            // In production you would use batch write. For POC we do sequential puts.
            await putItem(TABLE_NAME, res);
            savedCount++;
        }

        console.log(`Scanner finished successfully. Found ${savedCount} resources.`);
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Scan complete', count: savedCount })
        };

    } catch (error) {
        console.error('Error scanning resources:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Scan failed', error: error.message })
        };
    }
};

function getStatus(ec2State) {
    if (ec2State === 'running') return 'healthy';
    if (ec2State === 'pending' || ec2State === 'stopping') return 'warning';
    return 'critical'; // stopped, shutting-down
}
