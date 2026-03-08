const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const region = process.env.AWS_REGION || 'us-east-1';
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

async function putItem(tableName, item) {
    const command = new PutCommand({
        TableName: tableName,
        Item: item
    });
    return docClient.send(command);
}

async function getItem(tableName, key) {
    const command = new GetCommand({
        TableName: tableName,
        Key: key
    });
    const response = await docClient.send(command);
    return response.Item;
}

async function scanTable(tableName) {
    const command = new ScanCommand({
        TableName: tableName
    });
    const response = await docClient.send(command);
    return response.Items;
}

// Basic query helper for a partition key
async function queryByIndex(tableName, indexName, keyName, keyValue) {
    const command = new QueryCommand({
        TableName: tableName,
        IndexName: indexName,
        KeyConditionExpression: '#k = :v',
        ExpressionAttributeNames: { '#k': keyName },
        ExpressionAttributeValues: { ':v': keyValue }
    });
    const response = await docClient.send(command);
    return response.Items;
}

module.exports = {
    docClient,
    putItem,
    getItem,
    scanTable,
    queryByIndex,
    PutCommand,
    UpdateCommand
};
