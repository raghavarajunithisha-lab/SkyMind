'use client';

import { Activity } from 'lucide-react';
import { serviceIcons } from '../lib/mockData';

export default function HealthPanel({ resources, metrics }) {
    if (!resources || !metrics) return null;

    const getStatusClass = (status) => {
        if (status === 'critical') return 'critical';
        if (status === 'warning') return 'warning';
        return 'healthy';
    };

    const getMainMetrics = (resource) => {
        const m = metrics[resource.id];
        if (!m) return [];

        switch (resource.type) {
            case 'EC2':
                return [
                    { label: 'CPU', value: `${m.cpu}%`, percent: m.cpu },
                    { label: 'Memory', value: `${m.memory}%`, percent: m.memory },
                    { label: 'Latency', value: `${m.latency}ms`, percent: Math.min(m.latency / 3, 100) },
                ];
            case 'RDS':
                return [
                    { label: 'CPU', value: `${m.cpu}%`, percent: m.cpu },
                    { label: 'Connections', value: m.connections, percent: (m.connections / 100) * 100 },
                    { label: 'IOPS', value: m.iops || m.replicaLag + 's lag', percent: m.cpu },
                ];
            case 'Lambda':
                return [
                    { label: 'Invocations', value: m.invocations?.toLocaleString(), percent: 50 },
                    { label: 'Errors', value: m.errors, percent: (m.errors / Math.max(m.invocations, 1)) * 1000 },
                    { label: 'Duration', value: `${m.duration}ms`, percent: Math.min(m.duration / 30, 100) },
                ];
            case 'DynamoDB':
                return [
                    { label: 'Read Cap', value: `${m.readCapacity}%`, percent: m.readCapacity },
                    { label: 'Write Cap', value: `${m.writeCapacity}%`, percent: m.writeCapacity },
                    { label: 'Latency', value: `${m.latency}ms`, percent: m.latency * 10 },
                ];
            default:
                return [
                    { label: 'Requests', value: m.requests?.toLocaleString() || '-', percent: 50 },
                    { label: 'Latency', value: m.latency ? `${m.latency}ms` : '-', percent: 30 },
                ];
        }
    };

    const getBarClass = (percent) => {
        if (percent > 80) return 'critical';
        if (percent > 60) return 'warning';
        return 'healthy';
    };

    // Sort: critical first, then warning, then healthy
    const sortedResources = [...resources].sort((a, b) => {
        const order = { critical: 0, warning: 1, healthy: 2 };
        return (order[a.status] || 2) - (order[b.status] || 2);
    });

    const criticalCount = resources.filter(r => r.status === 'critical').length;
    const warningCount = resources.filter(r => r.status === 'warning').length;
    const badgeClass = criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : '';

    return (
        <div className="glass-panel health-panel-wrapper">
            <div className="panel-header">
                <h2><Activity className="panel-icon" /> Health Monitor</h2>
                <span className={`panel-badge ${badgeClass}`}>
                    {criticalCount > 0 ? `${criticalCount} Critical` : warningCount > 0 ? `${warningCount} Warning` : 'All Healthy'}
                </span>
            </div>
            <div className="panel-body">
                <div className="health-grid">
                    {sortedResources.map(resource => (
                        <div key={resource.id} className="health-card">
                            <div className="health-card-header">
                                <span className="health-card-service">
                                    {serviceIcons[resource.type]} {resource.name}
                                </span>
                                <div className={`health-card-status ${getStatusClass(resource.status)}`} />
                            </div>
                            {getMainMetrics(resource).map((metric, i) => (
                                <div key={i}>
                                    <div className="health-metric">
                                        <span className="health-metric-label">{metric.label}</span>
                                        <span className="health-metric-value">{metric.value}</span>
                                    </div>
                                    <div className="health-bar">
                                        <div
                                            className={`health-bar-fill ${getBarClass(metric.percent)}`}
                                            style={{ width: `${Math.min(metric.percent, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
