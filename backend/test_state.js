const { LambdaClient, ListFunctionsCommand } = require('@aws-sdk/client-lambda');

async function test() {
    const lambdaClient = new LambdaClient({ region: 'us-east-1' }); // or process.env.AWS_REGION
    try {
        const lambdaRes = await lambdaClient.send(new ListFunctionsCommand({}));
        lambdaRes.Functions?.forEach(fn => {
            console.log(`Function: ${fn.FunctionName}, State: ${fn.State}, Typeof: ${typeof fn.State}`);
        });
    } catch (e) {
        console.error(e);
    }
}

test();
