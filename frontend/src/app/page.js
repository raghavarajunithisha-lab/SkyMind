'use client';

import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import InfraMap from '../components/InfraMap';
import HealthPanel from '../components/HealthPanel';
import CostPanel from '../components/CostPanel';
import ChatPanel from '../components/ChatPanel';
import AlertFeed from '../components/AlertFeed';
import { fetchResources, fetchMetrics, fetchCostData, fetchAlerts } from '../lib/api';

export default function Dashboard() {
    const [resources, setResources] = useState(null);
    const [connections, setConnections] = useState(null);
    const [metrics, setMetrics] = useState(null);
    const [costData, setCostData] = useState(null);
    const [alerts, setAlerts] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                const [resData, metricsData, cost, alertsData] = await Promise.all([
                    fetchResources(),
                    fetchMetrics(),
                    fetchCostData(),
                    fetchAlerts(),
                ]);
                setResources(resData.resources);
                setConnections(resData.connections);
                setMetrics(metricsData);
                setCostData(cost);
                setAlerts(alertsData);
            } catch (err) {
                console.error('Failed to load dashboard data:', err);
            } finally {
                setLoading(false);
            }
        }
        loadData();

        // Poll for updates every 30 seconds
        const interval = setInterval(loadData, 30000);
        return () => clearInterval(interval);
    }, []);

    const stats = resources ? {
        total: resources.length,
        healthy: resources.filter(r => r.status === 'healthy').length,
        warnings: resources.filter(r => r.status === 'warning').length,
        critical: resources.filter(r => r.status === 'critical').length,
    } : {};

    if (loading) {
        return (
            <div className="app-container">
                <Sidebar stats={{}} />
                <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            fontSize: '3rem',
                            marginBottom: '16px',
                            animation: 'pulse-dot 2s ease-in-out infinite',
                        }}>🧠</div>
                        <h2 style={{
                            background: 'var(--accent-gradient)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            fontSize: '1.5rem',
                            fontWeight: 700,
                        }}>SkyMind is Loading...</h2>
                        <p style={{ color: 'var(--text-tertiary)', marginTop: '8px', fontSize: '0.85rem' }}>
                            Scanning your infrastructure
                        </p>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="app-container">
            <Sidebar stats={stats} />

            <main className="main-content">
                {/* Header */}
                <header className="dashboard-header">
                    <h1>Infrastructure Overview</h1>
                    <div className="header-status">
                        <div className="status-dot" />
                        <span>Live • {stats.total} resources monitored • us-east-1</span>
                    </div>
                </header>

                {/* Dashboard Grid — 3 columns */}
                <div className="dashboard-grid">
                    {/* Left Column: Infrastructure Map + Cost */}
                    <div className="grid-column">
                        <InfraMap resources={resources} connections={connections} />
                        <CostPanel costData={costData} />
                    </div>

                    {/* Center Column: Health Monitor */}
                    <div className="grid-column">
                        <HealthPanel resources={resources} metrics={metrics} />
                    </div>

                    {/* Right Column: Chat + Alerts */}
                    <div className="grid-column">
                        <ChatPanel />
                        <AlertFeed alerts={alerts} />
                    </div>
                </div>
            </main>
        </div>
    );
}
