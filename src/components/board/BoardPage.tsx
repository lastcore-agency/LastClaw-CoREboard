import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  classifySessionGroup,
  classifySessionSource,
  deriveSessionTitle,
  formatRelativeTime,
  getAgentName,
  getSourceBadge,
  type LastClawResponse,
} from '../chat/session-types';
import { getSessionMeta, saveSessionData } from '../chat/session-storage';
import { useSessionEvents } from '../chat/useSessionEvents';
import './board.css';

const API = import.meta.env.VITE_OPENCLAW_API_BASE || '/api/runtime';

type RuntimeSessionCard = {
  key: string;
  updatedAt: number;
};

type RuntimeAgentSummary = {
  id: string;
  availability?: string;
};

interface BoardPageProps {
  onOpenChat: () => void;
}

function normalizeTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 10_000_000_000 ? value * 1000 : value;
  }
  if (typeof value === 'string') {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && value.trim() !== '') {
      return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
    }
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function activityLabel(updatedAt: number): { label: string; tone: 'active' | 'recent' | 'idle' } {
  const age = Math.max(0, Date.now() - updatedAt);
  if (age <= 15 * 60 * 1000) return { label: 'Active runtime', tone: 'active' };
  if (age <= 24 * 60 * 60 * 1000) return { label: 'Recent runtime', tone: 'recent' };
  return { label: 'Idle runtime', tone: 'idle' };
}

