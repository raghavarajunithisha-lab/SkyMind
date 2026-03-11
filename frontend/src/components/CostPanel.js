'use client';

import { useMemo } from 'react';
import { DollarSign, AlertTriangle } from 'lucide-react';

export default function CostPanel({ costData, resources, metrics }) {
    if (!costData || !costData.breakdown || !Array.isArray(costData.breakdown)) return null;

    const maxAmount = Math.max(...costData.breakdown.map(s => s.amount));

    // Dynamically generate optimization suggestions from real warning data
    const dynamicOptimizations = useMemo(() => {
        const suggestions = [];
        const metricsLookup = (metrics && typeof metrics === 'object' && !metrics.message) ? metrics : {};

        if (!resources || !Array.isArray(resources)) return suggestions;

        resources.forEach(r => {
            const m = metricsLookup[r.id];
            if (!m) return;

            const latency = Number(m.latency) || 0;
            const duration = Number(m.duration) || 0;
            const invocations = Number(m.invocations) || 0;
            const cpu = Number(m.cpu) || 0;
            const readCap = Number(m.readCapacity) || 0;

            // API Gateway high latency → suggest caching
            if (r.type === 'APIGateway' && latency > 500) {
                suggestions.push({
                    service: r.name || 'API Gateway',
                    issue: `High latency detected (${latency.toFixed(0)}ms avg). Enable API caching to reduce backend calls and improve response times.`,
                    action: 'Enable API Gateway caching',
                });
            }

            // Lambda high duration → suggest memory optimization
            if (r.type === 'Lambda' && duration > 1000) {
                suggestions.push({
                    service: r.name || 'Lambda',
                    issue: `High execution time (${duration.toFixed(0)}ms). Consider increasing memory allocation or optimizing code to reduce cold starts.`,
                    action: 'Optimize Lambda memory/code',
                });
            }

            // Lambda with zero invocations → suggest deletion
            if (r.type === 'Lambda' && invocations === 0) {
                suggestions.push({
                    service: r.name || 'Lambda',
                    issue: `No invocations detected. This function may be unused — consider removing it to reduce clutter.`,
                    action: 'Review & remove if unused',
                });
            }

            // EC2 low CPU → suggest downsizing
            if (r.type === 'EC2' && cpu > 0 && cpu < 10) {
                suggestions.push({
                    service: r.name || 'EC2',
                    issue: `Very low CPU utilization (${cpu.toFixed(1)}%). Consider downsizing the instance type to save costs.`,
                    action: 'Downsize instance',
                });
            }

            // DynamoDB high read capacity → suggest on-demand
            if (r.type === 'DynamoDB' && readCap > 15) {
                suggestions.push({
                    service: r.name || 'DynamoDB',
                    issue: `High read capacity usage (${readCap.toFixed(1)}). Consider switching to on-demand billing if traffic is unpredictable.`,
                    action: 'Switch to on-demand mode',
                });
            }
        });

        return suggestions;
    }, [resources, metrics]);

    // Combine API suggestions with dynamic ones
    const allOptimizations = [...(costData.waste || []), ...dynamicOptimizations];
    const totalProjectedSavings = costData.projectedSavings || 0;

    return (
        <div className="glass-panel cost-panel-wrapper">
            <div className="panel-header">
                <h2><DollarSign className="panel-icon" /> Cost Optimizer</h2>
                <span className="panel-badge">{allOptimizations.length} Opportunities</span>
            </div>
            <div className="panel-body">
                {/* Cost summary cards */}
                <div className="cost-summary">
                    <div className="cost-card">
                        <div className="amount">${costData.totalMonthly.toLocaleString()}</div>
                        <div className="label">Current Monthly</div>
                    </div>
                    {totalProjectedSavings > 0 && (
                        <div className="cost-card savings">
                            <div className="amount">-${totalProjectedSavings.toLocaleString()}</div>
                            <div className="label">Potential Savings</div>
                        </div>
                    )}
                </div>

                {/* Cost breakdown by service */}
                <div className="cost-breakdown">
                    {costData.breakdown.map((service, i) => (
                        <div key={i} className="cost-row">
                            <div
                                className="cost-color-dot"
                                style={{ background: service.color }}
                            />
                            <span className="cost-service-name">{service.service}</span>
                            <div className="cost-service-bar-wrapper">
                                <div
                                    className="cost-service-bar"
                                    style={{
                                        width: `${(service.amount / maxAmount) * 100}%`,
                                        background: service.color,
                                    }}
                                />
                            </div>
                            <span className="cost-service-amount">${service.amount}</span>
                        </div>
                    ))}
                </div>

                {/* Dynamic optimization opportunities */}
                {allOptimizations.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                            💡 Optimization Opportunities
                        </div>
                        {allOptimizations.map((item, i) => (
                            <div key={i} className="alert-item warning" style={{ marginBottom: '6px' }}>
                                <AlertTriangle className="alert-icon" style={{ color: 'var(--status-warning)', flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                                        {item.service}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                                        {item.issue}
                                    </div>
                                    {item.action && (
                                        <div style={{ fontSize: '0.68rem', color: 'var(--status-warning)', marginTop: '4px', fontWeight: 500 }}>
                                            → {item.action}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {allOptimizations.length === 0 && (
                    <div style={{ marginTop: '16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.78rem', padding: '12px' }}>
                        ✅ No optimization opportunities detected. Your infrastructure is running efficiently.
                    </div>
                )}
            </div>
        </div>
    );
}
