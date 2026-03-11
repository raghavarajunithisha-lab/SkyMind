# 🧠 SkyMind :  AI-Powered Cloud Infrastructure Brain

SkyMind is a self-healing, self-optimizing cloud infrastructure system built on AWS. It uses **Amazon Bedrock (Claude Haiku)** and specialized AI agents to monitor your AWS environment, predict failures, execute autonomous remediation, and optimize your cloud spend in real-time.


## 🚀 The 4 Core Capabilities

1. **Live Infrastructure Map**: Real-time D3.js visualization of all your AWS resources, dependencies, and health statuses.
2. **AI Cost Optimizer**: Continuously scans for waste (idle instances, over-provisioned databases, old logs) and calculates exact dollar savings.
3. **Health Monitor**: Detects CloudWatch anomalies, predicts failures before downtime, and auto-executes remediation (auto-scaling, task restarts). High-risk actions require human approval.
4. **AI chat & Alerts**: Chat with your infrastructure. Ask *"Why did latency spike?"* and SkyMind queries your logs, traces the root cause, and responds in plain English with evidence.

<img width="1919" height="897" alt="Skymind" src="https://github.com/user-attachments/assets/17fb2c88-4dee-48ce-9d77-ea612ae3dbbc" />


## 🏗️ Technical Architecture (Serverless & Event-Driven)

SkyMind is built primarily on serverless AWS technologies to ensure it has virtually zero operational overhead and costs less than $10/month to run.

```mermaid
graph TD
    subgraph "Frontend (Next.js)"
        UI[Dashboard UI]
        Vis[D3.js Network Graph]
        Chat[AI Chat Interface]
    end

    subgraph "SkyMind Backend (AWS Serverless)"
        API[API Gateway]
        L1[Lambda: Scanner]
        L2[Lambda: Metrics]
        L3[Lambda: AI Analyzer]
        L4[Lambda: Healer]
        L5[Lambda: Chat API]
        DB[(DynamoDB Tables)]
        EB[EventBridge Scheduler]
    end

    subgraph "AI Brain"
        Bedrock[Amazon Bedrock\nClaude 3 Haiku]
    end

    subgraph "Customer AWS Environment"
        CW[CloudWatch]
        Target[EC2, RDS, Lambda, S3]
    end

    %% Connections
    UI <--> API
    Vis <--> API
    Chat <--> API
    
    API <--> L5
    EB -->|Every 5m| L1
    EB -->|Every 5m| L2
    EB -->|Every 5m| L3
    EB -->|Every 5m| L4

    L1 -->|Scan| Target
    L1 -->|Save| DB
    
    L2 -->|Query| CW
    L2 -->|Save| DB
    
    L3 -->|Read| DB
    L3 <--> Bedrock
    L3 -->|Write Alerts| DB
    
    L4 -->|Read Alerts| DB
    L4 -->|Execute Remediation| Target
    
    L5 -->|Read Context| DB
    L5 <--> Bedrock
```

## 🔐 Security by Design

Giving an AI the "keys to the kingdom" is dangerous. SkyMind implements strict boundaries:
- **Least-Privilege IAM**: The Scanner, Metrics, and Analyzer agents have **Read-Only** access. Only the Healer agent has Write access, restricted to specific non-destructive actions.
- **Human-in-the-Loop**: Destructive actions (like terminating an instance) are never automated. SkyMind flags them as alerts requiring explicit human approval via the dashboard.
- **In-Account Deployment**: All data processing stays within your AWS boundaries. No logs or metrics are ever sent to third-party SaaS providers outside of Amazon Bedrock.

## 💻 Tech Stack

- **Frontend**: Next.js 14, React 18, D3.js (Force-directed graphs), Lucide Icons, Pure CSS (Glassmorphism design system)
- **Backend**: Node.js 18 on AWS Lambda, API Gateway
- **Database**: Amazon DynamoDB (Single-table design principles)
- **AI/ML**: Amazon Bedrock (Anthropic Claude 3 Haiku for analyzing anomalies and powering NL Ops)
- **Infrastructure as Code**: AWS CDK (TypeScript/JavaScript)

## 🛠️ How to Run Locally (Mock Mode)

The frontend comes with a built-in mock/simulation mode so you can test the UI and see the dashboard immediately without deploying to AWS.

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000` in your browser.

## ☁️ How to Integrate SkyMind (Enterprise Deployment)

SkyMind is designed for **instant, secure integration** into any AWS environment. It does not require you to rewrite your existing applications or change your infrastructure.

### The CI/CD Pipeline & OIDC Security Model

When integrating third-party tools, security is the highest priority. SkyMind uses **AWS OpenID Connect (OIDC)** and GitHub Actions for deployment.
* ❌ **No long-lived AWS IAM Users or static credentials are used.**
* ✅ GitHub and AWS use temporary, 1-hour STS tokens to authenticate.
* ✅ All permissions are scoped strictly to the deployment role and the repository.

### Integration Steps

To deploy this AI agent directly into your AWS account to begin scanning for bugs and cost waste:

1. **Fork this Repository**: Clone or fork this codebase into your GitHub organization.
2. **Establish the OIDC Trust (One-Time Setup)**:
   An AWS Administrator runs the following in their terminal to create the OIDC connection:
   ```bash
   cd infra
   npm install
   npx cdk deploy SkyMindGitHubOidcStack
   ```
   *Copy the resulting Role ARN output.*
3. **Add the Deployment Secret in GitHub**

Navigate to your repository's secret settings:

```
Settings → Secrets and variables → Actions
```

Create a new repository secret with the following values:

| Field | Value |
|-------|-------|
| **Name** | `AWS_OIDC_ROLE_ARN` |
| **Value** | `<SkyMindGitHubDeployRole Role ARN>` |

> Paste the Role ARN you copied from the CDK deployment output.

---

4. **Configure the Frontend Environment**

Create the following file in your project:

```
skymind/frontend/.env.local
```

Add this environment variable:

```env
NEXT_PUBLIC_API_URL=<SkyMindTier1Stack.SkyMindApiEndpoint8E0146FF>
```

---

5. **Find the API Endpoint Output**

To retrieve the value for `SkyMindTier1Stack.SkyMindApiEndpoint8E0146FF`:

1. Go to **GitHub → Actions**
2. Click on the **latest deployment workflow**
3. Open the **Deploy** job
4. Find the step where CDK deploys the main stack
5. Scroll down to the **Outputs** section


**Result**: Within 5 minutes, the SkyMind active scanners will wake up, map your entire AWS architecture, flag failing resources, identify idle costs, and expose the data to the Next.js React Dashboard.

