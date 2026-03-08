const { EC2Client } = require('@aws-sdk/client-ec2');
const { LambdaClient } = require('@aws-sdk/client-lambda');
const { CloudWatchClient } = require('@aws-sdk/client-cloudwatch');

// You can specify region via env vars or default to us-east-1
const region = process.env.AWS_REGION || 'us-east-1';

const ec2Client = new EC2Client({ region });
const lambdaClient = new LambdaClient({ region });
const cloudWatchClient = new CloudWatchClient({ region });

module.exports = {
    ec2Client,
    lambdaClient,
    cloudWatchClient,
    region
};
