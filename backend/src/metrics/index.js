const { GetMetricStatisticsCommand } = require('@aws-sdk/client-cloudwatch');
const { cloudWatchClient } = require('../shared/aws');
const { scanTable, putItem } = require('../shared/db');

const RESOURCES_TABLE = process.env.RESOURCES_TABLE || 'skymind-resources';
const METRICS_TABLE = process.env.METRICS_TABLE || 'skymind-metrics';

exports.handler = async (event) => {
    console.log('Skymind Metrics Collector starting...');

    try {
        // 1. Get all resources we need to monitor
        const resources = await scanTable(RESOURCES_TABLE);
        if (!resources || resources.length === 0) {
            console.log('No resources found to monitor.');
            return { statusCode: 200, body: 'No resources' };
        }

        const EndTime = new Date();
        const StartTime = new Date(EndTime.getTime() - 5 * 60 * 1000); // Look at last 5 mins

        let processedCount = 0;

        for (const res of resources) {
            let metricData = {
                id: res.id,
                timestamp: EndTime.toISOString(),
            };

            if (res.type === 'EC2') {
                const cpuMetric = await getAverageMetric('AWS/EC2', 'CPUUtilization', 'InstanceId', res.id, StartTime, EndTime);
                metricData.cpu = cpuMetric;

                // Simple Anomaly Detection (if CPU > 85%, flag it)
                if (cpuMetric > 85) {
                    console.warn(`[ANOMALY] EC2 CPU high on ${res.id}: ${cpuMetric}%`);
                    metricData.anomaly = true;
                    metricData.anomalyDetails = `CPU utilization is high: ${Number(cpuMetric).toFixed(1)}%`;
                }
            } else if (res.type === 'Lambda') {
                const errors = await getSumMetric('AWS/Lambda', 'Errors', 'FunctionName', res.id, StartTime, EndTime);
                const invocations = await getSumMetric('AWS/Lambda', 'Invocations', 'FunctionName', res.id, StartTime, EndTime);

                metricData.errors = errors;
                metricData.invocations = invocations;

                const errorRate = invocations > 0 ? (errors / invocations) : 0;

                if (errorRate > 0.05) { // 5% error rate threshold
                    console.warn(`[ANOMALY] Lambda High Error Rate on ${res.id}`);
                    metricData.anomaly = true;
                    metricData.anomalyDetails = `High error rate detected: ${(errorRate * 100).toFixed(1)}%`;
                }
            }

            await putItem(METRICS_TABLE, metricData);
            processedCount++;
        }

        console.log(`Metrics collector finished. Processed ${processedCount} resources.`);
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Metrics collected', count: processedCount })
        };

    } catch (error) {
        console.error('Error collecting metrics:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Metrics collection failed', error: error.message })
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
        Period: 300,
        Statistics: ['Average']
    }));

    if (result.Datapoints && result.Datapoints.length > 0) {
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
        Period: 300,
        Statistics: ['Sum']
    }));

    if (result.Datapoints && result.Datapoints.length > 0) {
        return result.Datapoints[0].Sum;
    }
    return 0;
}
