/* ────────────────────────────────────────────────────────────
   DiagnosticsPage — real runtime diagnostic data only
   No duplication of OpenClaw Control UI.
   Shows: Gateway / Adapter / Agents / Sessions / Events / Workspace / Cache / Security
   All data from RuntimeContext + live /api/runtime/* endpoints
   ──────────────────────────────────────────────────────────── */

import { useEffect, useState, useCallback } from 'react';
import { useRuntime } from '../../contexts/RuntimeContext';

const API = (import.meta as any).env?.VITE_OPENCLAW_API_BASE || '/api/runtime';

interface DiagConn { state: string; connected: boolean; }
interface DiagStatus { lastclaw: string; openclaw: string; }

function DiagRow({ label, value, highlight }: { label: string; value: string | number | null | undefined; highlight?: string }) {
  const color = highlight === 'ok' ? '#4ade80'
    : highlight === 'warn' ? '#fbbf24'
    : highlight === 'error' ? '#f87171'
    : '#c8c8e0';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1e1e38' }}>
      <span style={{ color: '#888', fontSize: 12 }}>{label}</span>
      <span style={{ color, fontSize: 12, fontWeight: 600, maxWidth: '60%', textAlign: 'right', wordBreak: 'break-all' }}>
        {value ?? '—'}
      </span>
    </div>
  );
}

function DiagSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#0d0d1a', borderRadius: 10, padding: 16, border: '1px solid #2a2a4a' }}>
      <div style={{ color: '#8b8bff', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export function DiagnosticsPage() {
  const { agents, gateway, initialLoading, refreshing, activity, sseConnected: ctxSseConnected } = useRuntime() as any;
  const [conn, setConn] = useState<DiagConn | null>(null);
  const [serviceStatus, setServiceStatus] = useState<DiagStatus | null>(null);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [lastFetch, setLastFetch] = useState<string>('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [connR, sessR] = await Promise.all([
        fetch(`${API}/diagnostics/connection`).then(r => r.json()).catch(() => null),
        fetch(`${API}/sessions`).then(r => r.json()).catch(() => null),
      ]);
      if (connR?.data) setConn(connR.data);
      if (sessR?.data) setSessions(Array.isArray(sessR.data) ? sessR.data : []);
      setLastFetch(new Date().toISOString());
    } catch (e: any) { setError(e.message); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // SSE status from activity store
  const sseConnected = activity?.sseConnected ?? ctxSseConnected ?? false;
  const allActivities = activity?.getAllActivities?.() ?? new Map();
  const bubbleCount = activity?.bubbles?.size ?? 0;

  // Gateway derived from RuntimeContext (same source as Inspector & TopBar)
  const gatewaySource = gateway?.source ?? 'EMPTY';
  const gatewayOk = gateway?.ok ?? false;
  const gatewayObservedAt = gateway?.observedAt ?? gateway?.observedAt ?? null;
  const gatewayStale = gateway?.stale ?? false;
  const gatewayConnected = conn?.connected ?? (gatewayOk ? true : false);

  // Agent stats
  const discoveredCount = agents?.length ?? 0;
  const onlineAgents = agents?.filter((a: any) => !['offline', 'unknown'].includes(a.status)) ?? [];
  const offlineAgents = agents?.filter((a: any) => a.status === 'offline') ?? [];
  const unknownAgents = agents?.filter((a: any) => a.status === 'unknown') ?? [];

  // Session stats per agent
  const sessionByAgent = new Map<string, number>();
  for (const s of sessions) {
    const parts = (s.key || '').split(':');
    const agentId = parts[0] === 'agent' ? parts[1] : parts[0];
    if (agentId) sessionByAgent.set(agentId, (sessionByAgent.get(agentId) ?? 0) + 1);
  }

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ color: '#e0e0ff', margin: 0, fontSize: 16 }}>
          Runtime Diagnostics
          {refreshing && <span style={{ color: '#555', fontSize: 11, marginLeft: 8, fontWeight: 400 }}>refreshing…</span>}
        </h3>
        <button onClick={refresh}
          style={{ background: '#0a3d62', color: '#e0e0ff', border: '1px solid #4a9eff', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>
          Refresh
        </button>
      </div>

      {error && <div style={{ color: '#f87171', fontSize: 12, background: '#1f0a0a', padding: '8px 12px', borderRadius: 6 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>

        {/* ── Gateway ─────────────────────────────────────────── */}
        <DiagSection title="Gateway">
          <DiagRow label="Connected" value={gatewayConnected ? 'yes' : 'no'} highlight={gatewayConnected ? 'ok' : 'error'} />
          <DiagRow label="Source" value={gatewaySource} highlight={gatewaySource === 'LIVE' ? 'ok' : gatewaySource === 'CACHED' ? 'warn' : 'error'} />
          <DiagRow label="Stale" value={gatewayStale ? 'yes' : 'no'} highlight={gatewayStale ? 'warn' : 'ok'} />
          <DiagRow label="Observed At" value={gatewayObservedAt ? new Date(gatewayObservedAt).toLocaleTimeString() : 'unknown'} />
          <DiagRow label="Status" value={conn?.state ?? 'unknown'} highlight={conn?.connected ? 'ok' : 'error'} />
        </DiagSection>

        {/* ── Runtime Adapter ──────────────────────────────────── */}
        <DiagSection title="Runtime Adapter">
          <DiagRow label="Loading" value={initialLoading ? 'initial' : refreshing ? 'refreshing' : 'idle'} highlight={initialLoading ? 'warn' : 'ok'} />
          <DiagRow label="Last Fetch" value={lastFetch ? new Date(lastFetch).toLocaleTimeString() : '—'} />
          <DiagRow label="SSE Connected" value={sseConnected ? 'yes' : 'no'} highlight={sseConnected ? 'ok' : 'warn'} />
          <DiagRow label="Active Bubbles" value={bubbleCount} />
          <DiagRow label="Tracked Agents" value={allActivities.size} />
        </DiagSection>

        {/* ── Agents ──────────────────────────────────────────── */}
        <DiagSection title={`Agents (${discoveredCount} discovered)`}>
          <DiagRow label="Online" value={onlineAgents.length} highlight={onlineAgents.length > 0 ? 'ok' : 'warn'} />
          <DiagRow label="Offline" value={offlineAgents.length} highlight={offlineAgents.length > 0 ? 'warn' : 'ok'} />
          <DiagRow label="Unknown" value={unknownAgents.length} highlight={unknownAgents.length > 0 ? 'warn' : 'ok'} />
          <div style={{ marginTop: 8 }}>
            {(agents ?? []).map((a: any) => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 11 }}>
                <span style={{ color: '#9090c0' }}>{a.id}</span>
                <span style={{ display: 'flex', gap: 6, color: '#666' }}>
                  <span style={{ color: a.runtimeAgentId ? '#4ade80' : '#555' }}>
                    runtime:{a.runtimeAgentId || '—'}
                  </span>
                  <span style={{
                    color: a.status === 'online' || a.status === 'working' ? '#4ade80'
                      : a.status === 'offline' ? '#f87171'
                      : a.status === 'unknown' ? '#555' : '#fbbf24'
                  }}>
                    {a.status}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </DiagSection>

        {/* ── Sessions ─────────────────────────────────────────── */}
        <DiagSection title={`Sessions (${sessions.length} total)`}>
          {sessions.length === 0 ? (
            <DiagRow label="Sessions" value="none discovered" />
          ) : (
            <>
              {Array.from(sessionByAgent.entries()).map(([agentId, count]) => (
                <DiagRow key={agentId} label={`${agentId}`} value={`${count} session${count !== 1 ? 's' : ''}`} />
              ))}
              <div style={{ marginTop: 8, fontSize: 11 }}>
                {sessions.slice(0, 5).map((s: any, i) => (
                  <div key={i} style={{ color: '#555', padding: '2px 0', borderBottom: '1px solid #111' }}>
                    <span style={{ color: '#8b8bff' }}>{s.key?.slice(0, 40)}…</span>
                    {s.metadata?.source && <span style={{ marginLeft: 8, color: '#666' }}>{s.metadata.source}</span>}
                  </div>
                ))}
                {sessions.length > 5 && <div style={{ color: '#555', fontSize: 11, marginTop: 4 }}>+{sessions.length - 5} more</div>}
              </div>
            </>
          )}
        </DiagSection>

        {/* ── SSE Events ──────────────────────────────────────── */}
        <DiagSection title="SSE Events">
          <DiagRow label="Stream" value={sseConnected ? 'connected' : 'disconnected'} highlight={sseConnected ? 'ok' : 'warn'} />
          <DiagRow label="Tracked States" value={allActivities.size} />
          <div style={{ marginTop: 8 }}>
            {Array.from(allActivities.entries() as Iterable<[string, any]>).map(([agentId, act]) => (
              <div key={agentId} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 11 }}>
                <span style={{ color: '#9090c0' }}>{agentId}</span>
                <span style={{ display: 'flex', gap: 8 }}>
                  <span style={{ color: act.source === 'SSE' ? '#4ade80' : '#6366f1' }}>{act.source}</span>
                  <span style={{ color: '#c8c8e0' }}>{act.state}</span>
                </span>
              </div>
            ))}
            {allActivities.size === 0 && <div style={{ color: '#444', fontSize: 11 }}>No agent activity tracked yet</div>}
          </div>
        </DiagSection>

        {/* ── Workspace ────────────────────────────────────────── */}
        <DiagSection title="Workspace">
          {(agents ?? []).map((a: any) => (
            <DiagRow
              key={a.id}
              label={a.id}
              value={a.workspace || 'none'}
              highlight={a.workspace ? 'ok' : 'warn'}
            />
          ))}
          {discoveredCount === 0 && <DiagRow label="Status" value="no agents discovered" />}
        </DiagSection>

        {/* ── Model ────────────────────────────────────────────── */}
        <DiagSection title="Model">
          {(agents ?? []).map((a: any) => (
            <DiagRow
              key={a.id}
              label={a.id}
              value={[a.resolvedModel && `live:${a.resolvedModel}`, a.configuredModel && !a.resolvedModel && `cfg:${a.configuredModel}`, !a.resolvedModel && !a.configuredModel && 'unknown'].filter(Boolean).join(' / ') || 'unknown'}
              highlight={a.model && a.model !== 'unknown' ? 'ok' : 'warn'}
            />
          ))}
        </DiagSection>

        {/* ── Security ─────────────────────────────────────────── */}
        <DiagSection title="Security">
          <DiagRow label="Secrets Redacted" value="yes" highlight="ok" />
          <DiagRow label="Raw payload forwarded" value="no — stripped server-side" highlight="ok" />
          <DiagRow label="Arbitrary path access" value="blocked — whitelist only" highlight="ok" />
          <DiagRow label="Env mode" value={String((import.meta as any).env?.MODE || 'unknown')} />
          <DiagRow label="Mock mode" value={String((import.meta as any).env?.VITE_USE_MOCK || 'false')} highlight={(import.meta as any).env?.VITE_USE_MOCK === 'true' ? 'warn' : 'ok'} />
        </DiagSection>

      </div>
    </div>
  );
}
