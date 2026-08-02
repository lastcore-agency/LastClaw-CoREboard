import { useEffect, useState, useRef, useCallback } from 'react';

interface Session { key: string; updatedAt: number; }
interface ChatMessage { role: string; text: string; }

const API = '/api/runtime';

export function ChatPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API}/sessions`)
      .then(r => r.json())
      .then(d => {
        const list = (d.data || []).map((s: any) => ({ key: s.key, updatedAt: s.updatedAt || 0 }));
        setSessions(list);
        if (list.length && !selected) setSelected(list[0].key);
      })
      .catch(e => setError(e.message));
  }, []);

  const loadHistory = useCallback(async (sessionKey: string) => {
    if (!sessionKey) return;
    try {
      const r = await fetch(`${API}/chat/${encodeURIComponent(sessionKey)}/history?limit=50`);
      const d = await r.json();
      const msgs = (d.data || []).map((m: any) => ({
        role: m.role || 'user',
        text: typeof m.content === 'string' ? m.content
          : Array.isArray(m.content) ? m.content.map((c: any) => c.text || '').join('')
          : m.text || '',
      }));
      setMessages(msgs);
    } catch (e: any) { setError(e.message); }
  }, []);

  useEffect(() => { if (selected) loadHistory(selected); }, [selected, loadHistory]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  async function send() {
    if (!input.trim() || !selected || sending) return;
    setSending(true);
    setError('');
    const msg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    try {
      const r = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, sessionKey: selected, agentId: selected.split(':')[1] || 'main' }),
      });
      const d = await r.json();
      if (d.error) {
        setError(d.error.message || d.error);
      } else {
        setTimeout(() => loadHistory(selected), 5000);
      }
    } catch (e: any) { setError(e.message); }
    setSending(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 12, gap: 8 }}>
      <select value={selected} onChange={e => setSelected(e.target.value)}
        style={{ background: '#1a1a2e', color: '#e0e0ff', border: '1px solid #333', borderRadius: 6, padding: 8 }}>
        {sessions.map(s => <option key={s.key} value={s.key}>{s.key}</option>)}
      </select>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            background: m.role === 'user' ? '#0a3d62' : '#1a1a2e',
            color: '#e0e0ff', borderRadius: 8, padding: '8px 12px', maxWidth: '80%', fontSize: 13, lineHeight: 1.5,
          }}>{m.text}</div>
        ))}
      </div>
      {error && <div style={{ color: '#ff6b6b', fontSize: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Type a message..." disabled={sending}
          style={{ flex: 1, background: '#1a1a2e', color: '#e0e0ff', border: '1px solid #333', borderRadius: 6, padding: 10 }} />
        <button onClick={send} disabled={sending || !input.trim()}
          style={{ background: '#0a3d62', color: '#e0e0ff', border: '1px solid #4a9eff', borderRadius: 6, padding: '10px 16px', cursor: 'pointer' }}>
          {sending ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
