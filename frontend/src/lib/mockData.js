// Simulated AWS infrastructure data for local development
// This replaces real AWS API calls during local dev

export const mockResources = [
    { id: 'ec2-web-1', type: 'EC2', name: 'web-server-1', status: 'healthy', region: 'us-east-1', instanceType: 't3.medium', az: 'us-east-1a' },
    { id: 'ec2-web-2', type: 'EC2', name: 'web-server-2', status: 'healthy', region: 'us-east-1', instanceType: 't3.medium', az: 'us-east-1b' },
    { id: 'ec2-api-1', type: 'EC2', name: 'api-server-1', status: 'warning', region: 'us-east-1', instanceType: 't3.large', az: 'us-east-1a' },
    { id: 'rds-main', type: 'RDS', name: 'main-database', status: 'healthy', region: 'us-east-1', engine: 'PostgreSQL 15', instanceClass: 'db.t3.medium' },
    { id: 'rds-replica', type: 'RDS', name: 'read-replica', status: 'healthy', region: 'us-east-1', engine: 'PostgreSQL 15', instanceClass: 'db.t3.small' },
    { id: 'lambda-auth', type: 'Lambda', name: 'auth-handler', status: 'healthy', region: 'us-east-1', runtime: 'nodejs18.x', memory: 256 },
    { id: 'lambda-process', type: 'Lambda', name: 'data-processor', status: 'critical', region: 'us-east-1', runtime: 'python3.11', memory: 512, skymind: true }, // SkyMind Mock
    { id: 'lambda-notify', type: 'Lambda', name: 'notification-svc', status: 'healthy', region: 'us-east-1', runtime: 'nodejs18.x', memory: 128 },
    { id: 's3-assets', type: 'S3', name: 'app-assets-prod', status: 'healthy', region: 'us-east-1', sizeGB: 45.2, skymind: true }, // SkyMind Mock
    { id: 's3-logs', type: 'S3', name: 'app-logs-prod', status: 'healthy', region: 'us-east-1', sizeGB: 128.7 },
    { id: 'dynamo-sessions', type: 'DynamoDB', name: 'user-sessions', status: 'healthy', region: 'us-east-1', readCapacity: 50, writeCapacity: 25 },
    { id: 'dynamo-cache', type: 'DynamoDB', name: 'api-cache', status: 'warning', region: 'us-east-1', readCapacity: 100, writeCapacity: 50, skymind: true }, // SkyMind Mock
    { id: 'apigw-main', type: 'APIGateway', name: 'main-api', status: 'healthy', region: 'us-east-1', stage: 'prod' },
    { id: 'elb-main', type: 'ELB', name: 'main-load-balancer', status: 'healthy', region: 'us-east-1', type: 'ALB' },
    { id: 'cloudfront-cdn', type: 'CloudFront', name: 'cdn-distribution', status: 'healthy', region: 'global' },
];

export const mockConnections = [
    { source: 'cloudfront-cdn', target: 'elb-main' },
    { source: 'elb-main', target: 'ec2-web-1' },
    { source: 'elb-main', target: 'ec2-web-2' },
    { source: 'ec2-web-1', target: 'apigw-main' },
    { source: 'ec2-web-2', target: 'apigw-main' },
    { source: 'apigw-main', target: 'ec2-api-1' },
    { source: 'apigw-main', target: 'lambda-auth' },
    { source: 'ec2-api-1', target: 'rds-main' },
    { source: 'rds-main', target: 'rds-replica' },
    { source: 'ec2-api-1', target: 'dynamo-sessions' },
    { source: 'ec2-api-1', target: 'dynamo-cache' },
    { source: 'lambda-process', target: 's3-logs' },
    { source: 'lambda-notify', target: 'dynamo-sessions' },
    { source: 'ec2-web-1', target: 's3-assets' },
    { source: 'ec2-web-2', target: 's3-assets' },
];

