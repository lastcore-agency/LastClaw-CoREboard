import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createDefaultLayout, getAgentSlotId, getAgentSlot, getSlotAgent,
  moveAgentToSlot, getSlotPosition, SCENE_SLOTS, resetLayout,
} from '../../src/lib/layout.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createDefaultLayout', () => {
  it('creates layout with schemaVersion 1', () => {
    const layout = createDefaultLayout();
    expect(layout.schemaVersion).toBe(1);
  });

  it('defaults to office-1', () => {
    const layout = createDefaultLayout();
    expect(layout.selectedSceneId).toBe('office-1');
  });

  it('has all 4 scenes', () => {
    const layout = createDefaultLayout();
    expect(Object.keys(layout.layouts)).toEqual(
      expect.arrayContaining(['office-1', 'office-2', 'office-3', 'office-4']),
    );
  });

  it('assigns all 6 agents to office-1', () => {
    const layout = createDefaultLayout();
    const agents = Object.keys(layout.layouts['office-1']);
    expect(agents).toHaveLength(6);
    expect(agents).toEqual(expect.arrayContaining(['sirius', 'draco', 'polaris', 'antares', 'altair', 'capella']));
  });
});

describe('getAgentSlotId', () => {
  it('returns slot ID for known agent', () => {
    const layout = createDefaultLayout();
    expect(getAgentSlotId(layout, 'office-1', 'draco')).toBe('dev-desk');
  });

  it('returns undefined for unknown agent', () => {
    const layout = createDefaultLayout();
    expect(getAgentSlotId(layout, 'office-1', 'unknown')).toBeUndefined();
  });
});

describe('getAgentSlot', () => {
  it('returns slot object for known agent', () => {
    const layout = createDefaultLayout();
    const slot = getAgentSlot(layout, 'office-1', 'draco');
    expect(slot).toBeDefined();
    expect(slot!.id).toBe('dev-desk');
    expect(slot!.label).toBe('Dev Desk');
  });

  it('returns undefined for unknown agent', () => {
    const layout = createDefaultLayout();
    expect(getAgentSlot(layout, 'office-1', 'unknown')).toBeUndefined();
  });
});

describe('getSlotAgent', () => {
  it('returns agent ID for occupied slot', () => {
    const layout = createDefaultLayout();
    expect(getSlotAgent(layout, 'office-1', 'command-desk')).toBe('sirius');
  });

  it('returns undefined for unoccupied slot', () => {
    const layout = createDefaultLayout();
    // All slots are occupied in default layout, test with custom
    const custom = { ...layout, layouts: { 'office-1': { sirius: 'command-desk' } } };
    expect(getSlotAgent(custom, 'office-1', 'dev-desk')).toBeUndefined();
  });
});

describe('moveAgentToSlot', () => {
  it('moves agent to empty slot', () => {
    const layout = createDefaultLayout();
    const custom = { ...layout, layouts: { 'office-1': { sirius: 'command-desk', draco: 'dev-desk' } } };
    const moved = moveAgentToSlot(custom, 'office-1', 'draco', 'orch-desk');
    expect(moved.layouts['office-1']['draco']).toBe('orch-desk');
  });

  it('swaps agents when target is occupied', () => {
    const layout = createDefaultLayout();
    const moved = moveAgentToSlot(layout, 'office-1', 'sirius', 'dev-desk');
    expect(moved.layouts['office-1']['sirius']).toBe('dev-desk');
    expect(moved.layouts['office-1']['draco']).toBe('command-desk');
  });

  it('no-ops when agent is already in target slot', () => {
    const layout = createDefaultLayout();
    const moved = moveAgentToSlot(layout, 'office-1', 'draco', 'dev-desk');
    expect(moved).toBe(layout);
  });
});

describe('getSlotPosition', () => {
  it('returns desktop position when isMobile is false', () => {
    const slot = SCENE_SLOTS['office-1'][0];
    const pos = getSlotPosition(slot, false);
    expect(pos).toEqual(slot.desktop);
  });

  it('returns mobile position when isMobile is true', () => {
    const slot = SCENE_SLOTS['office-1'][0];
    const pos = getSlotPosition(slot, true);
    expect(pos).toEqual(slot.mobile);
  });
});

describe('SCENE_SLOTS', () => {
  it('has 6 slots per scene', () => {
    for (const sceneId of Object.keys(SCENE_SLOTS)) {
      expect(SCENE_SLOTS[sceneId]).toHaveLength(6);
    }
  });

  it('has unique slot IDs per scene', () => {
    for (const sceneId of Object.keys(SCENE_SLOTS)) {
      const ids = SCENE_SLOTS[sceneId].map((s: { id: string }) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('resetLayout', () => {
  it('returns default layout', () => {
    const layout = resetLayout();
    expect(layout.schemaVersion).toBe(1);
    expect(layout.selectedSceneId).toBe('office-1');
  });
});
