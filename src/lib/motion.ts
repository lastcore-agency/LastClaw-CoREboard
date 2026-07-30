/* ────────────────────────────────────────────────────────────
   Agent Motion System
   State machine for walking, idle, at-desk, etc.
   ──────────────────────────────────────────────────────────── */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Agent, CharacterDirection } from '../types';

export type AgentMotionState =
  | 'idle'
  | 'walking'
  | 'atDesk'
  | 'talking'
  | 'receiving'
  | 'offline'
  | 'unknown';

export interface MotionTarget {
  x: number;
  y: number;
}

const WALK_SPEED = 3; // percent per frame (~60fps)
const DIRECTION_THRESHOLD = 2; // minimum delta to pick a direction

/** Determine facing direction from movement vector */
export function getDirectionFromDelta(dx: number, dy: number): CharacterDirection {
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  if (absDx < DIRECTION_THRESHOLD && absDy < DIRECTION_THRESHOLD) return 'front';
  if (absDx > absDy) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'front' : 'back';
}

/** Get the animated walking asset path for an agent and direction */
export function getWalkingAsset(agent: Agent, direction: CharacterDirection): string {
  // Walking uses the animated WebP for the given direction
  const base = agent.character.animated.replace(/idle-[^.]+/, '');
  return `/characters/${agent.id}/walk-${direction}.webp` || agent.character.animated;
}

/** Get the static idle asset for an agent and direction */
export function getStaticAsset(agent: Agent, direction: CharacterDirection = 'front'): string {
  return `/characters/${agent.id}/static-${direction}.webp` || agent.character.static;
}

/** Get the animated idle asset for an agent and direction */
export function getAnimatedIdleAsset(agent: Agent, direction: CharacterDirection = 'front'): string {
  // Use directional asset if available, fallback to character.animated
  return `/characters/${agent.id}/idle-${direction}.webp` || agent.character.animated;
}

/** Derive motion state from runtime data */
export function deriveMotionState(agent: Agent, isMock: boolean): AgentMotionState {
  if (agent.status === 'offline') return 'offline';
  if (agent.status === 'error') return 'unknown';
  // In LIVE mode, agents are at their desk (no fake movement)
  if (!isMock) return 'atDesk';
  // In MOCK mode, derive from status
  if (agent.status === 'working') return 'atDesk';
  if (agent.status === 'online') return 'idle';
  if (agent.status === 'busy') return 'atDesk';
  if (agent.status === 'waiting') return 'idle';
  return 'unknown';
}

export interface UseAgentMotionOptions {
  agent: Agent;
  currentX: number;
  currentY: number;
  targetX?: number;
  targetY?: number;
  isMock: boolean;
  enabled?: boolean; // false = no walking (LIVE mode)
}

export interface UseAgentMotionResult {
  motionState: AgentMotionState;
  displayX: number;
  displayY: number;
  facing: CharacterDirection;
  displayAsset: string;
  isWalking: boolean;
  /** Call to trigger a walk to a target position */
  walkTo: (x: number, y: number) => void;
  /** Cancel current walk */
  cancelWalk: () => void;
}

/**
 * Hook that manages agent motion state.
 * In LIVE mode (isMock=false), agents stay at their desk — no fake walking.
 * In MOCK mode, agents can walk between positions on command.
 */
export function useAgentMotion({
  agent,
  currentX,
  currentY,
  targetX,
  targetY,
  isMock,
  enabled = true,
}: UseAgentMotionOptions): UseAgentMotionResult {
  const [state, setState] = useState<AgentMotionState>(() => deriveMotionState(agent, isMock));
  const [pos, setPos] = useState({ x: currentX, y: currentY });
  const [facing, setFacing] = useState<CharacterDirection>('front');
  const walkRef = useRef<{ raf: number; target: MotionTarget } | null>(null);

  // Reset state when agent changes
  useEffect(() => {
    setState(deriveMotionState(agent, isMock));
    setPos({ x: currentX, y: currentY });
    setFacing('front');
  }, [agent.id, isMock]);

  // Update position when props change (e.g., layout edit)
  useEffect(() => {
    if (state !== 'walking') {
      setPos({ x: currentX, y: currentY });
    }
  }, [currentX, currentY, state]);

  const cancelWalk = useCallback(() => {
    if (walkRef.current) {
      cancelAnimationFrame(walkRef.current.raf);
      walkRef.current = null;
    }
  }, []);

  const walkTo = useCallback((tx: number, ty: number) => {
    if (!enabled || !isMock) return;
    cancelWalk();
    setState('walking');

    const animate = () => {
      setPos((prev) => {
        const dx = tx - prev.x;
        const dy = ty - prev.y;
        const dist = Math.hypot(dx, dy);

        if (dist < WALK_SPEED) {
          // Arrived
          setState('atDesk');
          setFacing('front');
          cancelWalk();
          return { x: tx, y: ty };
        }

        // Move toward target
        const nx = prev.x + (dx / dist) * WALK_SPEED;
        const ny = prev.y + (dy / dist) * WALK_SPEED;

        // Update facing direction
        const dir = getDirectionFromDelta(dx, dy);
        setFacing(dir);

        return { x: nx, y: ny };
      });

      walkRef.current.raf = requestAnimationFrame(animate);
    };

    walkRef.current = { raf: requestAnimationFrame(animate), target: { x: tx, y: ty } };
  }, [enabled, isMock, cancelWalk]);

  // Cleanup on unmount
  useEffect(() => cancelWalk, [cancelWalk]);

  // Determine display asset
  let displayAsset = agent.character.animated;
  if (state === 'walking') {
    displayAsset = getWalkingAsset(agent, facing);
  } else if (state === 'atDesk' || state === 'idle') {
    displayAsset = getAnimatedIdleAsset(agent, facing);
  } else if (state === 'offline') {
    displayAsset = getStaticAsset(agent, 'front');
  }

  return {
    motionState: state,
    displayX: pos.x,
    displayY: pos.y,
    facing,
    displayAsset,
    isWalking: state === 'walking',
    walkTo,
    cancelWalk,
  };
}
