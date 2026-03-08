const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const region = process.env.AWS_REGION || 'us-east-1';
const client = new BedrockRuntimeClient({ region });

// We default to Claude 3 Haiku for cost efficiency, but can be overridden
const DEFAULT_MODEL = 'anthropic.claude-3-haiku-20240307-v1:0';

async function queryClaude(prompt, systemPrompt = 'You are SkyMind, an expert AWS infrastructure AI. Be concise and helpful.', modelId = DEFAULT_MODEL) {
    const payload = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
            {
                role: 'user',
                content: prompt
            }
        ]
    };

    const command = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload)
    });

    try {
        const response = await client.send(command);
        const resultBody = JSON.parse(new TextDecoder().decode(response.body));
        return resultBody.content[0].text;
    } catch (error) {
        console.error('Error invoking Bedrock:', error);
        throw error;
    }
}

module.exports = {
    queryClaude
};
