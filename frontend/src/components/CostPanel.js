'use client';

import { DollarSign, TrendingDown, AlertTriangle } from 'lucide-react';

export default function CostPanel({ costData }) {
    if (!costData) return null;

    const maxAmount = Math.max(...costData.breakdown.map(s => s.amount));

    return (
        <div className="glass-panel cost-panel-wrapper">
            <div className="panel-header">
                <h2><DollarSign className="panel-icon" /> Cost Optimizer</h2>
                <span className="panel-badge">{costData.waste.length} Opportunities</span>
            </div>
            <div className="panel-body">
                {/* Cost summary cards */}
                <div className="cost-summary">
                    <div className="cost-card">
                        <div className="amount">${costData.totalMonthly.toLocaleString()}</div>
                        <div className="label">Current Monthly</div>
                    </div>
                    <div className="cost-card savings">
                        <div className="amount">-${costData.projectedSavings.toLocaleString()}</div>
                        <div className="label">Potential Savings</div>
                    </div>
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

                {/* Waste alerts */}
                {costData.waste.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                            💡 Optimization Opportunities
                        </div>
                        {costData.waste.map((item, i) => (
                            <div key={i} className="alert-item warning" style={{ marginBottom: '6px' }}>
                                <AlertTriangle className="alert-icon" style={{ color: 'var(--status-warning)' }} />
                                <div className="alert-content">
                                    <div className="alert-title">{item.resource} — {item.savings}</div>
                                    <div className="alert-desc">{item.issue}. Action: {item.action}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
