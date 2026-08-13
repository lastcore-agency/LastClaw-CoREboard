/* ────────────────────────────────────────────────────────────
   ChatPage — LastClaw Native Session Workroom
   Three-column command-center session interface
   ──────────────────────────────────────────────────────────── */

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import './chat.css';
import {
  type NativeSession,
  type TimelineItem,
  type NormalizedEvent,
  type RuntimeAgent,
  type LastClawResponse,
  type SessionSource,
  type SessionMetadata,
  type WorkspaceFile,
  type WorkspaceFileContent,
  CANONICAL_AGENTS,
  classifySessionSource,
  classifySessionGroup,
  deriveSessionTitle,
  getAgentName,
  getCanonicalAgentId,
  getRuntimeAgentId,
  formatRelativeTime,
  formatTime,
  getSourceBadge,
  getTimelineTypeDisplay,
} from './session-types';
import {
  loadSessionData,
  saveSessionData,
  saveSessionMeta,
  getSessionMeta,
} from './session-storage';
import { useSessionEvents } from './useSessionEvents';

const API = import.meta.env.VITE_OPENCLAW_API_BASE || '/api/runtime';

/** Normalize content field to text */
function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((c: any) => c.text || '').join('');
  return '';
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

function textHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function timelineContentSignature(item: TimelineItem): string {
  return `${item.type}:${item.text.trim().replace(/\s+/g, ' ')}`;
}

function sourcePriority(source: TimelineItem['source']): number {
  if (source === 'LIVE') return 3;
  if (source === 'REAL') return 2;
  return 1;
}