export const mockMetrics = {
    'ec2-web-1': { cpu: 42, memory: 58, network: 120, latency: 45, errorRate: 0.1 },
    'ec2-web-2': { cpu: 38, memory: 52, network: 95, latency: 42, errorRate: 0.05 },
    'ec2-api-1': { cpu: 78, memory: 82, network: 340, latency: 180, errorRate: 2.3 },
    'rds-main': { cpu: 35, memory: 68, connections: 42, latency: 12, iops: 850 },
    'rds-replica': { cpu: 22, memory: 45, connections: 18, latency: 8, replicaLag: 0.5 },
    'lambda-auth': { invocations: 12400, errors: 3, duration: 85, throttles: 0, concurrency: 12 },
    'lambda-process': { invocations: 8200, errors: 487, duration: 2400, throttles: 45, concurrency: 48 },
    'lambda-notify': { invocations: 3200, errors: 1, duration: 120, throttles: 0, concurrency: 4 },
    's3-assets': { requests: 45200, bandwidth: 12.4, objects: 28400, cost: 2.15 },
    's3-logs': { requests: 8400, bandwidth: 45.8, objects: 1240000, cost: 3.85 },
    'dynamo-sessions': { readCapacity: 32, writeCapacity: 18, throttledReads: 0, throttledWrites: 0, latency: 4 },
    'dynamo-cache': { readCapacity: 92, writeCapacity: 45, throttledReads: 12, throttledWrites: 3, latency: 8 },
    'apigw-main': { requests: 184000, latency: 95, errors4xx: 230, errors5xx: 12, cacheHitRate: 78 },
    'elb-main': { activeConnections: 1240, requestCount: 184000, latency: 15, healthyHosts: 2, unhealthyHosts: 0 },
    'cloudfront-cdn': { requests: 520000, bandwidth: 89.2, cacheHitRate: 94, errors: 0.02 },
};

export const mockCostData = {
    totalMonthly: 1247.83,
    previousMonth: 1394.20,
    projectedSavings: 847.50,
    breakdown: [
        { service: 'EC2', amount: 485.20, percentage: 38.9, color: '#3b82f6' },
        { service: 'RDS', amount: 312.45, percentage: 25.0, color: '#8b5cf6' },
        { service: 'Lambda', amount: 45.80, percentage: 3.7, color: '#06b6d4' },
        { service: 'S3', amount: 128.30, percentage: 10.3, color: '#10b981' },
        { service: 'DynamoDB', amount: 89.60, percentage: 7.2, color: '#f59e0b' },
        { service: 'CloudFront', amount: 156.48, percentage: 12.5, color: '#ec4899' },
        { service: 'Other', amount: 30.00, percentage: 2.4, color: '#64748b' },
    ],
    waste: [
        { resource: 'ec2-api-1', issue: 'Over-provisioned (avg CPU 22%)', savings: '$142/mo', action: 'Rightsize to t3.small' },
        { resource: 's3-logs', issue: '850GB of logs older than 90 days', savings: '$385/mo', action: 'Enable Glacier lifecycle' },
        { resource: 'rds-replica', issue: 'Read replica underutilized (18 connections)', savings: '$156/mo', action: 'Consider removing' },
        { resource: 'dynamo-cache', issue: 'Provisioned capacity 3x higher than needed', savings: '$164.50/mo', action: 'Switch to on-demand' },
    ]
};

export const mockAlerts = [
    { id: 'a1', severity: 'critical', title: 'Lambda data-processor error rate spike', description: 'Error rate jumped to 5.9% — 487 errors in last hour. Possible timeout issue.', time: '2 min ago', resource: 'lambda-process', resolved: false },
    { id: 'a2', severity: 'warning', title: 'API server CPU approaching threshold', description: 'ec2-api-1 CPU at 78% and trending upward. Predicted to breach 90% in 23 minutes.', time: '8 min ago', resource: 'ec2-api-1', resolved: false },
    { id: 'a3', severity: 'warning', title: 'DynamoDB throttling detected', description: 'api-cache table experiencing read throttles (12 in last 15 min).', time: '15 min ago', resource: 'dynamo-cache', resolved: false },
    { id: 'a4', severity: 'resolved', title: 'Auto-scaled web-server fleet', description: 'SkyMind automatically scaled web servers from 2 to 3 instances to handle traffic spike.', time: '32 min ago', resource: 'ec2-web-1', resolved: true },
    { id: 'a5', severity: 'info', title: 'Cost optimization opportunity found', description: 'Identified $847.50/month in potential savings across 4 resources.', time: '1 hr ago', resource: null, resolved: false },
    { id: 'a6', severity: 'resolved', title: 'RDS connection pool recovered', description: 'Connection count returned to normal after automatic connection cleanup.', time: '2 hrs ago', resource: 'rds-main', resolved: true },
];

