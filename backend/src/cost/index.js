const { GetCostAndUsageCommand } = require('@aws-sdk/client-cost-explorer');
const { costExplorerClient } = require('../shared/aws');

exports.handler = async (event, context) => {
    console.log('Skymind Cost Collector starting...');
    try {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // AWS Cost Explorer requires dates in YYYY-MM-DD
        const startString = start.toISOString().split('T')[0];
        const endString = end.toISOString().split('T')[0];

        const command = new GetCostAndUsageCommand({
            TimePeriod: { Start: startString, End: endString },
            Granularity: 'MONTHLY',
            Metrics: ['UnblendedCost'],
            GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }]
        });

        const response = await costExplorerClient.send(command);

        let totalCosts = 0;
        const breakdownMap = {};

        if (response.ResultsByTime && response.ResultsByTime.length > 0) {
            // We'll just look at the last returned month period
            const currentPeriod = response.ResultsByTime[response.ResultsByTime.length - 1];

            if (currentPeriod.Groups) {
                currentPeriod.Groups.forEach(g => {
                    const serviceName = g.Keys[0];
                    const amount = parseFloat(g.Metrics.UnblendedCost.Amount);
                    if (amount > 0) {
                        totalCosts += amount;

                        // Map AWS complex names to simpler UI strings
                        let simpleName = 'Other AWS Services';
                        if (serviceName.includes('Elastic Compute Cloud')) simpleName = 'EC2';
                        else if (serviceName.includes('Lambda')) simpleName = 'Lambda';
                        else if (serviceName.includes('Relational Database Service')) simpleName = 'RDS';
                        else if (serviceName.includes('Simple Storage Service')) simpleName = 'S3';
                        else if (serviceName.includes('DynamoDB')) simpleName = 'DynamoDB';
                        else if (serviceName.includes('CloudFront')) simpleName = 'CloudFront';
                        else if (serviceName.includes('Virtual Private Cloud')) simpleName = 'VPC';
                        else simpleName = serviceName; // Leave intact

                        if (!breakdownMap[simpleName]) breakdownMap[simpleName] = 0;
                        breakdownMap[simpleName] += amount;
                    }
                });
            }
        }

        const costBreakdown = Object.keys(breakdownMap).map(service => ({
            service,
            amount: parseFloat(breakdownMap[service].toFixed(2)),
            percentage: totalCosts > 0 ? (breakdownMap[service] / totalCosts) * 100 : 0,
            color: service === 'EC2' ? '#3b82f6' : service === 'RDS' ? '#8b5cf6' : service === 'S3' ? '#10b981' : service === 'Lambda' ? '#f59e0b' : '#64748b'
        })).sort((a, b) => b.amount - a.amount);

        // Get the top 5 cost drivers, push the rest into "Other"
        let finalBreakdown = [];
        let finalOther = 0;
        costBreakdown.forEach((item, index) => {
            if (index < 5) finalBreakdown.push(item);
            else finalOther += item.amount;
        });

        if (finalOther > 0) {
            finalBreakdown.push({
                service: 'Other',
                amount: parseFloat(finalOther.toFixed(2)),
                percentage: totalCosts > 0 ? (finalOther / totalCosts) * 100 : 0,
                color: '#64748b'
            });
        }

        const costData = {
            totalMonthly: parseFloat(totalCosts.toFixed(2)),
            previousMonth: 0,
            projectedSavings: 0,
            breakdown: finalBreakdown,
            waste: [] // Usually provided by Compute Optimizer, returning empty for now
        };

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify(costData)
        };

    } catch (e) {
        console.error('Error fetching real cost from CE', e);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: "Failed", error: e.message })
        };
    }
};
