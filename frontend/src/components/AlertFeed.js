'use client';

import { Bell, AlertTriangle, AlertCircle, CheckCircle, Info } from 'lucide-react';

const severityConfig = {
    critical: { icon: AlertTriangle, color: 'var(--status-critical)' },
    warning: { icon: AlertCircle, color: 'var(--status-warning)' },
    info: { icon: Info, color: 'var(--status-info)' },
    resolved: { icon: CheckCircle, color: 'var(--status-healthy)' },
};

export default function AlertFeed({ alerts }) {
    if (!alerts || !Array.isArray(alerts)) return null;

    const unresolvedCount = alerts.filter(a => !a.resolved).length;

    return (
        <div className="glass-panel" style={{ flex: 1, minWidth: 0 }}>
            <div className="panel-header">
                <h2><Bell className="panel-icon" /> Alerts</h2>
                <span className={`panel-badge ${unresolvedCount > 0 ? 'warning' : ''}`}>
                    {unresolvedCount} Active
                </span>
            </div>
            <div className="panel-body">
                <div className="alert-list">
                    {alerts.map(alert => {
                        const config = severityConfig[alert.resolved ? 'resolved' : alert.severity] || severityConfig.info;
                        const Icon = config.icon;

                        return (
                            <div key={alert.id} className={`alert-item ${alert.resolved ? 'resolved' : alert.severity}`}>
                                <Icon className="alert-icon" style={{ color: config.color }} />
                                <div className="alert-content">
                                    <div className="alert-title">{alert.title}</div>
                                    <div className="alert-desc">{alert.description}</div>
                                </div>
                                <span className="alert-time">{alert.time}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