function mergeTimelineItems(current: TimelineItem[], incoming: TimelineItem[]): TimelineItem[] {
  const merged: TimelineItem[] = [];
  const candidates = [...current, ...incoming].sort((a, b) => a.timestamp - b.timestamp);

  for (const candidate of candidates) {
    const duplicateIndex = merged.findIndex((existing) =>
      existing.type === candidate.type &&
      existing.text.trim() === candidate.text.trim() &&
      Math.abs(existing.timestamp - candidate.timestamp) <= 15_000
    );

    if (duplicateIndex < 0) {
      merged.push(candidate);
      continue;
    }

    if (sourcePriority(candidate.source) >= sourcePriority(merged[duplicateIndex].source)) {
      merged[duplicateIndex] = candidate;
    }
  }

  return merged.sort((a, b) => a.timestamp - b.timestamp).slice(-200);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function ChatPage() {
  // ── State ──────────────────────────────────────────────────
  const [sessions, setSessions] = useState<{ key: string; updatedAt: number }[]>([]);
  const [agents, setAgents] = useState<RuntimeAgent[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [messages, setMessages] = useState<TimelineItem[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [awaitingReply, setAwaitingReply] = useState(false);
  const [error, setError] = useState('');
  const [healthSource, setHealthSource] = useState('UNKNOWN');
  const [searchFilter, setSearchFilter] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(['external']));
  const [mobileTab, setMobileTab] = useState<'sessions' | 'workroom' | 'context'>('sessions');
  const [contextFile, setContextFile] = useState<WorkspaceFileContent | null>(null);
  const [showNewSession, setShowNewSession] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newSessionObjective, setNewSessionObjective] = useState('');
  // Default to empty — will be updated to first discovered runtime agent after agents load
  const [newSessionAgent, setNewSessionAgent] = useState('');
  const [pendingMessages, setPendingMessages] = useState<Map<string, TimelineItem>>(new Map());

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const selectedKeyRef = useRef('');
  const pollGenerationRef = useRef(0);

  // Load persisted preferences
  const stored = useMemo(() => loadSessionData(), []);

  // ── SSE events ─────────────────────────────────────────────
  const { events: sseEvents, connected: sseConnected, sessionEvents } = useSessionEvents({
    sessionKey: selectedKey,
  });

  // ── Load sessions from Gateway ─────────────────────────────
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API}/sessions`);
      const json: LastClawResponse<any[]> = await res.json();
      const list = (json.data || []).map((s: any) => ({
        key: s.key || s.sessionKey || '',
        updatedAt: normalizeTimestamp(s.updatedAt || s.ts || s.lastActiveAt),
      }));
      setSessions(list);
      setHealthSource(json.source || 'UNKNOWN');
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  // ── Load agents from Gateway ───────────────────────────────
  const loadAgents = useCallback(async () => {
    try {
      const res = await fetch(`${API}/agents`);
      const json: LastClawResponse<RuntimeAgent[]> = await res.json();
      setAgents(json.data || []);
    } catch { /* keep existing agents */ }
  }, []);

  // ── Initial load ───────────────────────────────────────────
  useEffect(() => {
    loadSessions();
    loadAgents();
    // Restore selected session
    if (stored.selectedSessionKey) setSelectedKey(stored.selectedSessionKey);
    if (stored.searchFilter) setSearchFilter(stored.searchFilter);
    if (stored.collapsedSections) setCollapsedSections(new Set(stored.collapsedSections));
    if (stored.mobileTab) setMobileTab(stored.mobileTab);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep async history polling scoped to the currently selected workroom.
  useEffect(() => {
    selectedKeyRef.current = selectedKey;
    pollGenerationRef.current += 1;
    setMessages([]);
    setPendingMessages(new Map());
    setAwaitingReply(false);
  }, [selectedKey]);

  // ── Load chat history for selected session ─────────────────
  const loadHistory = useCallback(async (sessionKey: string): Promise<TimelineItem[]> => {
    if (!sessionKey) return [];
    try {
      const res = await fetch(`${API}/transcript/${encodeURIComponent(sessionKey)}?limit=100`);
      if (!res.ok) throw new Error(`Transcript request failed (${res.status})`);
      const json = await res.json();
      const msgs: TimelineItem[] = (json.data || []).map((m: any, i: number) => {
        const timestamp = normalizeTimestamp(m.timestamp);
        const text = String(m.text || '');
        return {
          id: `hist-${m.role || 'unknown'}-${m.timestamp || `index-${i}`}-${textHash(text)}`,
          type: m.role === 'user' ? 'user-message' : 'agent-response',
          role: m.role || 'system',
          text,
          agentId: m.agentId,
          timestamp,
          source: 'REAL',
          metadata: m.model ? { model: m.model } : undefined,
        };
      }).filter((message: TimelineItem) => message.text.trim());

      if (selectedKeyRef.current === sessionKey) {
        setMessages((previous) => mergeTimelineItems(previous, msgs));
        setHealthSource(json.source || 'UNKNOWN');
      }
      return msgs;
    } catch {
      if (selectedKeyRef.current === sessionKey) setHealthSource('UNREACHABLE');
      return [];
    }
  }, []);

  useEffect(() => {
    if (selectedKey) {
      void loadHistory(selectedKey);
      saveSessionData({ selectedSessionKey: selectedKey });
      setMobileTab('workroom');
    }
  }, [selectedKey, loadHistory]);

  // ── Merge SSE events into messages ─────────────────────────
  useEffect(() => {
    if (!sessionEvents.length) return;
    setMessages(prev => {
      const existingIds = new Set(prev.map(m => m.id));
      const newItems: TimelineItem[] = [];
      for (const evt of sessionEvents) {
        if (existingIds.has(evt.id)) continue;
        existingIds.add(evt.id);

        const isMessageEvent =
          evt.type === 'session.message' ||
          evt.type === 'chat.message' ||
          evt.type.startsWith('message.') ||
          evt.type.endsWith('.message');

        if (isMessageEvent) {
          const inferredRole = evt.text?.startsWith('[user]') ? 'user' : 'assistant';
          const role = evt.role === 'user' || evt.role === 'assistant' ? evt.role : inferredRole;
          const text = evt.text?.replace(/^\[user\]\s*/, '') || '';
          if (!text) continue;
          newItems.push({
            id: evt.id,
            type: role === 'user' ? 'user-message' : 'agent-response',
            role,
            text,
            agentId: evt.agentId,
            timestamp: normalizeTimestamp(evt.timestamp),
            source: 'LIVE',
          });
        } else if (evt.type === 'gateway.connected' || evt.type === 'gateway.disconnected') {
          newItems.push({
            id: evt.id,
            type: 'connection-event',
            role: 'system',
            text: evt.type === 'gateway.connected' ? 'Gateway connected' : 'Gateway disconnected',
            timestamp: new Date(evt.timestamp).getTime(),
            source: 'LIVE',
          });
        } else if (evt.type === 'tool.started' || evt.type === 'tool.finished') {
          newItems.push({
            id: evt.id,
            type: 'tool-event',
            role: 'event',
            text: `${evt.type === 'tool.started' ? 'Tool started' : 'Tool finished'}${evt.text ? `: ${evt.text.slice(0, 80)}` : ''}`,
            agentId: evt.agentId,
            timestamp: new Date(evt.timestamp).getTime(),
            source: 'LIVE',
          });
        } else if (evt.type.includes('error')) {
          newItems.push({
            id: evt.id,
            type: 'error',
            role: 'error',
            text: evt.text || evt.type,
            agentId: evt.agentId,
            timestamp: new Date(evt.timestamp).getTime(),
            source: 'LIVE',
          });
        }
      }
      if (!newItems.length) return prev;
      return mergeTimelineItems(prev, newItems);
    });
  }, [sessionEvents]);

  // ── Auto-scroll ────────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pendingMessages]);

  const pollForAssistantResponse = useCallback(async (
    sessionKey: string,
    sentAt: number,
    knownAssistantSignatures: string[],
    generation: number,
  ) => {
    const known = new Set(knownAssistantSignatures);
    setAwaitingReply(true);

    try {
      for (let attempt = 0; attempt < 36; attempt += 1) {
        await sleep(attempt === 0 ? 1500 : 2500);
        if (selectedKeyRef.current !== sessionKey || pollGenerationRef.current !== generation) return;

        const latest = await loadHistory(sessionKey);
        const hasNewAssistant = latest.some((item) =>
          item.type === 'agent-response' &&
          item.timestamp >= sentAt - 10_000 &&
          !known.has(timelineContentSignature(item))
        );

        if (hasNewAssistant) return;
      }
    } finally {
      if (selectedKeyRef.current === sessionKey && pollGenerationRef.current === generation) {
        setAwaitingReply(false);
      }
    }
  }, [loadHistory]);

  // ── Send message ───────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    if (!input.trim() || !selectedKey || sending || awaitingReply) return;

    const msg = input.trim();
    const agentId = getRuntimeAgentId(
      getCanonicalAgentId(selectedKey.split(':')[1] || '')
    );
    const sentAt = Date.now();
    const pendingId = `pending-${sentAt}-${Math.random().toString(36).slice(2, 8)}`;
    const knownAssistantSignatures = messages
      .filter((item) => item.type === 'agent-response')
      .map(timelineContentSignature);
    const pollGeneration = pollGenerationRef.current;

    // Validate message length
    if (msg.length > 10000) {
      setError('Message too long (max 10,000 characters)');
      return;
    }

    setSending(true);
    setError('');
    setInput('');

    // Add pending user message
    const pendingMsg: TimelineItem = {
      id: pendingId,
      type: 'user-message',
      role: 'user',
      text: msg,
      timestamp: sentAt,
      source: 'LOCAL',
    };
    setPendingMessages(prev => new Map(prev).set(pendingId, pendingMsg));

    try {
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          sessionKey: selectedKey,
          agentId,
        }),
      });
      const json = await res.json();

      if (json.error) {
        setError(json.error.message || json.error);
        setPendingMessages(prev => {
          const next = new Map(prev);
          next.delete(pendingId);
          return next;
        });
      } else {
        // Move pending to confirmed messages without losing live or transcript items.
        setMessages((previous) => mergeTimelineItems(previous, [{ ...pendingMsg, source: 'REAL' }]));
        setPendingMessages(prev => {
          const next = new Map(prev);
          next.delete(pendingId);
          return next;
        });

        // Poll the real transcript until the assistant response arrives.
        void pollForAssistantResponse(
          selectedKey,
          sentAt,
          knownAssistantSignatures,
          pollGeneration,
        );
      }
    } catch (e: any) {
      setError(e.message);
      setPendingMessages(prev => {
        const next = new Map(prev);
        next.delete(pendingId);
        return next;
      });
    } finally {
      setSending(false);
    }
  }, [input, selectedKey, sending, awaitingReply, messages, pollForAssistantResponse]);

  // ── Create new session ─────────────────────────────────────
  const createSession = useCallback(async () => {
    if (!newSessionTitle.trim()) return;

    const runtimeAgentId = getRuntimeAgentId(newSessionAgent);
    const safeId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const sessionKey = `agent:${runtimeAgentId}:lastclaw:${safeId}`;

    // Save metadata locally
    const meta: SessionMetadata = {
      title: newSessionTitle.trim(),
      objective: newSessionObjective.trim(),
      primaryAgentId: newSessionAgent,
      participatingAgentIds: [newSessionAgent],
      source: 'lastclaw-native',
    };
    saveSessionMeta(sessionKey, meta);

    // Send first message through Gateway (this creates the session)
    setSending(true);
    try {
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: meta.objective || `Session: ${meta.title}`,
          sessionKey,
          agentId: runtimeAgentId,
        }),
      });
      const json = await res.json();

      if (json.error) {
        setError(json.error.message || 'Failed to create session');
        return;
      }

      // Add to sessions list
      setSessions(prev => [...prev, { key: sessionKey, updatedAt: Date.now() }]);
      setSelectedKey(sessionKey);
      setShowNewSession(false);
      setNewSessionTitle('');
      setNewSessionObjective('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }, [newSessionTitle, newSessionObjective, newSessionAgent]);

  // ── Selected session info ──────────────────────────────────
  const selectedSession = sessions.find(s => s.key === selectedKey);
  const selectedMeta = selectedKey ? getSessionMeta(selectedKey) : null;
  const selectedSource = selectedKey ? classifySessionSource(selectedKey) : 'other';
  const selectedBadge = getSourceBadge(selectedSource);
  const selectedAgentName = selectedMeta?.primaryAgentId
    ? getAgentName(selectedMeta.primaryAgentId)
    : getAgentName(selectedKey.split(':')[1] || '');

  // ── Workspace files (per-agent canonical resolution) ───────
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>([]);
  const [workspaceError, setWorkspaceError] = useState<string>('');

  const activeRuntimeAgentId = useMemo(() => {
    if (selectedMeta?.primaryAgentId) {
      return getRuntimeAgentId(selectedMeta.primaryAgentId);
    }
    if (selectedKey) {
      const parts = selectedKey.split(':');
      for (const part of parts) {
        const found = CANONICAL_AGENTS.find(a => a.id === part || a.runtimeId === part);
        if (found) return found.runtimeId;
      }
    }
    // If no session-based identity, return empty — workspace fetch will skip
    return '';
  }, [selectedMeta, selectedKey]);

  const loadWorkspaceFiles = useCallback(async () => {
    setWorkspaceError('');
    try {
      const res = await fetch(`${API}/workspace/${encodeURIComponent(activeRuntimeAgentId)}/files?path=`);
      const json = await res.json();
      if (json.error) {
        setWorkspaceError(json.error);
        setWorkspaceFiles([]);
      } else {
        setWorkspaceFiles(json.data || []);
      }
    } catch (err: any) {
      setWorkspaceError(err.message || 'Workspace unavailable');
      setWorkspaceFiles([]);
    }
  }, [activeRuntimeAgentId]);

  useEffect(() => {
    loadWorkspaceFiles();
  }, [loadWorkspaceFiles]);

  const openFile = useCallback(async (filePath: string) => {
    try {
      const res = await fetch(`${API}/workspace/${encodeURIComponent(activeRuntimeAgentId)}/file?path=${encodeURIComponent(filePath)}`);
      const json = await res.json();
      if (!json.error && json.data) {
        setContextFile(json.data);
      }
    } catch { /* file may be unreadable */ }
  }, [activeRuntimeAgentId]);

  // ── Session classification ─────────────────────────────────
  const classifiedSessions = useMemo(() => {
    const native: typeof sessions = [];
    const automation: typeof sessions = [];
    const external: typeof sessions = [];

    for (const s of sessions) {
      const source = classifySessionSource(s.key);
      const group = classifySessionGroup(source);
      if (group === 'native') native.push(s);
      else if (group === 'automation') automation.push(s);
      else external.push(s);
    }

    // Sort by updatedAt desc
    const sorter = (a: { updatedAt: number }, b: { updatedAt: number }) => b.updatedAt - a.updatedAt;
    native.sort(sorter);
    automation.sort(sorter);
    external.sort(sorter);

    return { native, automation, external };
  }, [sessions]);

  // ── Filter sessions ────────────────────────────────────────
  const filteredNative = useMemo(() => {
    if (!searchFilter.trim()) return classifiedSessions.native;
    const q = searchFilter.toLowerCase();
    return classifiedSessions.native.filter(s => {
      const meta = getSessionMeta(s.key);
      const title = deriveSessionTitle(s.key, meta || undefined);
      return title.toLowerCase().includes(q) || s.key.toLowerCase().includes(q);
    });
  }, [classifiedSessions.native, searchFilter]);

  // ── Keyboard shortcuts ─────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // ── Toggle section collapse ────────────────────────────────
  const toggleSection = useCallback((section: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      saveSessionData({ collapsedSections: Array.from(next) });
      return next;
    });
  }, []);

  // ── Mobile tab persistence ─────────────────────────────────
  useEffect(() => {
    saveSessionData({ mobileTab });
  }, [mobileTab]);

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="ns-page">
      {/* ── LEFT: Session Navigator ── */}
      <aside className={`ns-nav ${mobileTab === 'sessions' ? 'ns-mobile-active' : ''}`}>
        <div className="ns-nav__header">
          <h2 className="ns-nav__title">Workrooms</h2>
          <button
            className="ns-btn ns-btn--primary ns-btn--sm"
            onClick={() => setShowNewSession(true)}
          >
            + New
          </button>
        </div>

        <div className="ns-nav__search">
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchFilter}
            onChange={e => {
              setSearchFilter(e.target.value);
              saveSessionData({ searchFilter: e.target.value });
            }}
            className="ns-input"
          />
        </div>

        <div className="ns-nav__list">
          {/* Native Sessions */}
          <div className="ns-nav__section">
            <button
              className="ns-nav__section-header"
              onClick={() => toggleSection('native')}
            >
              <span>{collapsedSections.has('native') ? '▸' : '▾'} Native Sessions</span>
              <span className="ns-nav__count">{filteredNative.length}</span>
            </button>
            {!collapsedSections.has('native') && (
              <div className="ns-nav__section-items">
                {filteredNative.map(s => (
                  <SessionItem
                    key={s.key}
                    session={s}
                    selected={s.key === selectedKey}
                    onClick={() => setSelectedKey(s.key)}
                  />
                ))}
                {filteredNative.length === 0 && (
                  <div className="ns-nav__empty">No native sessions</div>
                )}
              </div>
            )}
          </div>

          {/* Automation / Cron */}
          <div className="ns-nav__section">
            <button
              className="ns-nav__section-header"
              onClick={() => toggleSection('automation')}
            >
              <span>{collapsedSections.has('automation') ? '▸' : '▾'} Automation</span>
              <span className="ns-nav__count">{classifiedSessions.automation.length}</span>
            </button>
            {!collapsedSections.has('automation') && (
              <div className="ns-nav__section-items">
                {classifiedSessions.automation.map(s => (
                  <SessionItem
                    key={s.key}
                    session={s}
                    selected={s.key === selectedKey}
                    onClick={() => setSelectedKey(s.key)}
                  />
                ))}
                {classifiedSessions.automation.length === 0 && (
                  <div className="ns-nav__empty">No automation sessions</div>
                )}
              </div>
            )}
          </div>

          {/* External / Legacy */}
          <div className="ns-nav__section">
            <button
              className="ns-nav__section-header"
              onClick={() => toggleSection('external')}
            >
              <span>{collapsedSections.has('external') ? '▸' : '▾'} External / Legacy</span>
              <span className="ns-nav__count">{classifiedSessions.external.length}</span>
            </button>
            {!collapsedSections.has('external') && (
              <div className="ns-nav__section-items">
                {classifiedSessions.external.map(s => (
                  <SessionItem
                    key={s.key}
                    session={s}
                    selected={s.key === selectedKey}
                    onClick={() => setSelectedKey(s.key)}
                  />
                ))}
                {classifiedSessions.external.length === 0 && (
                  <div className="ns-nav__empty">No external sessions</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Connection status */}
        <div className="ns-nav__footer">
          <div className={`ns-status-dot ${sseConnected ? 'ns-status-dot--live' : 'ns-status-dot--off'}`} />
          <span className="ns-nav__footer-text">
            {sseConnected ? 'Live' : 'Disconnected'} · {healthSource}
          </span>
        </div>
      </aside>

      {/* ── CENTER: Workroom ── */}
      <main className={`ns-workroom ${mobileTab === 'workroom' ? 'ns-mobile-active' : ''}`}>
        {selectedKey ? (
          <>
            {/* Session header */}
            <div className="ns-workroom__header">
              <div className="ns-workroom__header-left">
                <h3 className="ns-workroom__title">
                  {deriveSessionTitle(selectedKey, selectedMeta || undefined)}
                </h3>
                <span
                  className="ns-badge"
                  style={{ background: selectedBadge.color + '20', color: selectedBadge.color, borderColor: selectedBadge.color + '40' }}
                >
                  {selectedBadge.label}
                </span>
                <span className="ns-workroom__agent">Agent: {selectedAgentName}</span>
              </div>
              <div className="ns-workroom__header-right">
                {selectedSession && (
                  <span className="ns-workroom__updated">
                    {formatRelativeTime(selectedSession.updatedAt)}
                  </span>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div className="ns-workroom__timeline" ref={scrollRef}>
              {messages.map(item => (
                <TimelineEntry key={item.id} item={item} />
              ))}

              {/* Pending messages */}
              {Array.from(pendingMessages.values()).map(item => (
                <TimelineEntry key={item.id} item={item} pending />
              ))}

              {messages.length === 0 && pendingMessages.size === 0 && (
                <div className="ns-workroom__empty">
                  <div className="ns-workroom__empty-icon">💬</div>
                  <div className="ns-workroom__empty-text">No messages yet</div>
                  <div className="ns-workroom__empty-hint">Send a message to start the session</div>
                </div>
              )}
            </div>

            {/* Error display */}
            {error && (
              <div className="ns-workroom__error">
                <span className="ns-workroom__error-icon">⚠</span>
                <span>{error}</span>
                <button className="ns-workroom__error-close" onClick={() => setError('')}>×</button>
              </div>
            )}

            {/* Composer */}
            <div className="ns-workroom__composer">
              <textarea
                ref={inputRef}
                className="ns-workroom__input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${selectedAgentName}...`}
                disabled={sending || awaitingReply}
                rows={1}
              />
              <button
                className="ns-btn ns-btn--primary"
                onClick={sendMessage}
                disabled={sending || awaitingReply || !input.trim()}
              >
                {sending ? 'Sending…' : awaitingReply ? 'Waiting…' : 'Send'}
              </button>
            </div>
          </>
        ) : (
          <div className="ns-workroom__placeholder">
            <div className="ns-workroom__placeholder-icon">🏠</div>
            <div className="ns-workroom__placeholder-title">LastClaw Workroom</div>
            <div className="ns-workroom__placeholder-desc">
              Select a session from the navigator or create a new one
            </div>
          </div>
        )}
      </main>

      {/* ── RIGHT: Context Panel ── */}
      <aside className={`ns-context ${mobileTab === 'context' ? 'ns-mobile-active' : ''}`}>
        <div className="ns-context__header">
          <h3 className="ns-context__title">Context</h3>
        </div>

        {selectedKey ? (
          <div className="ns-context__body">
            {/* Objective */}
            <div className="ns-context__section">
              <div className="ns-context__label">Objective</div>
              <div className="ns-context__value">
                {selectedMeta?.objective || <span className="ns-unknown">Not available</span>}
              </div>
            </div>

            {/* Primary Agent */}
            <div className="ns-context__section">
              <div className="ns-context__label">Primary Agent</div>
              <div className="ns-context__value ns-context__agent">
                <div
                  className="ns-agent-dot"
                  style={{ background: 'var(--blue-violet, #6366f1)' }}
                />
                {selectedAgentName}
                <span className="ns-participation-badge ns-participation-badge--primary">Primary</span>
              </div>
            </div>

            {/* Participating Agents */}
            <div className="ns-context__section">
              <div className="ns-context__label">Participating Agents</div>
              <div className="ns-context__value">
                {selectedMeta?.participatingAgentIds?.length ? (
                  <div className="ns-context__agents">
                    {selectedMeta.participatingAgentIds.map(id => (
                      <div key={id} className="ns-context__agent-row">
                        <div className="ns-agent-dot" style={{ background: '#6b7280' }} />
                        {getAgentName(id)}
                        <span className="ns-participation-badge ns-participation-badge--planned">Planned</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="ns-unknown">No additional agents</span>
                )}
              </div>
            </div>

            {/* Runtime State */}
            <div className="ns-context__section">
              <div className="ns-context__label">Runtime State</div>
              <div className="ns-context__value">
                <div className="ns-context__runtime">
                  <span>Source: {healthSource}</span>
                  <span>SSE: {sseConnected ? 'Connected' : 'Disconnected'}</span>
                  <span>Events: {sessionEvents.length}</span>
                </div>
              </div>
            </div>

            {/* Related Files */}
            <div className="ns-context__section">
              <div className="ns-context__label">Workspace Files ({activeRuntimeAgentId})</div>
              <div className="ns-context__value">
                {workspaceError ? (
                  <span className="ns-unknown" style={{ color: '#ef4444' }}>{workspaceError}</span>
                ) : workspaceFiles.length > 0 ? (
                  <div className="ns-context__files">
                    {workspaceFiles.filter(f => f.type === 'file').slice(0, 10).map(f => (
                      <button
                        key={f.path}
                        className="ns-context__file"
                        onClick={() => openFile(f.path)}
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="ns-unknown">No files available</span>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="ns-context__section">
              <div className="ns-context__label">Recent Activity</div>
              <div className="ns-context__value">
                {sseEvents.length > 0 ? (
                  <div className="ns-context__activity">
                    {sseEvents.slice(-5).reverse().map(evt => (
                      <div key={evt.id} className="ns-context__activity-item">
                        <span className="ns-context__activity-type">{evt.type}</span>
                        <span className="ns-context__activity-time">{formatTime(new Date(evt.timestamp).getTime())}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="ns-unknown">No recent activity</span>
                )}
              </div>
            </div>

            {/* Result */}
            <div className="ns-context__section">
              <div className="ns-context__label">Result</div>
              <div className="ns-context__value">
                <span className="ns-unknown">No result yet</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="ns-context__empty">
            Select a session to view context
          </div>
        )}
      </aside>

      {/* ── File Viewer Drawer ── */}
      {contextFile && (
        <div className="ns-drawer-overlay" onClick={() => setContextFile(null)}>
          <div className="ns-drawer" onClick={e => e.stopPropagation()}>
            <div className="ns-drawer__header">
              <h3 className="ns-drawer__title">{contextFile.name}</h3>
              <button className="ns-drawer__close" onClick={() => setContextFile(null)}>×</button>
            </div>
            <pre className="ns-drawer__content">{contextFile.content}</pre>
          </div>
        </div>
      )}

      {/* ── New Session Dialog ── */}
      {showNewSession && (
        <div className="ns-dialog-overlay" onClick={() => setShowNewSession(false)}>
          <div className="ns-dialog" onClick={e => e.stopPropagation()}>
            <h3 className="ns-dialog__title">New Session</h3>

            <label className="ns-dialog__label">
              Title
              <input
                className="ns-input"
                value={newSessionTitle}
                onChange={e => setNewSessionTitle(e.target.value)}
                placeholder="Session title..."
                autoFocus
              />
            </label>

            <label className="ns-dialog__label">
              Objective
              <textarea
                className="ns-input ns-input--textarea"
                value={newSessionObjective}
                onChange={e => setNewSessionObjective(e.target.value)}
                placeholder="What should this session accomplish?"
                rows={3}
              />
            </label>

            <label className="ns-dialog__label">
              Primary Agent
              <select
                className="ns-input"
                value={newSessionAgent}
                onChange={e => setNewSessionAgent(e.target.value)}
              >
                {CANONICAL_AGENTS.map(a => (
                  <option key={a.id} value={a.id}>{a.name} — {a.role}</option>
                ))}
              </select>
            </label>

            <div className="ns-dialog__actions">
              <button
                className="ns-btn ns-btn--ghost"
                onClick={() => setShowNewSession(false)}
              >
                Cancel
              </button>
              <button
                className="ns-btn ns-btn--primary"
                onClick={createSession}
                disabled={!newSessionTitle.trim() || sending}
              >
                {sending ? 'Creating...' : 'Create Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Tab Bar ── */}
      <nav className="ns-mobile-tabs">
        <button
          className={`ns-mobile-tab ${mobileTab === 'sessions' ? 'ns-mobile-tab--active' : ''}`}
          onClick={() => setMobileTab('sessions')}
        >
          Sessions
        </button>
        <button
          className={`ns-mobile-tab ${mobileTab === 'workroom' ? 'ns-mobile-tab--active' : ''}`}
          onClick={() => setMobileTab('workroom')}
        >
          Workroom
        </button>
        <button
          className={`ns-mobile-tab ${mobileTab === 'context' ? 'ns-mobile-tab--active' : ''}`}
          onClick={() => setMobileTab('context')}
        >
          Context
        </button>
      </nav>
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────── */

function SessionItem({
  session,
  selected,
  onClick,
}: {
  session: { key: string; updatedAt: number };
  selected: boolean;
  onClick: () => void;
}) {
  const meta = getSessionMeta(session.key);
  const title = deriveSessionTitle(session.key, meta || undefined);
  const source = classifySessionSource(session.key);
  const badge = getSourceBadge(source);
  const agentName = meta?.primaryAgentId
    ? getAgentName(meta.primaryAgentId)
    : getAgentName(session.key.split(':')[1] || '');

  return (
    <button
      className={`ns-nav__item ${selected ? 'ns-nav__item--selected' : ''}`}
      onClick={onClick}
    >
      <div className="ns-nav__item-title">{title}</div>
      <div className="ns-nav__item-meta">
        <span className="ns-nav__item-agent">{agentName}</span>
        <span
          className="ns-badge ns-badge--xs"
          style={{ background: badge.color + '20', color: badge.color, borderColor: badge.color + '40' }}
        >
          {badge.label}
        </span>
        <span className="ns-nav__item-time">{formatRelativeTime(session.updatedAt)}</span>
      </div>
    </button>
  );
}

function TimelineEntry({ item, pending }: { item: TimelineItem; pending?: boolean }) {
  const display = getTimelineTypeDisplay(item.type);

  if (item.type === 'user-message') {
    return (
      <div className={`ns-tl ns-tl--user ${pending ? 'ns-tl--pending' : ''}`}>
        <div className="ns-tl__bubble ns-tl__bubble--user">
          {item.text}
        </div>
        <div className="ns-tl__time">{formatTime(item.timestamp)}</div>
      </div>
    );
  }

  if (item.type === 'agent-response') {
    return (
      <div className={`ns-tl ns-tl--agent ${pending ? 'ns-tl--pending' : ''}`}>
        <div className="ns-tl__avatar">
          <div className="ns-agent-dot ns-agent-dot--lg" style={{ background: '#8b5cf6' }} />
        </div>
        <div>
          <div className="ns-tl__bubble ns-tl__bubble--agent">
            {item.text}
          </div>
          <div className="ns-tl__time">
            {item.agentId && <span className="ns-tl__agent">{getAgentName(item.agentId)}</span>}
            {formatTime(item.timestamp)}
            {item.source === 'LIVE' && <span className="ns-tl__source">LIVE</span>}
          </div>
        </div>
      </div>
    );
  }

  // System, tool, connection, error events
  return (
    <div className="ns-tl ns-tl--event">
      <span className="ns-tl__event-icon" style={{ color: display.color }}>{display.icon}</span>
      <span className="ns-tl__event-text">{item.text}</span>
      <span className="ns-tl__time">{formatTime(item.timestamp)}</span>
    </div>
  );
}
