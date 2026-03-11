const { Stack, Duration, RemovalPolicy } = require('aws-cdk-lib');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const lambda = require('aws-cdk-lib/aws-lambda');
const apigateway = require('aws-cdk-lib/aws-apigateway');
const s3 = require('aws-cdk-lib/aws-s3');
const iam = require('aws-cdk-lib/aws-iam');
const events = require('aws-cdk-lib/aws-events');
const targets = require('aws-cdk-lib/aws-events-targets');

class SkyMindStack extends Stack {
    /**
     * @param {Construct} scope
     * @param {string} id
     * @param {StackProps=} props
     */
    constructor(scope, id, props) {
        super(scope, id, props);

        // ==========================================
        // 1. DATA LAYER (DynamoDB & S3)
        // ==========================================
        const resourcesTable = new dynamodb.Table(this, 'ResourcesTable', {
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: RemovalPolicy.DESTROY, // For POC safety
        });

        const metricsTable = new dynamodb.Table(this, 'MetricsTable', {
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: RemovalPolicy.DESTROY,
        });

        const alertsTable = new dynamodb.Table(this, 'AlertsTable', {
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: RemovalPolicy.DESTROY,
        });

        const dataLake = new s3.Bucket(this, 'SkyMindDataLake', {
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            lifecycleRules: [{ expiration: Duration.days(90) }],
        });

        // ==========================================
        // 2. COMPUTE LAYER (Lambda Functions)
        // ==========================================
        const lambdaCommonProps = {
            runtime: lambda.Runtime.NODEJS_20_X,
            timeout: Duration.seconds(30),
            memorySize: 256,
            environment: {
                RESOURCES_TABLE: resourcesTable.tableName,
                METRICS_TABLE: metricsTable.tableName,
                ALERTS_TABLE: alertsTable.tableName,
            }
        };

        // 2a. Scanner: discovers resources
        const scannerFunction = new lambda.Function(this, 'ScannerFunction', {
            ...lambdaCommonProps,
            code: lambda.Code.fromAsset('../backend/src'),
            handler: 'scanner/index.handler',
        });
        resourcesTable.grantReadWriteData(scannerFunction);
        scannerFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: [
                'ec2:DescribeInstances',
                'lambda:ListFunctions',
                's3:ListAllMyBuckets',
                'dynamodb:ListTables',
                'rds:DescribeDBInstances',
                'apigateway:GET',
                'elasticloadbalancing:DescribeLoadBalancers',
                'cloudfront:ListDistributions'
            ],
            resources: ['*'],
        }));

        // 2b. Metrics Collector: grabs CloudWatch metrics
        const metricsFunction = new lambda.Function(this, 'MetricsFunction', {
            ...lambdaCommonProps,
            code: lambda.Code.fromAsset('../backend/src'),
            handler: 'metrics/index.handler',
            timeout: Duration.seconds(60), // CloudWatch querying can take longer
        });
        resourcesTable.grantReadData(metricsFunction);
        metricsTable.grantReadWriteData(metricsFunction);
        metricsFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['cloudwatch:GetMetricStatistics'],
            resources: ['*'],
        }));

        // 2c. AI Analyzer: uses Bedrock to find root causes
        const analyzerFunction = new lambda.Function(this, 'AnalyzerFunction', {
            ...lambdaCommonProps,
            code: lambda.Code.fromAsset('../backend/src'),
            handler: 'analyzer/index.handler',
            timeout: Duration.minutes(1), // LLM calls need more time
        });
        metricsTable.grantReadData(analyzerFunction);
        alertsTable.grantReadWriteData(analyzerFunction);
        analyzerFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel'],
            resources: ['*'], // In production, scope to specific Claude model ARN
        }));

        // 2d. Healer: Executes remediation
        const healerFunction = new lambda.Function(this, 'HealerFunction', {
            ...lambdaCommonProps,
            code: lambda.Code.fromAsset('../backend/src'),
            handler: 'healer/index.handler',
        });
        alertsTable.grantReadWriteData(healerFunction);

        // 2e. Cost Collector: grabs AWS Cost Explorer data
        const costFunction = new lambda.Function(this, 'CostFunction', {
            ...lambdaCommonProps,
            code: lambda.Code.fromAsset('../backend/src'),
            handler: 'cost/index.handler',
            timeout: Duration.seconds(30),
        });
        costFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['ce:GetCostAndUsage'],
            resources: ['*'],
        }));

        // 2f. Chat API: Natural language ops
        const chatFunction = new lambda.Function(this, 'ChatFunction', {
            ...lambdaCommonProps,
            code: lambda.Code.fromAsset('../backend/src'),
            handler: 'chat/index.handler',
            timeout: Duration.seconds(45),
        });
        resourcesTable.grantReadData(chatFunction);
        alertsTable.grantReadData(chatFunction);
        chatFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel'],
            resources: ['*'],
        }));

        // 2g. Alerts Collector: queries real CloudWatch alarms
        const alertsFunction = new lambda.Function(this, 'AlertsFunction', {
            ...lambdaCommonProps,
            code: lambda.Code.fromAsset('../backend/src'),
            handler: 'alerts/index.handler',
            timeout: Duration.seconds(30),
        });
        alertsFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['cloudwatch:DescribeAlarms'],
            resources: ['*'],
        }));

        // 2h. Metrics Reader: queries real CloudWatch metrics for dashboard display
        const metricsReaderFunction = new lambda.Function(this, 'MetricsReaderFunction', {
            ...lambdaCommonProps,
            code: lambda.Code.fromAsset('../backend/src'),
            handler: 'metricsReader/index.handler',
            timeout: Duration.seconds(45),
        });
        metricsReaderFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['cloudwatch:GetMetricStatistics'],
            resources: ['*'],
        }));

        // ==========================================
        // 3. API & EVENT ROUTING
        // ==========================================

        // Next.js Frontend calls this API
        const api = new apigateway.RestApi(this, 'SkyMindApi', {
            restApiName: 'SkyMind Dashboard API',
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
            },
        });

        const chatResource = api.root.addResource('chat');
        chatResource.addMethod('POST', new apigateway.LambdaIntegration(chatFunction));

        // Connect Dashboard UI endpoints to corresponding Lambda functions
        const resourcesApi = api.root.addResource('resources');
        const metricsApi = api.root.addResource('metrics');
        const alertsApi = api.root.addResource('alerts');
        const costApi = api.root.addResource('cost');

        // Reuse existing functions to serve the data (in a real app, you'd use dedicated reader Lambdas)
        resourcesApi.addMethod('GET', new apigateway.LambdaIntegration(scannerFunction));
        metricsApi.addMethod('GET', new apigateway.LambdaIntegration(metricsReaderFunction));
        alertsApi.addMethod('GET', new apigateway.LambdaIntegration(alertsFunction));
        costApi.addMethod('GET', new apigateway.LambdaIntegration(costFunction));

        // Automated Schedules (EventBridge)
        // Run scanner every 10 min
        new events.Rule(this, 'ScannerSchedule', {
            schedule: events.Schedule.rate(Duration.minutes(10)),
            targets: [new targets.LambdaFunction(scannerFunction)],
        });

        // Run metrics collection every 5 min
        new events.Rule(this, 'MetricsSchedule', {
            schedule: events.Schedule.rate(Duration.minutes(5)),
            targets: [new targets.LambdaFunction(metricsFunction)],
        });

        // Run analyzer every 5 min (offset slightly)
        new events.Rule(this, 'AnalyzerSchedule', {
            schedule: events.Schedule.rate(Duration.minutes(5)),
            targets: [new targets.LambdaFunction(analyzerFunction)],
        });

        // Run healer every 5 min
        new events.Rule(this, 'HealerSchedule', {
            schedule: events.Schedule.rate(Duration.minutes(5)),
            targets: [new targets.LambdaFunction(healerFunction)],
        });
    }
}

module.exports = { SkyMindStack };
