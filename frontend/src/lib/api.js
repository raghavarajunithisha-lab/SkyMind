// API client — switches between mock data (local) and real API (deployed)
import { mockResources, mockConnections, mockMetrics, mockCostData, mockAlerts, getAIResponse } from './mockData';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || null;
const USE_MOCK = !API_BASE;

export async function fetchResources() {
    if (USE_MOCK) return { resources: mockResources, connections: mockConnections };
    const res = await fetch(`${API_BASE}/resources`);
    return res.json();
}

export async function fetchMetrics() {
    if (USE_MOCK) return mockMetrics;
    const res = await fetch(`${API_BASE}/metrics`);
    return res.json();
}

export async function fetchCostData() {
    if (USE_MOCK) return mockCostData;
    const res = await fetch(`${API_BASE}/cost`);
    return res.json();
}

export async function fetchAlerts() {
    if (USE_MOCK) return mockAlerts;
    const res = await fetch(`${API_BASE}/alerts`);
    return res.json();
}

export async function sendChatMessage(message) {
    if (USE_MOCK) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));
        return { response: getAIResponse(message) };
    }
    const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
    });
    return res.json();
}
