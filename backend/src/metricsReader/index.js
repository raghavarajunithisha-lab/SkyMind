const { GetMetricStatisticsCommand } = require('@aws-sdk/client-cloudwatch');
const { cloudWatchClient } = require('../shared/aws');

/**
 * Reads real CloudWatch metrics for all resources passed as query params,
 * or fetches metrics for known Lambda functions by listing them.
 * 
 * Called by: GET /metrics?resources=json-encoded-resource-list
 */
exports.handler = async (event) => {
    console.log('SkyMind Metrics Reader starting...');

    try {
        // The frontend will pass resources as a query parameter
        let resources = [];
        if (event.queryStringParameters && event.queryStringParameters.resources) {
            try {
                resources = JSON.parse(decodeURIComponent(event.queryStringParameters.resources));
            } catch (e) {
                console.warn('Could not parse resources query param:', e.message);
            }
        }

        // If no resources passed, return empty
        if (!resources || resources.length === 0) {
            return {
                statusCode: 200,
                headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            };
        }

        const EndTime = new Date();
        const StartTime = new Date(EndTime.getTime() - 60 * 60 * 1000); // Last 1 hour

        const metricsResult = {};

        // Process resources in parallel (batches of 5 to avoid throttling)
        const batchSize = 5;
        for (let i = 0; i < resources.length; i += batchSize) {
            const batch = resources.slice(i, i + batchSize);
            await Promise.all(batch.map(async (res) => {
                try {
                    if (res.type === 'Lambda') {
                        // Lambda function name is stored in the resource id
                        const fnName = res.id;
                        const [invocations, errors, duration] = await Promise.all([
                            getSumMetric('AWS/Lambda', 'Invocations', 'FunctionName', fnName, StartTime, EndTime),
                            getSumMetric('AWS/Lambda', 'Errors', 'FunctionName', fnName, StartTime, EndTime),
                            getAverageMetric('AWS/Lambda', 'Duration', 'FunctionName', fnName, StartTime, EndTime),
                        ]);
                        metricsResult[res.id] = {
                            invocations: Math.round(invocations),
                            errors: Math.round(errors),
                            duration: duration.toFixed(2),
                        };
                    } else if (res.type === 'EC2') {
                        const [cpu, networkIn] = await Promise.all([
                            getAverageMetric('AWS/EC2', 'CPUUtilization', 'InstanceId', res.id, StartTime, EndTime),
                            getSumMetric('AWS/EC2', 'NetworkIn', 'InstanceId', res.id, StartTime, EndTime),
                        ]);
                        metricsResult[res.id] = {
                            cpu: cpu.toFixed(1),
                            network: (networkIn / 1024 / 1024).toFixed(2), // Convert bytes to MB
                        };
                    } else if (res.type === 'RDS') {
                        const [cpu, connections] = await Promise.all([
                            getAverageMetric('AWS/RDS', 'CPUUtilization', 'DBInstanceIdentifier', res.id, StartTime, EndTime),
                            getSumMetric('AWS/RDS', 'DatabaseConnections', 'DBInstanceIdentifier', res.id, StartTime, EndTime),
                        ]);
                        metricsResult[res.id] = {
                            cpu: cpu.toFixed(1),
                            connections: Math.round(connections),
                        };
                    } else if (res.type === 'DynamoDB') {
                        const [reads, writes] = await Promise.all([
                            getSumMetric('AWS/DynamoDB', 'ConsumedReadCapacityUnits', 'TableName', res.id, StartTime, EndTime),
                            getSumMetric('AWS/DynamoDB', 'ConsumedWriteCapacityUnits', 'TableName', res.id, StartTime, EndTime),
                        ]);
                        metricsResult[res.id] = {
                            readCapacity: (reads / 3600).toFixed(2),
                            writeCapacity: (writes / 3600).toFixed(2),
                        };
                    } else if (res.type === 'S3') {
                        // S3 daily metrics (bucket level) — these are reported once per day
                        const objects = await getAverageMetric('AWS/S3', 'NumberOfObjects', 'BucketName', res.id,
                            new Date(EndTime.getTime() - 2 * 24 * 60 * 60 * 1000), EndTime); // Last 2 days
                        metricsResult[res.id] = {
                            objects: Math.round(objects),
                        };
                    } else if (res.type === 'APIGateway') {
                        const [count, latency] = await Promise.all([
                            getSumMetric('AWS/ApiGateway', 'Count', 'ApiName', res.name || res.id, StartTime, EndTime),
                            getAverageMetric('AWS/ApiGateway', 'Latency', 'ApiName', res.name || res.id, StartTime, EndTime),
                        ]);
                        metricsResult[res.id] = {
                            requests: Math.round(count),
                            latency: latency.toFixed(1),
                        };
                    } else {
                        // Unknown type — return empty metrics
                        metricsResult[res.id] = {};
                    }
                } catch (err) {
                    console.warn(`Failed to get metrics for ${res.id} (${res.type}):`, err.message);
                    metricsResult[res.id] = { error: err.message };
                }
            }));
        }

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify(metricsResult)
        };

    } catch (error) {
        console.error('Error reading metrics:', error);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Failed', error: error.message })
        };
    }
};

async function getAverageMetric(namespace, metricName, dimName, dimValue, StartTime, EndTime) {
    const result = await cloudWatchClient.send(new GetMetricStatisticsCommand({
        Namespace: namespace,
        MetricName: metricName,
        Dimensions: [{ Name: dimName, Value: dimValue }],
        StartTime,
        EndTime,
        Period: 3600, // 1 hour aggregation
        Statistics: ['Average']
    }));
    if (result.Datapoints && result.Datapoints.length > 0) {
        // Return the most recent datapoint
        result.Datapoints.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
        return result.Datapoints[0].Average;
    }
    return 0;
}

async function getSumMetric(namespace, metricName, dimName, dimValue, StartTime, EndTime) {
    const result = await cloudWatchClient.send(new GetMetricStatisticsCommand({
        Namespace: namespace,
        MetricName: metricName,
        Dimensions: [{ Name: dimName, Value: dimValue }],
        StartTime,
        EndTime,
        Period: 3600,
        Statistics: ['Sum']
    }));
    if (result.Datapoints && result.Datapoints.length > 0) {
        // Sum all datapoints across the time range
        return result.Datapoints.reduce((acc, dp) => acc + dp.Sum, 0);
    }
    return 0;
}