export function BoardPage({ onOpenChat }: BoardPageProps) {
  const [sessions, setSessions] = useState<RuntimeSessionCard[]>([]);
  const [agents, setAgents] = useState<RuntimeAgentSummary[]>([]);
  const [runtimeSource, setRuntimeSource] = useState('UNKNOWN');
  // initialLoading = true only before first successful fetch
  const [initialLoading, setInitialLoading] = useState(true);
  // refreshing = silent background indicator
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const everLoadedRef = useRef(false);
  const { connected: sseConnected, events } = useSessionEvents({ maxEvents: 100 });

  const refresh = useCallback(async () => {
    if (everLoadedRef.current) setRefreshing(true);
    setError('');
    try {
      const [sessionResponse, agentResponse] = await Promise.all([
        fetch(`${API}/sessions`),
        fetch(`${API}/agents`),
      ]);

      if (!sessionResponse.ok || !agentResponse.ok) {
        throw new Error('Runtime projection request failed');
      }

      const sessionJson: LastClawResponse<any[]> = await sessionResponse.json();
      const agentJson: LastClawResponse<RuntimeAgentSummary[]> = await agentResponse.json();

      const normalized = (sessionJson.data || [])
        .map((session: any) => ({
          key: String(session.key || session.sessionKey || ''),
          updatedAt: normalizeTimestamp(session.updatedAt || session.ts || session.lastActiveAt),
        }))
        .filter((session) => session.key)
        .sort((a, b) => b.updatedAt - a.updatedAt);

      setSessions(normalized);
      setAgents(agentJson.data || []);
      setRuntimeSource(sessionJson.source || agentJson.source || 'UNKNOWN');

      if (!everLoadedRef.current) {
        everLoadedRef.current = true;
        setInitialLoading(false);
      }
    } catch (reason) {
      // Keep last known good data — only update error indicator
      setError(reason instanceof Error ? reason.message : 'Unable to load runtime projection');
      setRuntimeSource('ERROR');
      if (!everLoadedRef.current) setInitialLoading(false);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const groups = useMemo(() => {
    const native: RuntimeSessionCard[] = [];
    const automation: RuntimeSessionCard[] = [];
    const external: RuntimeSessionCard[] = [];

    for (const session of sessions) {
      const group = classifySessionGroup(classifySessionSource(session.key));
      if (group === 'native') native.push(session);
      else if (group === 'automation') automation.push(session);
      else external.push(session);
    }

    return { native, automation, external };
  }, [sessions]);

  const activeAgents = agents.filter((agent) => {
    const status = String(agent.availability || '').toUpperCase();
    return status === 'WORKING' || status === 'BUSY' || status === 'WAITING' || status === 'ONLINE';
  }).length;

  function openSession(sessionKey: string) {
    saveSessionData({ selectedSessionKey: sessionKey });
    onOpenChat();
  }

  return (
    <div className="board-page">
      <header className="board-page__header">
        <div>
          <div className="board-page__eyebrow">OpenClaw Runtime</div>
          <h2 className="board-page__title">Runtime Workrooms</h2>
          <p className="board-page__subtitle">
            This is a truthful projection of live OpenClaw sessions. It does not invent Task, Approval, Artifact, or Result state.
          </p>
        </div>
        <button className="board-page__refresh" onClick={() => void refresh()} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <section className="board-readiness" aria-label="Board readiness">
        <div className="board-readiness__item">
          <span className="board-readiness__label">Runtime source</span>
          <strong>{runtimeSource}</strong>
        </div>
        <div className="board-readiness__item">
          <span className="board-readiness__label">Event stream</span>
          <strong className={sseConnected ? 'is-live' : 'is-offline'}>{sseConnected ? 'Connected' : 'Disconnected'}</strong>
        </div>
        <div className="board-readiness__item">
          <span className="board-readiness__label">Agents visible</span>
          <strong>{activeAgents}/{agents.length}</strong>
        </div>
        <div className="board-readiness__item">
          <span className="board-readiness__label">Runtime sessions</span>
          <strong>{sessions.length}</strong>
        </div>
        <div className="board-readiness__item board-readiness__item--core">
          <span className="board-readiness__label">Board Core</span>
          <strong>Not connected</strong>
          <small>Task/Event/Approval/Artifact contracts remain future integration.</small>
        </div>
      </section>

      {error && <div className="board-page__error" role="alert">{error}</div>}

      <div className="board-columns">
        <BoardColumn
          title="Native Workrooms"
          description="LastClaw and direct agent sessions"
          sessions={groups.native}
          onOpen={openSession}
        />
        <BoardColumn
          title="Automation"
          description="Cron and scheduled runtime sessions"
          sessions={groups.automation}
          onOpen={openSession}
        />
        <BoardColumn
          title="External Channels"
          description="Discord, Telegram, handoff, and other channels"
          sessions={groups.external}
          onOpen={openSession}
        />
      </div>

      <footer className="board-page__footer">
        <span>Recent live events: {events.length}</span>
        <span>Board cards represent sessions, not Board Core tasks.</span>
      </footer>
    </div>
  );
}

function BoardColumn({
  title,
  description,
  sessions,
  onOpen,
}: {
  title: string;
  description: string;
  sessions: RuntimeSessionCard[];
  onOpen: (sessionKey: string) => void;
}) {
  return (
    <section className="board-column">
      <div className="board-column__header">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span className="board-column__count">{sessions.length}</span>
      </div>

      <div className="board-column__cards">
        {sessions.length === 0 ? (
          <div className="board-column__empty">No real runtime sessions in this lane.</div>
        ) : sessions.map((session) => {
          const metadata = getSessionMeta(session.key);
          const source = classifySessionSource(session.key);
          const badge = getSourceBadge(source);
          const activity = activityLabel(session.updatedAt);
          const agentId = metadata?.primaryAgentId || session.key.split(':')[1] || 'main';

          return (
            <article className="board-card" key={session.key}>
              <div className="board-card__topline">
                <span
                  className="board-card__source"
                  style={{ color: badge.color, borderColor: `${badge.color}55`, background: `${badge.color}18` }}
                >
                  {badge.label}
                </span>
                <span className={`board-card__activity board-card__activity--${activity.tone}`}>{activity.label}</span>
              </div>
              <h4>{deriveSessionTitle(session.key, metadata || undefined)}</h4>
              <p className="board-card__objective">
                {metadata?.objective || 'No LastClaw objective metadata is stored for this runtime session.'}
              </p>
              <div className="board-card__meta">
                <span>{getAgentName(agentId)}</span>
                <span>{formatRelativeTime(session.updatedAt)}</span>
              </div>
              <button className="board-card__open" onClick={() => onOpen(session.key)}>Open workroom</button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
