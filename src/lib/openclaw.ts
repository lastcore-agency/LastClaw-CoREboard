/* ────────────────────────────────────────────────────────────
   OpenClaw client library
   ──────────────────────────────────────────────────────────── */

import { mockAgents, mockGateway } from "../data/mockAgents";
import type { Agent, GatewaySnapshot, DataSource, AgentStatus } from "../types";

const apiBase = import.meta.env.VITE_OPENCLAW_API_BASE || "/api/runtime";
const useMock = String(import.meta.env.VITE_USE_MOCK || "false") === "true";

function wait(ms = 150) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Format unix ms timestamp as human-readable relative time (e.g. "17m ago") */
function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 0) return 'just now';
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}


/** Normalize a model field that may be a string or {primary, fallbacks} object */
function normalizeModel(model: unknown): string {
  if (!model) return '';
  if (typeof model === 'string') return model;
  if (typeof model === 'object' && model !== null && 'primary' in model) {
    return String((model as { primary: unknown }).primary || '');
  }
  try { return JSON.stringify(model); } catch { return ''; }
}

/** Map a raw availability string from the gateway to a canonical AgentStatus */
export function mapAvailabilityToStatus(raw: string | undefined | null): AgentStatus {
  const up = (raw || '').toUpperCase();
  if (up === 'WORKING') return 'working';
  if (up === 'ONLINE') return 'online';
  if (up === 'BUSY') return 'busy';
  if (up === 'WAITING') return 'waiting';
  if (up === 'OFFLINE') return 'offline';
  if (up === 'ERROR') return 'error';
  return 'unknown';
}

export async function fetchAgents(): Promise<Agent[]> {
  if (useMock) {
    await wait();
    return structuredClone(mockAgents).map((a) => ({
      ...a,
      source: "MOCK" as DataSource,
    }));
  }

  try {
    const response = await fetch(`${apiBase}/agents`);
    if (!response.ok) throw new Error("Failed to fetch runtime agents");
    const json = await response.json();
    const runtimeAgents = json.data || [];
    const source: DataSource = json.source || "ERROR";

    // Merge logic: Combine Team Identity (mockAgents) with runtime data
    const teamIdentity = structuredClone(mockAgents);
    const merged: Agent[] = [];

    // 1. Process runtime agents
    const runtimeIds = new Set<string>();
    for (const rtAgent of runtimeAgents) {
      const canonicalId = rtAgent.id;
      runtimeIds.add(canonicalId);
      const teamMatch = teamIdentity.find((a) => a.id === canonicalId);

      const status = mapAvailabilityToStatus(rtAgent.availability);

      if (teamMatch) {
        // Agent exists in team registry
        merged.push({
          ...teamMatch,
          status,
          model: normalizeModel(rtAgent.model) || teamMatch.model,
          workspace: typeof rtAgent.workspace === 'string' ? rtAgent.workspace : (teamMatch.workspace || ""),
          source: source,
          // Runtime telemetry — truthful fields from LIVE payload
          runtimeAgentId: rtAgent.runtimeAgentId || rtAgent.id || teamMatch.id,
          isDefault: rtAgent.isDefault,
          sessionCount: rtAgent.sessionCount,
          lastActiveAt: rtAgent.lastActiveAt,
          channelConnected: rtAgent.channelConnected,
          channelRunning: rtAgent.channelRunning,
          channelConfigured: rtAgent.channelConfigured,
          channelEnabled: rtAgent.channelEnabled,
          channelReconnectPending: rtAgent.channelReconnectPending,
          channelReconnectAttempts: rtAgent.channelReconnectAttempts,
          lastChannelConnectedAt: rtAgent.lastChannelConnectedAt ?? null,
          lastChannelEventAt: rtAgent.lastChannelEventAt ?? null,
          lastChannelActivityAt: rtAgent.lastChannelActivityAt ?? null,
          lastChannelInboundAt: rtAgent.lastChannelInboundAt ?? null,
          lastChannelOutboundAt: rtAgent.lastChannelOutboundAt ?? null,
          channelLastError: rtAgent.channelLastError ?? null,
          heartbeatEnabled: rtAgent.heartbeatEnabled,
          heartbeatIntervalMs: rtAgent.heartbeatIntervalMs,
          resolvedModel: rtAgent.resolvedModel,
          configuredModel: rtAgent.configuredModel,
          // Override MOCK display fields with Unavailable — no fabricated data
          uptime: 'Unavailable',
          queue: 'Unavailable',
          latency: 'Unavailable',
          memory: 'Unavailable',
          // lastActive: human-readable from lastActiveAt when available
          lastActive: rtAgent.lastActiveAt
            ? formatRelativeTime(rtAgent.lastActiveAt)
            : 'Unavailable',
          sessionId: '',
          currentTask: 'Unavailable',
          runtimeHealth: 'degraded',
          recentActivity: [],
        });
      } else {
        // Agent present in runtime but absent from Team registry -> neutral fallback identity
        merged.push({
          id: canonicalId,
          displayName: rtAgent.name || canonicalId,
          role: "Runtime Agent",
          status,
          currentTask: "Unavailable",
          model: normalizeModel(rtAgent.model) || "unknown",
          progress: 0,
          room: "unknown",
          avatar: "/avatar-fallback.webp",
          source: source,
          x: 50,
          y: 50,
          position: {
            desktop: { x: 50, y: 50, scale: 1 },
            tablet: { x: 50, y: 50, scale: 1 },
            mobile: { x: 50, y: 50, scale: 1 },
          },
          character: { animated: "", static: "", direction: "front" },
          bubble: "",
          color: "var(--color-slate-400)",
          uptime: "Unavailable",
          queue: "Unavailable",
          latency: "Unavailable",
          memory: "Unavailable",
          lastActive: rtAgent.lastActiveAt
            ? formatRelativeTime(rtAgent.lastActiveAt)
            : "Unavailable",
          sessionId: "",
          workspace: rtAgent.workspace || "",
          recentActivity: [],
          runtimeHealth: "degraded",
          skills: [],
          // Runtime telemetry
          runtimeAgentId: rtAgent.runtimeAgentId || rtAgent.id || canonicalId,
          isDefault: rtAgent.isDefault,
          sessionCount: rtAgent.sessionCount,
          lastActiveAt: rtAgent.lastActiveAt,
          channelConnected: rtAgent.channelConnected,
          channelRunning: rtAgent.channelRunning,
          channelConfigured: rtAgent.channelConfigured,
          channelEnabled: rtAgent.channelEnabled,
          channelReconnectPending: rtAgent.channelReconnectPending,
          channelReconnectAttempts: rtAgent.channelReconnectAttempts,
          lastChannelConnectedAt: rtAgent.lastChannelConnectedAt ?? null,
          lastChannelEventAt: rtAgent.lastChannelEventAt ?? null,
          lastChannelActivityAt: rtAgent.lastChannelActivityAt ?? null,
          lastChannelInboundAt: rtAgent.lastChannelInboundAt ?? null,
          lastChannelOutboundAt: rtAgent.lastChannelOutboundAt ?? null,
          channelLastError: rtAgent.channelLastError ?? null,
          heartbeatEnabled: rtAgent.heartbeatEnabled,
          heartbeatIntervalMs: rtAgent.heartbeatIntervalMs,
          resolvedModel: rtAgent.resolvedModel,
          configuredModel: rtAgent.configuredModel,
        });
      }
    }

    // 2. Add remaining Team agents not present in runtime (offline / not discovered)
    for (const teamAgent of teamIdentity) {
      if (!runtimeIds.has(teamAgent.id)) {
        merged.push({
          ...teamAgent,
          status: 'offline',
          // Override ALL dynamic mock fields — do not show fabricated data for offline agents
          currentTask: 'Unavailable',
          uptime: 'Unavailable',
          queue: 'Unavailable',
          latency: 'Unavailable',
          memory: 'Unavailable',
          lastActive: 'Unavailable',
          sessionId: '',
          runtimeHealth: 'degraded',
          recentActivity: [],
          source: source === 'LIVE' || source === 'CACHED' ? 'EMPTY' : source,
        });
      }
    }

    return merged;
  } catch (err) {
    console.error("fetchAgents error:", err);
    // If everything fails, preserve team identity with ERROR status
    return structuredClone(mockAgents).map((a) => ({
      ...a,
      status: "error",
      source: "ERROR" as DataSource,
    }));
  }
}