export const mockChatHistory = [
    {
        role: 'ai',
        content: "👋 Hi! I'm SkyMind AI. I'm monitoring your infrastructure in real-time. Ask me anything — \"What's causing high latency?\" or \"How can I reduce costs?\""
    },
];

export const mockAIResponses = {
    'latency': "📊 **Root Cause Analysis: High Latency**\n\nI traced the latency spike to **ec2-api-1** (your API server):\n\n• **CPU is at 78%** and climbing — approaching the 90% threshold\n• **Memory usage: 82%** — GC pauses are likely contributing\n• **DynamoDB api-cache** is throttling reads, adding ~45ms per request\n\n**Recommendation:** I can auto-scale the API tier and switch DynamoDB to on-demand mode. This should reduce p99 latency by ~60%. Want me to proceed?",
    'cost': "💰 **Cost Analysis Report**\n\nCurrent monthly spend: **$1,247.83** (down 10.5% from last month)\n\nI found **$847.50/month in savings**:\n\n1. **S3 logs** — Move 850GB of old logs to Glacier → saves **$385/mo**\n2. **DynamoDB cache** — Switch to on-demand pricing → saves **$164.50/mo**\n3. **RDS replica** — Underutilized, consider removing → saves **$156/mo**\n4. **EC2 api-1** — Rightsize from t3.large to t3.small → saves **$142/mo**\n\nShall I auto-execute the safe optimizations (items 1 & 2)?",
    'status': "✅ **Infrastructure Health Summary**\n\n**15 resources** monitored across us-east-1:\n\n• 🟢 **12 Healthy** — Operating within normal parameters\n• 🟡 **2 Warning** — ec2-api-1 (high CPU), dynamo-cache (throttling)\n• 🔴 **1 Critical** — lambda-process (5.9% error rate)\n\n**Active incidents:**\n1. Lambda data-processor experiencing timeout errors since 14:32 UTC\n2. API server CPU trending toward threshold — auto-scale recommended\n\n**Self-healing actions taken today:** 2 (auto-scaled web fleet, cleaned RDS connections)",
    'default': "🔍 I analyzed your infrastructure for that query. Here's what I found:\n\nYour infrastructure is running **15 resources** with an overall health score of **87/100**. There are 2 active warnings and 1 critical issue that need attention.\n\nWould you like me to drill into a specific service, or should I run a full diagnostic?"
};

// Utility: get a random AI response based on keywords
export function getAIResponse(message) {
    const lower = message.toLowerCase();
    if (lower.includes('latency') || lower.includes('slow') || lower.includes('spike')) return mockAIResponses.latency;
    if (lower.includes('cost') || lower.includes('spend') || lower.includes('money') || lower.includes('save') || lower.includes('bill')) return mockAIResponses.cost;
    if (lower.includes('status') || lower.includes('health') || lower.includes('how') || lower.includes('overview')) return mockAIResponses.status;
    return mockAIResponses.default;
}

// Service type icon mapping
export const serviceIcons = {
    'EC2': '🖥️',
    'RDS': '🗄️',
    'Lambda': '⚡',
    'S3': '📦',
    'DynamoDB': '🔋',
    'APIGateway': '🔗',
    'ELB': '⚖️',
    'CloudFront': '🌐',
};

// Service type colors for the infra map
export const serviceColors = {
    'EC2': '#e0e0e0',
    'RDS': '#b0b0b0',
    'Lambda': '#ffffff',
    'S3': '#9e9e9e',
    'DynamoDB': '#c8c8c8',
    'APIGateway': '#d4d4d4',
    'ELB': '#8a8a8a',
    'CloudFront': '#f5f5f5',
};
