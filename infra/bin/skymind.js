#!/usr/bin/env node
const cdk = require('aws-cdk-lib');
const { SkyMindStack } = require('../lib/skymind-stack');
const { GitHubOidcStack } = require('../lib/github-oidc-stack');

const app = new cdk.App();

const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
};

new GitHubOidcStack(app, 'SkyMindGitHubOidcStack', { env });

new SkyMindStack(app, 'SkyMindTier1Stack', {
    env,
    description: 'SkyMind Tier 1 POC: AI-powered self-healing infrastructure monitoring'
});
