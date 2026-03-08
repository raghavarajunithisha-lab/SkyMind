const { scanTable, docClient, UpdateCommand } = require('../shared/db');
// In a real scenario, you'd use AWS SDK here to execute actions (e.g., AutoScalingClient, ECSClient)
// We will mock the actual execution since we don't want SkyMind Tier 1 mutating real AWS resources unnecessarily.

const ALERTS_TABLE = process.env.ALERTS_TABLE || 'skymind-alerts';

exports.handler = async (event) => {
    console.log('Skymind Healer starting...');

    try {
        const activeAlerts = await scanTable(ALERTS_TABLE);
        const unresolvedAlerts = activeAlerts.filter(a => !a.resolved && a.autoHealAllowed);

        if (unresolvedAlerts.length === 0) {
            console.log('No pending auto-healable alerts.');
            return { statusCode: 200, body: 'No action needed' };
        }

        let healedCount = 0;

        for (const alert of unresolvedAlerts) {
            console.log(`Attemping auto-heal for ${alert.resourceId}. Action: ${alert.recommendedAction}`);

            // Execute remediation based on resource type & recommended action
            // DANGEROUS/WRITE ACTIONS - In Tier 1, we simulate success
            let healSuccess = false;

            if (alert.recommendedAction.toLowerCase().includes('scale')) {
                console.log(`[SIMULATED] Scaling up resource ${alert.resourceId} to handle load.`);
                healSuccess = true;
            } else if (alert.recommendedAction.toLowerCase().includes('restart')) {
                console.log(`[SIMULATED] Restarting service associated with ${alert.resourceId}.`);
                healSuccess = true;
            } else {
                console.log(`[SIMULATED] Executing custom remediation: ${alert.recommendedAction}`);
                healSuccess = true;
            }

            if (healSuccess) {
                // Mark alert as resolved
                const command = new UpdateCommand({
                    TableName: ALERTS_TABLE,
                    Key: { id: alert.id },
                    UpdateExpression: 'SET resolved = :r, resolvedAt = :ra, resolutionNote = :rn',
                    ExpressionAttributeValues: {
                        ':r': true,
                        ':ra': new Date().toISOString(),
                        ':rn': `Successfully auto-executed: ${alert.recommendedAction}`
                    }
                });

                await docClient.send(command);
                console.log(`Successfully healed and resolved alert: ${alert.id}`);
                healedCount++;
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Healing cycle complete', healedCount })
        };

    } catch (error) {
        console.error('Error in healer:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Healer failed', error: error.message })
        };
    }
};