export async function fetchGateway(): Promise<GatewaySnapshot> {
  if (useMock) {
    await wait();
    return { ...structuredClone(mockGateway), source: "MOCK" as DataSource };
  }

  try {
    const response = await fetch(`${apiBase}/health`);
    if (!response.ok) throw new Error("Failed to fetch gateway health");
    const json = await response.json();
    const isLive = json.source === "LIVE" || json.source === "CACHED";

    return {
      status: isLive && json.data?.ok ? "online" : "offline",
      latency: (json.data?.durationMs || 0) + "ms",
      cpu: "Unknown",
      ram: "Unknown",
      queue: "0",
      sessions: 0,
      source: json.source || "ERROR",
      // Envelope fields
      ok: json.data?.ok ?? false,
      observedAt: json.observedAt,
      stale: json.stale ?? false,
      // Normalized telemetry
      normalizedChannels: json.data?.normalizedChannels ?? [],
      deliveryQueueFailures: json.data?.deliveryQueueFailures ?? [],
    };
  } catch (err) {
    console.error("fetchGateway error:", err);
    return {
      status: "offline",
      latency: "0ms",
      cpu: "0%",
      ram: "0MB",
      queue: "0",
      sessions: 0,
      source: "ERROR",
      normalizedChannels: [],
      deliveryQueueFailures: [],
    };
  }
}

export async function updateAgentConfig(
  agentId: string,
  patch: Partial<Agent>,
): Promise<Agent> {
  if (useMock) {
    await wait();
    const existing = mockAgents.find((item) => item.id === agentId);
    if (!existing) throw new Error("Agent not found");
    return { ...structuredClone(existing), ...patch };
  }
  // Not implemented in backend for this phase
  throw new Error("updateAgentConfig not supported in this phase");
}

export async function restartAgent(agentId: string): Promise<void> {
  if (useMock) {
    await wait();
    return;
  }
  throw new Error("restartAgent not supported in this phase");
}

export async function pauseAgent(agentId: string): Promise<void> {
  if (useMock) {
    await wait();
    return;
  }
  throw new Error("pauseAgent not supported in this phase");
}
