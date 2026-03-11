const { DescribeAlarmsCommand } = require('@aws-sdk/client-cloudwatch');
const { cloudWatchClient } = require('../shared/aws');

exports.handler = async (event, context) => {
    console.log('SkyMind Alerts Collector starting...');
    try {
        // Fetch all CloudWatch alarms across all states
        const [alarmResponse, okResponse] = await Promise.all([
            cloudWatchClient.send(new DescribeAlarmsCommand({
                StateValue: 'ALARM',
                MaxRecords: 50,
            })),
            cloudWatchClient.send(new DescribeAlarmsCommand({
                StateValue: 'INSUFFICIENT_DATA',
                MaxRecords: 20,
            })),
        ]);

        const alerts = [];

        // Process ALARM state alarms (these are active issues)
        if (alarmResponse.MetricAlarms) {
            alarmResponse.MetricAlarms.forEach(alarm => {
                alerts.push({
                    id: alarm.AlarmName,
                    severity: 'critical',
                    title: alarm.AlarmName,
                    description: alarm.AlarmDescription || `${alarm.MetricName} ${alarm.ComparisonOperator} ${alarm.Threshold} (Namespace: ${alarm.Namespace})`,
                    time: getTimeAgo(alarm.StateTransitionedTimestamp),
                    resource: alarm.Dimensions?.length > 0 ? alarm.Dimensions[0].Value : null,
                    resolved: false,
                    raw: {
                        namespace: alarm.Namespace,
                        metric: alarm.MetricName,
                        threshold: alarm.Threshold,
                        comparison: alarm.ComparisonOperator,
                        period: alarm.Period,
                        evaluationPeriods: alarm.EvaluationPeriods,
                    }
                });
            });
        }

        // Process INSUFFICIENT_DATA alarms (potential warnings)
        if (okResponse.MetricAlarms) {
            okResponse.MetricAlarms.forEach(alarm => {
                alerts.push({
                    id: alarm.AlarmName,
                    severity: 'warning',
                    title: alarm.AlarmName,
                    description: alarm.AlarmDescription || `${alarm.MetricName} has insufficient data (Namespace: ${alarm.Namespace})`,
                    time: getTimeAgo(alarm.StateTransitionedTimestamp),
                    resource: alarm.Dimensions?.length > 0 ? alarm.Dimensions[0].Value : null,
                    resolved: false,
                    raw: {
                        namespace: alarm.Namespace,
                        metric: alarm.MetricName,
                    }
                });
            });
        }

        // If no alarms at all, return a friendly info alert
        if (alerts.length === 0) {
            alerts.push({
                id: 'no-alarms',
                severity: 'info',
                title: 'All Clear',
                description: 'No active CloudWatch alarms detected. Your infrastructure is healthy.',
                time: 'just now',
                resource: null,
                resolved: true,
            });
        }

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify(alerts)
        };

    } catch (e) {
        console.error('Error fetching CloudWatch alarms:', e);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Failed to fetch alerts', error: e.message })
        };
    }
};

function getTimeAgo(date) {
    if (!date) return 'unknown';
    const now = new Date();
    const diff = Math.floor((now - new Date(date)) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}
