const { Stack, Duration } = require('aws-cdk-lib');
const iam = require('aws-cdk-lib/aws-iam');

class GitHubOidcStack extends Stack {
    constructor(scope, id, props) {
        super(scope, id, props);

        const repositoryConfig = [
            { owner: 'raghavarajunithisha-lab', repo: 'SkyMind' }
        ];

        // Create the GitHub OIDC Identity Provider
        const githubProvider = new iam.OpenIdConnectProvider(this, 'GitHubOidcProvider', {
            url: 'https://token.actions.githubusercontent.com',
            clientIds: ['sts.amazonaws.com'],
            // Latest recommended intermediate thumbprints for GitHub Actions
            thumbprints: ['6938fd4d98bab03faadb97b34396831e3780aea1', '1c58a3a8518e8759bf075b76b750d4f2df264fcd']
        });

        // Create an IAM Role that trusts the OIDC Provider
        const deployRole = new iam.Role(this, 'SkyMindGitHubDeployRole', {
            assumedBy: new iam.WebIdentityPrincipal(githubProvider.openIdConnectProviderArn, {
                StringLike: {
                    'token.actions.githubusercontent.com:sub': repositoryConfig.map(
                        c => `repo:${c.owner}/${c.repo}:*`
                    ),
                },
                StringEquals: {
                    'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
                },
            }),
            roleName: 'SkyMindGitHubDeployRole',
            description: 'Role assumed by GitHub Actions to deploy SkyMind POC via CDK',
            maxSessionDuration: Duration.hours(1), // 1 hour max session
        });

        // For POC: grant AdministratorAccess. For production, apply least privilege principles
        deployRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));
    }
}

module.exports = { GitHubOidcStack };
