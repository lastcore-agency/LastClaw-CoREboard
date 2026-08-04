import express from 'express';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const flowsRouter = express.Router();

type FlowRow = {
  flow_id: string;
  revision: number;
  status: string;
  current_step: string | null;
  state_json: string | null;
  created_at: number;
  updated_at: number;
  ended_at: number | null;
};

type PublicFlowState = {
  runId?: string;
  status?: string;
  phase?: string;
  activeAgent?: string;
  currentStep?: string;
  completedSteps?: string[];
  failedStep?: string;
  events?: Array<{ type?: string; step?: string; agent?: string; timestamp?: string }>;
};

function toIso(value: number | null): string | null {
  return value ? new Date(value).toISOString() : null;
}

function readLatestSixSquadFlow(): Record<string, unknown> | null {
  const databasePath = process.env.OPENCLAW_STATE_DB
    || path.join(os.homedir(), '.openclaw', 'state', 'openclaw.sqlite');
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const row = db.prepare(`
      SELECT flow_id, revision, status, current_step, state_json,
             created_at, updated_at, ended_at
      FROM flow_runs
      WHERE controller_id = 'six-squad-flow/last-news'
      ORDER BY created_at DESC
      LIMIT 1
    `).get() as FlowRow | undefined;
    if (!row) return null;

    let state: PublicFlowState = {};
    try {
      state = row.state_json ? JSON.parse(row.state_json) as PublicFlowState : {};
    } catch {
      state = {};
    }

    return {
      flowId: row.flow_id,
      runId: state.runId ?? null,
      dbStatus: row.status,
      status: state.status ?? row.status.toUpperCase(),
      phase: state.phase ?? 'unknown',
      activeAgent: state.activeAgent ?? null,
      currentStep: state.currentStep ?? row.current_step,
      completedSteps: Array.isArray(state.completedSteps) ? state.completedSteps : [],
      failedStep: state.failedStep ?? null,
      events: Array.isArray(state.events) ? state.events.slice(-30) : [],
      revision: row.revision,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
      endedAt: toIso(row.ended_at),
    };
  } finally {
    db.close();
  }
}

flowsRouter.get('/flows/current', (_req, res) => {
  try {
    const data = readLatestSixSquadFlow();
    res.json({
      data,
      source: data ? 'REAL' : 'EMPTY',
      observedAt: new Date().toISOString(),
      stale: false,
    });
  } catch (error) {
    res.status(503).json({
      data: null,
      source: 'ERROR',
      observedAt: new Date().toISOString(),
      stale: false,
      error: {
        code: 'FLOW_STATE_UNAVAILABLE',
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
});
