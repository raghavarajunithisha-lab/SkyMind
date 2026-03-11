'use client';

import { useState } from 'react';
import { LayoutDashboard, Map, DollarSign, MessageSquare, Bell, Activity, Shield, Settings, Zap } from 'lucide-react';

const navItems = [
    { section: 'Overview' },
    { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
    { icon: Map, label: 'Infrastructure Map', id: 'infra' },
    { icon: Activity, label: 'Health Monitor', id: 'health' },
    { section: 'Intelligence' },
    { icon: MessageSquare, label: 'AI Chat', id: 'chat' },
    { icon: Zap, label: 'Self-Healing', id: 'healing' },
    { icon: DollarSign, label: 'Cost Optimizer', id: 'cost' },
    { section: 'Operations' },
    { icon: Bell, label: 'Alerts', id: 'alerts' },
    { icon: Shield, label: 'Security', id: 'security' },
    { icon: Settings, label: 'Settings', id: 'settings' },
];

export default function Sidebar({ stats }) {
    const [activeId, setActiveId] = useState('dashboard');

    const handleScroll = (id) => {
        setActiveId(id);
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="logo-icon">🧠</div>
                <div>
                    <h1>SkyMind</h1>
                    <span className="version">v1.0 — Tier 1</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                {navItems.map((item, i) => {
                    if (item.section) {
                        return <div key={i} className="nav-section-title">{item.section}</div>;
                    }
                    const Icon = item.icon;
                    return (
                        <div
                            key={item.id}
                            className={`nav-item ${activeId === item.id ? 'active' : ''}`}
                            onClick={() => handleScroll(item.id)}
                            style={{ cursor: 'pointer' }}
                        >
                            <Icon className="nav-icon" />
                            <span>{item.label}</span>
                        </div>
                    );
                })}
            </nav>

            <div className="sidebar-footer">
                <div className="sidebar-stats">
                    <div className="sidebar-stat">
                        <span className="label">Resources</span>
                        <span className="value">{stats?.total || 0}</span>
                    </div>
                    <div className="sidebar-stat">
                        <span className="label">Healthy</span>
                        <span className="value healthy">{stats?.healthy || 0}</span>
                    </div>
                    <div className="sidebar-stat">
                        <span className="label">Warnings</span>
                        <span className="value warning">{stats?.warnings || 0}</span>
                    </div>
                    <div className="sidebar-stat">
                        <span className="label">Region</span>
                        <span className="value">us-east-1</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}
