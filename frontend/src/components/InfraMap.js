'use client';

import { useEffect, useRef } from 'react';
import { Network } from 'lucide-react';
import { serviceColors } from '../lib/mockData';

export default function InfraMap({ resources, connections }) {
    const svgRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!resources || !svgRef.current || !containerRef.current) return;
        const safeConnections = connections || [];

        // Dynamically import d3 on client side only
        import('d3').then(d3 => {
            const container = containerRef.current;
            const width = container.clientWidth;
            const height = container.clientHeight;

            const svg = d3.select(svgRef.current);
            svg.selectAll('*').remove();
            svg.attr('viewBox', `0 0 ${width} ${height}`);

            // Build defs for gradients and filters
            const defs = svg.append('defs');

            // Glow filter
            const filter = defs.append('filter').attr('id', 'glow');
            filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
            const feMerge = filter.append('feMerge');
            feMerge.append('feMergeNode').attr('in', 'coloredBlur');
            feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

            // Prepare nodes and links
            const nodes = resources.map(r => ({
                ...r,
                radius: getNodeRadius(r.type),
                color: serviceColors[r.type] || '#64748b',
            }));

            const nodeMap = {};
            nodes.forEach(n => { nodeMap[n.id] = n; });

            const links = safeConnections
                .filter(c => nodeMap[c.source] && nodeMap[c.target])
                .map(c => ({
                    source: c.source,
                    target: c.target,
                }));

            // Force simulation
            const simulation = d3.forceSimulation(nodes)
                .force('link', d3.forceLink(links).id(d => d.id).distance(90))
                .force('charge', d3.forceManyBody().strength(-250))
                .force('center', d3.forceCenter(width / 2, height / 2))
                .force('collision', d3.forceCollide().radius(d => d.radius + 15));

            // Draw links
            const link = svg.append('g')
                .selectAll('line')
                .data(links)
                .join('line')
                .attr('class', 'link-line')
                .attr('stroke', 'rgba(148, 163, 184, 0.15)')
                .attr('stroke-width', 1.5);

            // Draw nodes
            const nodeGroup = svg.append('g')
                .selectAll('g')
                .data(nodes)
                .join('g')
                .attr('class', 'infra-node')
                .call(d3.drag()
                    .on('start', dragstarted)
                    .on('drag', dragged)
                    .on('end', dragended));

            // Node circle with glow
            nodeGroup.append('circle')
                .attr('r', d => d.radius)
                .attr('fill', d => d.color)
                .attr('fill-opacity', 0.2)
                .attr('stroke', d => d.color)
                .attr('stroke-width', 2)
                .attr('filter', d => d.status !== 'healthy' ? 'url(#glow)' : null);

            // Inner filled circle
            nodeGroup.append('circle')
                .attr('r', d => d.radius * 0.5)
                .attr('fill', d => {
                    if (d.status === 'critical') return '#ef4444';
                    if (d.status === 'warning') return '#f59e0b';
                    return d.color;
                })
                .attr('fill-opacity', 0.8);

            // Animated pulse ring for unhealthy nodes
            nodeGroup.filter(d => d.status !== 'healthy')
                .append('circle')
                .attr('r', d => d.radius)
                .attr('fill', 'none')
                .attr('stroke', d => d.status === 'critical' ? '#ef4444' : '#f59e0b')
                .attr('stroke-width', 1.5)
                .attr('opacity', 0.6)
                .each(function pulseAnimate() {
                    const node = d3.select(this);
                    const parentData = d3.select(this.parentNode).datum();
                    (function repeat() {
                        node
                            .attr('r', parentData.radius)
                            .attr('opacity', 0.6)
                            .transition()
                            .duration(2000)
                            .attr('r', parentData.radius + 12)
                            .attr('opacity', 0)
                            .on('end', repeat);
                    })();
                });

            // Icon emoji
            nodeGroup.append('text')
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'central')
                .attr('font-size', d => d.radius * 0.7)
                .attr('pointer-events', 'none')
                .text(d => getServiceEmoji(d.type));

            // Label below node
            nodeGroup.append('text')
                .attr('class', 'node-label')
                .attr('dy', d => d.radius + 14)
                .text(d => d.name);

            // Sub-label with type
            nodeGroup.append('text')
                .attr('class', 'node-sublabel')
                .attr('dy', d => d.radius + 25)
                .text(d => d.type);

            simulation.on('tick', () => {
                link
                    .attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);

                nodeGroup.attr('transform', d => {
                    d.x = Math.max(40, Math.min(width - 40, d.x));
                    d.y = Math.max(40, Math.min(height - 40, d.y));
                    return `translate(${d.x},${d.y})`;
                });
            });

            function dragstarted(event) {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                event.subject.fx = event.subject.x;
                event.subject.fy = event.subject.y;
            }

            function dragged(event) {
                event.subject.fx = event.x;
                event.subject.fy = event.y;
            }

            function dragended(event) {
                if (!event.active) simulation.alphaTarget(0);
                event.subject.fx = null;
                event.subject.fy = null;
            }

            return () => simulation.stop();
        });
    }, [resources, connections]);

    return (
        <div className="glass-panel infra-map-wrapper">
            <div className="panel-header">
                <h2><Network className="panel-icon" /> Infrastructure Map</h2>
                <span className="panel-badge">{resources?.length || 0} Resources</span>
            </div>
            <div className="panel-body" style={{ padding: 0 }} ref={containerRef}>
                <div className="infra-map-container">
                    <svg ref={svgRef} />
                </div>
            </div>
        </div>
    );
}

function getNodeRadius(type) {
    const sizes = { 'ELB': 22, 'CloudFront': 22, 'EC2': 20, 'RDS': 20, 'Lambda': 16, 'S3': 16, 'DynamoDB': 16, 'APIGateway': 18 };
    return sizes[type] || 16;
}

function getServiceEmoji(type) {
    const emojis = { 'EC2': '🖥️', 'RDS': '🗄️', 'Lambda': '⚡', 'S3': '📦', 'DynamoDB': '🔋', 'APIGateway': '🔗', 'ELB': '⚖️', 'CloudFront': '🌐' };
    return emojis[type] || '⬡';
}
