const { queryClaude } = require('../shared/bedrock');
const { scanTable, putItem } = require('../shared/db');

const METRICS_TABLE = process.env.METRICS_TABLE || 'skymind-metrics';
const ALERTS_TABLE = process.env.ALERTS_TABLE || 'skymind-alerts';

exports.handler = async (event) => {
    console.log('Skymind AI Analyzer starting...');

    try {
        // 1. Fetch recent metrics highlighting anomalies
        const allMetrics = await scanTable(METRICS_TABLE);
        if (!allMetrics || allMetrics.length === 0) {
            return { statusCode: 200, body: 'No metrics to analyze' };
        }

        // Filter metrics from the last 10 minutes that have anomalies
        const recentAnomalies = allMetrics.filter(m => m.anomaly && (Date.now() - new Date(m.timestamp).getTime() < 10 * 60 * 1000));

        if (recentAnomalies.length === 0) {
            console.log('No recent anomalies found. Infrastructure is healthy.');
            return { statusCode: 200, body: 'No anomalies' };
        }

        console.log(`Analyzing ${recentAnomalies.length} anomalous metrics...`);

        for (const anomaly of recentAnomalies) {
            const prompt = `Analyze the following infrastructure anomaly and determine the severity (critical, warning) and recommend a specific remediation action (e.g., auto-scale, restart, rightsize). 
      
      Resource ID: ${anomaly.id}
      Type: ${anomaly.id.startsWith('i-') ? 'EC2' : 'Lambda'}
      Anomaly Details: ${anomaly.anomalyDetails}
      
      Output JSON only containing fields: "severity", "title", "description", "recommendedAction" (string), "autoHealAllowed" (boolean)`;

            const systemPrompt = "You are SkyMind Analyzer. Output strict JSON only. No markdown, no preface.";

            const rawResponse = await queryClaude(prompt, systemPrompt);
            let analysisResult;
            try {
                // Claude sometimes returns text wrapped in markdown json block
                const cleanJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
                analysisResult = JSON.parse(cleanJson);
            } catch (parseErr) {
                console.error('Failed to parse Claude JSON response:', parseErr, 'Raw:', rawResponse);
                continue; // Skip this anomaly if Claude didn't output valid JSON
            }

            const alertItem = {
                id: `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                resourceId: anomaly.id,
                timestamp: new Date().toISOString(),
                severity: analysisResult.severity || 'warning',
                title: analysisResult.title || 'Anomaly Detected',
                description: analysisResult.description || anomaly.anomalyDetails,
                recommendedAction: analysisResult.recommendedAction || 'Investigate manually',
                autoHealAllowed: analysisResult.autoHealAllowed || false,
                resolved: false
            };

            await putItem(ALERTS_TABLE, alertItem);
            console.log(`Generated Alert: ${alertItem.title} for ${alertItem.resourceId}. Auto-heal: ${alertItem.autoHealAllowed}`);

            // If auto-heal is allowed (e.g., low-risk scale up), we might trigger the healer here via EventBridge.
            // For Tier 1 POC, the healer runs on a schedule to check unresolved alerts.
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Analysis complete', anomaliesProcessed: recentAnomalies.length })
        };

    } catch (error) {
        console.error('Error in analyzer:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Analysis failed', error: error.message })
        };
    }
};
