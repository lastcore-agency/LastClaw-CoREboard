import { useEffect, useState, useCallback } from 'react';

const API = '/api/runtime';

interface ConnectionState { state: string; connected: boolean; }
interface ServiceStatus { lastclaw: string; openclaw: string; }
interface JournalLogs { service: string; output: string; }

export function DiagnosticsPage() {
  const [conn, setConn] = useState<ConnectionState | null>(null);
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [logs, setLogs] = useState<JournalLogs | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [connR, statusR, logsR] = await Promise.all([
        fetch(`${API}/diagnostics/connection`).then(r => r.json()),
        fetch(`${API}/diagnostics/status`).then(r => r.json()),
        fetch(`${API}/diagnostics/logs?service=lastclaw-coreboard.service&lines=30`).then(r => r.json()),
      ]);
      if (connR.data) setConn(connR.data);
      if (statusR.data) setStatus(statusR.data);
      if (logsR.data) setLogs(logsR.data);
    } catch (e: any) { setError(e.message); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ color: '#e0e0ff', margin: 0 }}>System Diagnostics</h3>
        <button onClick={refresh}
          style={{ background: '#0a3d62', color: '#e0e0ff', border: '1px solid #4a9eff', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}>
          Refresh
        </button>
      </div>

      {error && <div style={{ color: '#ff6b6b', fontSize: 13 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div style={{ background: '#1a1a2e', borderRadius: 8, padding: 16, border: '1px solid #333' }}>
          <div style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>Gateway</div>
          <div style={{ color: conn?.connected ? '#4ade80' : '#ff6b6b', fontSize: 18, fontWeight: 'bold' }}>
            {conn?.state || 'unknown'}
          </div>
          <div style={{ color: '#888', fontSize: 12 }}>Connected: {conn?.connected ? 'yes' : 'no'}</div>
        </div>
        <div style={{ background: '#1a1a2e', borderRadius: 8, padding: 16, border: '1px solid #333' }}>
          <div style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>LastClaw Service</div>
          <div style={{ color: status?.lastclaw?.includes('active') ? '#4ade80' : '#ff6b6b', fontSize: 13, fontWeight: 'bold' }}>
            {status?.lastclaw?.split('\n')[0] || 'loading...'}
          </div>
        </div>
        <div style={{ background: '#1a1a2e', borderRadius: 8, padding: 16, border: '1px solid #333' }}>
          <div style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>OpenClaw Gateway</div>
          <div style={{ color: '#e0e0ff', fontSize: 13, fontWeight: 'bold' }}>
            {status?.openclaw?.split('\n')[0] || 'loading...'}
          </div>
        </div>
      </div>

      <div style={{ background: '#0d0d1a', borderRadius: 8, padding: 12, border: '1px solid #333' }}>
        <div style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>Recent Logs (lastclaw-coreboard)</div>
        <pre style={{
          margin: 0, color: '#c8c8e0', fontSize: 12, lineHeight: 1.6,
          maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap',
        }}>{logs?.output || 'Loading...'}</pre>
      </div>
    </div>
  );
}
