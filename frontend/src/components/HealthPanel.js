'use client';

import { useState } from 'react';
import { Activity } from 'lucide-react';
import { serviceIcons } from '../lib/mockData';

export default function HealthPanel({ resources, metrics }) {
    const [hoveredMetric, setHoveredMetric] = useState(null);

    if (!resources) return null;
    const metricsLookup = (metrics && typeof metrics === 'object' && !metrics.message) ? metrics : {};

    const getStatusClass = (status) => {
        if (status === 'critical') return 'critical';
        if (status === 'warning') return 'warning';
        return 'healthy';
    };

    const calcPercent = (value, maxScale) => {
        const num = parseFloat(value);
        if (isNaN(num) || num <= 0) return 0;
        const p = (num / maxScale) * 100;
        return Math.min(Math.max(p, 2), 100);
    };

    // Each metric now includes: label, value, percent, max (threshold), unit, reason (if warning)
    const getMainMetrics = (resource) => {
        const m = metricsLookup[resource.id];
        if (!m) return [];

        const buildMetric = (label, rawValue, maxScale, unit, thresholds) => {
            const num = parseFloat(rawValue);
            const displayValue = isNaN(num) ? '-' : (unit ? `${rawValue}${unit}` : rawValue);
            const percent = calcPercent(rawValue, maxScale);
            const barStatus = getBarClass(percent);

            let reason = null;
            if (thresholds && !isNaN(num) && num > 0) {
                if (thresholds.critical !== undefined && num >= thresholds.critical) {
                    reason = `${label} is ${displayValue} — exceeds critical threshold of ${thresholds.critical}${unit || ''}`;
                } else if (thresholds.warning !== undefined && num >= thresholds.warning) {
                    reason = `${label} is ${displayValue} — exceeds warning threshold of ${thresholds.warning}${unit || ''}`;
                }
            }

            return {
                label,
                value: displayValue,
                percent,
                max: maxScale,
                unit: unit || '',
                reason,
                barStatus,
            };
        };

        switch (resource.type) {
            case 'EC2':
                return [
                    buildMetric('CPU', m.cpu, 100, '%', { warning: 60, critical: 85 }),
                    buildMetric('Memory', m.memory, 100, '%', { warning: 70, critical: 90 }),
                    buildMetric('Latency', m.latency, 300, 'ms', { warning: 200, critical: 500 }),
                ];
            case 'RDS':
                return [
                    buildMetric('CPU', m.cpu, 100, '%', { warning: 60, critical: 85 }),
                    buildMetric('Connections', m.connections, 100, '', { warning: 50, critical: 80 }),
                    buildMetric('IOPS', m.iops || 0, 3000, '', { warning: 2000, critical: 2800 }),
                ];
            case 'Lambda':
                return [
                    buildMetric('Invocations', m.invocations, 1000, '', null),
                    buildMetric('Errors', m.errors, Math.max(m.invocations || 1, 10), '', { warning: 1, critical: 5 }),
                    buildMetric('Duration', m.duration, 3000, 'ms', { warning: 1000, critical: 2500 }),
                ];
            case 'DynamoDB':
                return [
                    buildMetric('Read Cap', m.readCapacity, 25, '', { warning: 15, critical: 22 }),
                    buildMetric('Write Cap', m.writeCapacity, 25, '', { warning: 15, critical: 22 }),
                    buildMetric('Latency', m.latency, 10, 'ms', { warning: 5, critical: 8 }),
                ];
            default:
                return [
                    buildMetric('Requests', m.requests, 1000, '', null),
                    buildMetric('Latency', m.latency, 1000, 'ms', { warning: 500, critical: 2000 }),
                ];
        }
    };

    const getBarClass = (percent) => {
        if (percent > 80) return 'critical';
        if (percent > 60) return 'warning';
        return 'healthy';
    };

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
                    {sortedResources.map(resource => {
                        const metricsForResource = getMainMetrics(resource);
                        const hasWarning = resource.status === 'warning' || resource.status === 'critical';
                        const warningReasons = metricsForResource.filter(m => m.reason).map(m => m.reason);

                        return (
                            <div key={resource.id} className={`health-card ${hasWarning ? 'health-card--warning' : ''}`}>
                                <div className="health-card-header">
                                    <span className="health-card-service">
                                        {serviceIcons[resource.type]} {resource.name}
                                    </span>
                                    <div className={`health-card-status ${getStatusClass(resource.status)}`} />
                                </div>

                                {/* Warning banner when resource has elevated status */}
                                {hasWarning && warningReasons.length > 0 && (
                                    <div className="health-card-warning-banner">
                                        <span className="warning-icon">⚠️</span>
                                        <div className="warning-reasons">
                                            {warningReasons.map((reason, i) => (
                                                <div key={i} className="warning-reason-text">{reason}</div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {metricsForResource.map((metric, i) => {
                                    const metricKey = `${resource.id}-${metric.label}`;
                                    const isHovered = hoveredMetric === metricKey;

                                    return (
                                        <div
                                            key={i}
                                            className="health-metric-row"
                                            onMouseEnter={() => setHoveredMetric(metricKey)}
                                            onMouseLeave={() => setHoveredMetric(null)}
                                            style={{ position: 'relative' }}
                                        >
                                            <div className="health-metric">
                                                <span className="health-metric-label">{metric.label}</span>
                                                <span className="health-metric-value">{metric.value}</span>
                                            </div>
                                            <div className="health-bar">
                                                <div
                                                    className={`health-bar-fill ${metric.barStatus}`}
                                                    style={{ width: `${Math.min(metric.percent, 100)}%` }}
                                                />
                                            </div>

                                            {/* Hover tooltip */}
                                            {isHovered && (
                                                <div className="health-tooltip">
                                                    <div className="health-tooltip-row">
                                                        <span>Current:</span>
                                                        <strong>{metric.value}</strong>
                                                    </div>
                                                    <div className="health-tooltip-row">
                                                        <span>Scale Max:</span>
                                                        <strong>{metric.max}{metric.unit}</strong>
                                                    </div>
                                                    {metric.reason && (
                                                        <div className="health-tooltip-warning">
                                                            ⚠️ {metric.reason}
                                                        </div>
                                                    )}
                                                    {!metric.reason && (
                                                        <div className="health-tooltip-ok">
                                                            ✅ Within normal range
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
