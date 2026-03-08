const { queryClaude } = require('../shared/bedrock');
const { scanTable } = require('../shared/db');

const RESOURCES_TABLE = process.env.RESOURCES_TABLE || 'skymind-resources';
const ALERTS_TABLE = process.env.ALERTS_TABLE || 'skymind-alerts';

exports.handler = async (event) => {
    console.log('Skymind Chat API received request');

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const userMessage = body.message;

        if (!userMessage) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Message is required' }) };
        }

        // 1. Gather Context (RAG - Retrieval Augmented Generation)
        // In a production system, you would use Embeddings and a vector DB like Pinecone.
        // For Tier 1, we simply inject recent alerts and a summary of resources into the prompt.
        const [resources, alerts] = await Promise.all([
            scanTable(RESOURCES_TABLE),
            scanTable(ALERTS_TABLE)
        ]);

        const activeAlerts = alerts?.filter(a => !a.resolved) || [];

        // Create a compact string representation of context to fit in prompt limits
        const contextStr = `
CURRENT INFRASTRUCTURE CONTEXT:
Total Resources: ${resources?.length || 0}
Active Alerts: ${activeAlerts.length}

Recent Active Alerts (Top 3):
${activeAlerts.slice(0, 3).map(a => `- [${a.severity.toUpperCase()}] ${a.resourceId}: ${a.title} (${a.description})`).join('\n')}

Resource Summary (Random 5):
${(resources || []).slice(0, 5).map(r => `- ${r.type} (${r.id}): ${r.status}`).join('\n')}
`;

        // 2. Query Claude
        const systemPrompt = `You are SkyMind, an expert AWS Infrastructure AI platform. You have real-time access to the user's AWS account. 
You detect anomalies, optimize costs, and autonomously heal systems.
Answer the user's question directly, clearly, and concisely in plain English. Use bullet points if helpful. 
Use the provided CURRENT INFRASTRUCTURE CONTEXT to inform your answer. 
Format your response using basic markdown (e.g., **bolding** key terms).`;

        const fullPrompt = `${contextStr}\n\nUSER QUESTION: ${userMessage}`;

        console.log('Sending prompt to Claude with context...');
        const responseText = await queryClaude(fullPrompt, systemPrompt);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*' // Support CORS for local frontend dev
            },
            body: JSON.stringify({ response: responseText })
        };

    } catch (error) {
        console.error('Error in Chat API:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Failed to process chat query', details: error.message })
        };
    }
};
