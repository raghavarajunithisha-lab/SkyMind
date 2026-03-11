const { EC2Client } = require('@aws-sdk/client-ec2');
const { LambdaClient } = require('@aws-sdk/client-lambda');
const { CloudWatchClient } = require('@aws-sdk/client-cloudwatch');
const { S3Client } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { RDSClient } = require('@aws-sdk/client-rds');
const { APIGatewayClient } = require('@aws-sdk/client-api-gateway');
const { ElasticLoadBalancingV2Client } = require('@aws-sdk/client-elastic-load-balancing-v2');
const { CloudFrontClient } = require('@aws-sdk/client-cloudfront');
const { CostExplorerClient } = require('@aws-sdk/client-cost-explorer');
const { ResourceGroupsTaggingAPIClient } = require('@aws-sdk/client-resource-groups-tagging-api');

// You can specify region via env vars or default to us-east-1
const region = process.env.AWS_REGION || 'us-east-1';

const ec2Client = new EC2Client({ region });
const lambdaClient = new LambdaClient({ region });
const cloudWatchClient = new CloudWatchClient({ region });
const s3Client = new S3Client({ region });
const dynamoDbClient = new DynamoDBClient({ region });
const rdsClient = new RDSClient({ region });
const apiGatewayClient = new APIGatewayClient({ region });
const elbClient = new ElasticLoadBalancingV2Client({ region });
const cloudfrontClient = new CloudFrontClient({ region: 'us-east-1' }); // CloudFront is global, usually managed via us-east-1
const costExplorerClient = new CostExplorerClient({ region: 'us-east-1' }); // CE is a global service endpoint generally hosted in us-east-1
const taggingClient = new ResourceGroupsTaggingAPIClient({ region });

module.exports = {
    ec2Client,
    lambdaClient,
    cloudWatchClient,
    s3Client,
    dynamoDbClient,
    rdsClient,
    apiGatewayClient,
    elbClient,
    cloudfrontClient,
    costExplorerClient,
    taggingClient,
    region
};
