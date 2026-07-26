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

      const rawStatus = (rtAgent.availability || "").toUpperCase();
      let status: AgentStatus = "offline";
      if (rawStatus === "WORKING") status = "working";
      else if (rawStatus === "ONLINE") status = "online";
      else if (rawStatus === "BUSY") status = "busy";
      else if (rawStatus === "WAITING") status = "waiting";
      else if (rawStatus === "OFFLINE") status = "offline";
      else if (rawStatus === "ERROR") status = "error";

      if (teamMatch) {
        // Agent exists in team registry
        merged.push({
          ...teamMatch,
          status,
          model: rtAgent.model || teamMatch.model,
          workspace: rtAgent.workspace || teamMatch.workspace,
          source: source,
        });
      } else {
        // Agent present in runtime but absent from Team registry -> neutral fallback identity
        merged.push({
          id: canonicalId,
          displayName: rtAgent.name || canonicalId,
          role: "Runtime Agent",
          status,
          currentTask: "Awaiting tasks",
          model: rtAgent.model || "unknown",
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
          bubble: "Hi there.",
          color: "var(--color-slate-400)",
          uptime: "0m",
          queue: "0",
          latency: "0ms",
          memory: "0MB",
          lastActive: "just now",
          sessionId: "",
          workspace: rtAgent.workspace || "",
          recentActivity: [],
          runtimeHealth: "healthy",
          skills: [],
        });
      }
    }

    // 2. Add remaining Team agents not present in runtime
    for (const teamAgent of teamIdentity) {
      if (!runtimeIds.has(teamAgent.id)) {
        merged.push({
          ...teamAgent,
          status: "offline",
          currentTask: "Unavailable",
          source: source === "LIVE" || source === "CACHED" ? "EMPTY" : source,
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
    const isLive = json.source === "LIVE";

    return {
      status: isLive && json.data?.ok ? "online" : "offline",
      latency: (json.data?.durationMs || 0) + "ms",
      cpu: "Unknown",
      ram: "Unknown",
      queue: "0",
      sessions: 0,
      source: json.source || "ERROR",
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
