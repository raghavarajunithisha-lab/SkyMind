'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { sendChatMessage } from '../lib/api';
import { mockChatHistory } from '../lib/mockData';

export default function ChatPanel() {
    const [messages, setMessages] = useState(mockChatHistory);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isTyping) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsTyping(true);

        try {
            const data = await sendChatMessage(userMessage);
            setMessages(prev => [...prev, { role: 'ai', content: data.response }]);
        } catch {
            setMessages(prev => [...prev, { role: 'ai', content: '❌ Sorry, I encountered an error analyzing your infrastructure. Please try again.' }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Suggested questions
    const suggestions = [
        'Why is latency high?',
        'How can I reduce costs?',
        'Give me a status overview',
    ];

    return (
        <div className="glass-panel" style={{ flex: 1, minWidth: 0 }}>
            <div className="panel-header">
                <h2><MessageSquare className="panel-icon" /> AI Chat</h2>
                <span className="panel-badge">Bedrock</span>
            </div>
            <div className="chat-container">
                <div className="chat-messages">
                    {messages.map((msg, i) => (
                        <div key={i} className={`chat-message ${msg.role === 'user' ? 'user' : 'ai'}`}>
                            <div className={`chat-avatar ${msg.role === 'user' ? 'human' : 'ai'}`}>
                                {msg.role === 'user' ? 'U' : '🧠'}
                            </div>
                            <div className="chat-bubble">
                                {msg.content.split('\n').map((line, j) => (
                                    <span key={j}>
                                        {line.replace(/\*\*(.*?)\*\*/g, '«$1»')}
                                        {j < msg.content.split('\n').length - 1 && <br />}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}

                    {isTyping && (
                        <div className="chat-message ai">
                            <div className="chat-avatar ai">🧠</div>
                            <div className="chat-bubble" style={{ color: 'var(--text-tertiary)' }}>
                                Analyzing your infrastructure...
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Suggestion chips when no messages sent yet */}
                {messages.length <= 1 && (
                    <div style={{ padding: '0 16px 8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {suggestions.map((s, i) => (
                            <button
                                key={i}
                                onClick={() => { setInput(s); }}
                                style={{
                                    background: 'var(--bg-tertiary)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '20px',
                                    padding: '5px 12px',
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.72rem',
                                    cursor: 'pointer',
                                    fontFamily: 'Inter, sans-serif',
                                    transition: 'all 0.2s',
                                }}
                                onMouseOver={e => { e.target.style.borderColor = 'var(--border-accent)'; e.target.style.color = 'var(--text-primary)'; }}
                                onMouseOut={e => { e.target.style.borderColor = 'var(--border-subtle)'; e.target.style.color = 'var(--text-secondary)'; }}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                )}

                <div className="chat-input-wrapper">
                    <div className="chat-input">
                        <input
                            type="text"
                            placeholder="Ask about your infrastructure..."
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isTyping}
                        />
                        <button onClick={handleSend} disabled={isTyping || !input.trim()}>
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
