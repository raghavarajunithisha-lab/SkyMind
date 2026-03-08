import './globals.css';

export const metadata = {
    title: 'SkyMind — AI-Powered Cloud Infrastructure Brain',
    description: 'Self-healing, self-optimizing cloud infrastructure monitoring with AI. Real-time visualization, predictive failure detection, cost optimization, and natural language ops.',
    keywords: 'AWS, cloud infrastructure, AI, monitoring, self-healing, DevOps, SRE, cost optimization',
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
            </head>
            <body>
                {children}
            </body>
        </html>
    );
}
