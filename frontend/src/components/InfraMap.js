'use client';

import { useEffect, useRef } from 'react';
import { Network } from 'lucide-react';
import { serviceColors } from '../lib/mockData';

export default function InfraMap({ resources, connections }) {
    const svgRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!resources || !svgRef.current) return;
        const safeConnections = connections || [];

        import('d3').then(d3 => {
            const container = containerRef.current || svgRef.current.parentElement;
            if (!container) return;
            const width = container.clientWidth || 600;
            const height = container.clientHeight || 400;

            const svg = d3.select(svgRef.current);
            svg.selectAll('*').remove();
            svg.attr('viewBox', `0 0 ${width} ${height}`);

            const defs = svg.append('defs');

            // Glow filter
            const filter = defs.append('filter').attr('id', 'glow');
            filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
            const feMerge = filter.append('feMerge');
            feMerge.append('feMergeNode').attr('in', 'coloredBlur');
            feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

            // --- Clean up AWS names ---
            function cleanName(name, type) {
                if (!name) return type || '?';
                // Remove common CDK prefixes
                let clean = name
                    .replace(/SkyMindTier1Stack-/gi, '')
                    .replace(/SkyMindGitHubOidcStack-/gi, '')
                    .replace(/skymindtier1stack-/gi, '')
                    .replace(/cdk-[a-z0-9]+-/gi, '')
                    .replace(/-[A-Z0-9]{8,}$/g, '') // Remove trailing CDK hash like -A1B2C3D4
                    .replace(/-[a-z0-9]{10,}$/g, ''); // Remove trailing lowercase hash
                // If still too long, truncate
                if (clean.length > 20) clean = clean.substring(0, 18) + '…';
                return clean || type || '?';
            }

            // Prepare nodes
            const nodes = resources.map(r => ({
                ...r,
                shortName: cleanName(r.name, r.type),
                radius: getNodeRadius(r.type),
                color: serviceColors[r.type] || '#888',
            }));

            const nodeMap = {};
            nodes.forEach(n => { nodeMap[n.id] = n; });

            const links = safeConnections
                .filter(c => nodeMap[c.source] && nodeMap[c.target])
                .map(c => ({ source: c.source, target: c.target }));

            // --- Hierarchical Y positioning by layer ---
            const layerOrder = {
                'CloudFront': 0,
                'ELB': 1,
                'APIGateway': 1,
                'Lambda': 2,
                'EC2': 2,
                'DynamoDB': 3,
                'RDS': 3,
                'S3': 3,
            };
            const layerCount = 4;
            const yPadding = 50;
            const usableHeight = height - yPadding * 2;

            window.__skymindPositions = window.__skymindPositions || {};

            nodes.forEach(n => {
                const layer = layerOrder[n.type] !== undefined ? layerOrder[n.type] : 2;

                if (window.__skymindPositions[n.id]) {
                    // Restore previous position to stop jumping
                    n.x = window.__skymindPositions[n.id].x;
                    n.y = window.__skymindPositions[n.id].y;
                    n.fx = window.__skymindPositions[n.id].fx || null;
                    n.fy = window.__skymindPositions[n.id].fy || null;
                } else {
                    // Set initial Y based on layer
                    n.fy = yPadding + (layer / (layerCount - 1)) * usableHeight;
                }
            });

            // Force simulation — mostly horizontal spreading
            const simulation = d3.forceSimulation(nodes)
                .force('link', d3.forceLink(links).id(d => d.id).distance(140).strength(0.2))
                .force('charge', d3.forceManyBody().strength(-200))
                .force('x', d3.forceX(width / 2).strength(0.05))
                .force('collision', d3.forceCollide(d => d.radius + 25))
                .alphaDecay(0.03);

            // Zoomable group
            const zoomGroup = svg.append('g').attr('class', 'zoom-group');
            const zoomObj = d3.zoom()
                .scaleExtent([0.3, 3])
                .on('zoom', (event) => zoomGroup.attr('transform', event.transform));
            svg.call(zoomObj);
            // Store initial transform for reset, and d3 ref for zoom handlers
            window.__skymindZoom = { svg, zoom: zoomObj, d3, initialTransform: d3.zoomIdentity };

            // Draw links
            const link = zoomGroup.append('g')
                .selectAll('line')
                .data(links)
                .join('line')
                .attr('stroke', 'rgba(255, 255, 255, 0.08)')
                .attr('stroke-width', 1);

            // Draw nodes
            const nodeGroup = zoomGroup.append('g')
                .selectAll('g')
                .data(nodes)
                .join('g')
                .attr('class', 'infra-node')
                .call(d3.drag()
                    .on('start', dragstarted)
                    .on('drag', dragged)
                    .on('end', dragended));

            // Outer ring
            nodeGroup.append('circle')
                .attr('r', d => d.radius)
                .attr('fill', d => d.color)
                .attr('fill-opacity', 0.12)
                .attr('stroke', d => d.color)
                .attr('stroke-width', 1.5)
                .attr('filter', d => d.status !== 'healthy' ? 'url(#glow)' : null);

            // Inner dot
            nodeGroup.append('circle')
                .attr('r', d => d.radius * 0.45)
                .attr('fill', d => {
                    if (d.status === 'critical') return '#ff1744';
                    if (d.status === 'warning') return '#ffab00';
                    return d.color;
                })
                .attr('fill-opacity', 0.9);

            // Emoji icon
            nodeGroup.append('text')
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'central')
                .attr('font-size', d => d.radius * 0.55)
                .attr('pointer-events', 'none')
                .text(d => getServiceEmoji(d.type));

            // Short label below
            nodeGroup.append('text')
                .attr('class', 'node-label')
                .attr('dy', d => d.radius + 12)
                .attr('font-size', '8px')
                .attr('font-weight', '500')
                .attr('fill', '#ccc')
                .attr('text-anchor', 'middle')
                .attr('pointer-events', 'none')
                .text(d => d.shortName);

            // Type tag
            nodeGroup.append('text')
                .attr('class', 'node-sublabel')
                .attr('dy', d => d.radius + 22)
                .attr('font-size', '7px')
                .attr('fill', '#666')
                .attr('text-anchor', 'middle')
                .attr('pointer-events', 'none')
                .text(d => d.type);

            // Tooltip for full name
            nodeGroup.append('title')
                .text(d => `${d.name}\n(${d.type})`);

            // Pulse ring for unhealthy nodes
            nodeGroup.filter(d => d.status !== 'healthy')
                .append('circle')
                .attr('r', d => d.radius)
                .attr('fill', 'none')
                .attr('stroke', d => d.status === 'critical' ? '#ff1744' : '#ffab00')
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
                            .attr('r', parentData.radius + 10)
                            .attr('opacity', 0)
                            .on('end', repeat);
                    })();
                });

            simulation.on('tick', () => {
                link
                    .attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);

                nodeGroup.attr('transform', d => {
                    d.x = Math.max(50, Math.min(width - 50, d.x));
                    window.__skymindPositions[d.id] = { x: d.x, y: d.y, fx: d.fx, fy: d.fy };
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
                // Keep Y locked to layer
                // event.subject.fy = null;
            }
            let selectedNodeId = null;

            function updateSelection() {
                if (!selectedNodeId) {
                    nodeGroup.transition().duration(200).attr('opacity', 1);
                    link.transition().duration(200)
                        .attr('stroke', 'rgba(255, 255, 255, 0.08)')
                        .attr('stroke-width', 1);
                    return;
                }

                // Find connected node IDs
                const connectedIds = new Set([selectedNodeId]);
                links.forEach(l => {
                    const srcId = l.source.id || l.source;
                    const tgtId = l.target.id || l.target;
                    if (srcId === selectedNodeId) connectedIds.add(tgtId);
                    if (tgtId === selectedNodeId) connectedIds.add(srcId);
                });

                nodeGroup.transition().duration(200)
                    .attr('opacity', d => connectedIds.has(d.id) ? 1 : 0.1);

                link.transition().duration(200)
                    .attr('stroke', d => {
                        const srcId = d.source.id || d.source;
                        const tgtId = d.target.id || d.target;
                        return (srcId === selectedNodeId || tgtId === selectedNodeId)
                            ? 'rgba(0, 230, 118, 0.5)' // Bright green for highlighted links
                            : 'rgba(255, 255, 255, 0.02)';
                    })
                    .attr('stroke-width', d => {
                        const srcId = d.source.id || d.source;
                        const tgtId = d.target.id || d.target;
                        return (srcId === selectedNodeId || tgtId === selectedNodeId) ? 2 : 1;
                    });
            }

            svg.on('click', (event) => {
                if (event.target === svg.node()) {
                    selectedNodeId = null;
                    updateSelection();
                }
            });

            nodeGroup.on('click', (event, d) => {
                event.stopPropagation();
                if (selectedNodeId === d.id) {
                    selectedNodeId = null; // Toggle off if clicked again
                } else {
                    selectedNodeId = d.id;
                }
                updateSelection();
            });

            return () => simulation.stop();
        });
    }, [resources, connections]);

    const handleZoomIn = () => {
        if (window.__skymindZoom) {
            const { svg, zoom, d3 } = window.__skymindZoom;
            svg.transition().duration(250).call(zoom.scaleBy, 1.3);
        }
    };

    const handleZoomOut = () => {
        if (window.__skymindZoom) {
            const { svg, zoom, d3 } = window.__skymindZoom;
            svg.transition().duration(250).call(zoom.scaleBy, 0.7);
        }
    };

    const handleZoomReset = () => {
        if (window.__skymindZoom) {
            const { svg, zoom, d3, initialTransform } = window.__skymindZoom;
            svg.transition().duration(250).call(zoom.transform, initialTransform);
        }
    };

    return (
        <div className="glass-panel infra-map-wrapper">
            <div className="panel-header">
                <h2><Network className="panel-icon" /> Infrastructure Map</h2>
                <span className="panel-badge">{resources?.length || 0} Resources</span>
            </div>
            <div ref={containerRef} className="panel-body" style={{ flex: 1, position: 'relative', padding: 0, minHeight: 0 }}>
                <svg ref={svgRef} style={{ width: '100%', height: '100%', display: 'block' }} />

                {/* Zoom Controls */}
                <div style={{ position: 'absolute', bottom: '12px', right: '12px', zIndex: 10, display: 'flex', gap: '4px' }}>
                    <button onClick={handleZoomOut} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 10px', color: '#aaa', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>−</button>
                    <button onClick={handleZoomIn} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 10px', color: '#aaa', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>+</button>
                    <button onClick={handleZoomReset} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 10px', color: '#aaa', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>⟲</button>
                </div>
            </div>
        </div>
    );
}

function getNodeRadius(type) {
    const sizes = { 'ELB': 20, 'CloudFront': 20, 'EC2': 18, 'RDS': 18, 'Lambda': 14, 'S3': 14, 'DynamoDB': 14, 'APIGateway': 16 };
    return sizes[type] || 14;
}

function getServiceEmoji(type) {
    const emojis = { 'EC2': '🖥️', 'RDS': '🗄️', 'Lambda': '⚡', 'S3': '📦', 'DynamoDB': '🔋', 'APIGateway': '🔗', 'ELB': '⚖️', 'CloudFront': '🌐' };
    return emojis[type] || '⬡';
}
