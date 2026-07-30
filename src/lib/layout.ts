/* ────────────────────────────────────────────────────────────
   Layout system for Visual Office
   Slot-based agent placement with drag & drop
   ──────────────────────────────────────────────────────────── */

export interface SlotPosition {
  x: number;
  y: number;
  scale: number;
}

export interface LayoutSlot {
  id: string;
  label: string;
  desktop: SlotPosition;
  mobile: SlotPosition;
  facing: 'front' | 'back' | 'left' | 'right';
  type: 'desk' | 'hub' | 'zone';
}

export interface LayoutState {
  schemaVersion: number;
  selectedSceneId: string;
  layouts: Record<string, Record<string, string>>; // sceneId -> { agentId -> slotId }
}

const LAYOUT_STORAGE_KEY = 'coreboard:layout';
const LAYOUT_SCHEMA_VERSION = 1;

/** Default slot positions per scene */
export const SCENE_SLOTS: Record<string, LayoutSlot[]> = {
  'office-1': [
    { id: 'command-desk',   label: 'Command Desk',   desktop: { x: 18, y: 38, scale: 1 },   mobile: { x: 22, y: 30, scale: 0.8 },  facing: 'front', type: 'desk' },
    { id: 'dev-desk',       label: 'Dev Desk',       desktop: { x: 52, y: 32, scale: 1 },   mobile: { x: 50, y: 26, scale: 0.8 },  facing: 'front', type: 'desk' },
    { id: 'orch-desk',      label: 'Orch Desk',      desktop: { x: 72, y: 32, scale: 1 },   mobile: { x: 78, y: 26, scale: 0.8 },  facing: 'front', type: 'desk' },
    { id: 'qa-zone',        label: 'QA Zone',        desktop: { x: 18, y: 72, scale: 1 },   mobile: { x: 22, y: 62, scale: 0.8 },  facing: 'front', type: 'zone' },
    { id: 'infra-zone',     label: 'Infra Zone',     desktop: { x: 82, y: 72, scale: 1 },   mobile: { x: 78, y: 62, scale: 0.8 },  facing: 'right', type: 'zone' },
    { id: 'center-hub',     label: 'Center Hub',     desktop: { x: 50, y: 55, scale: 1 },   mobile: { x: 50, y: 48, scale: 0.8 },  facing: 'front', type: 'hub' },
  ],
  'office-2': [
    { id: 'command-desk',   label: 'Command Desk',   desktop: { x: 20, y: 35, scale: 1 },   mobile: { x: 25, y: 28, scale: 0.8 },  facing: 'front', type: 'desk' },
    { id: 'dev-desk',       label: 'Dev Desk',       desktop: { x: 50, y: 30, scale: 1 },   mobile: { x: 50, y: 24, scale: 0.8 },  facing: 'front', type: 'desk' },
    { id: 'orch-desk',      label: 'Orch Desk',      desktop: { x: 75, y: 35, scale: 1 },   mobile: { x: 75, y: 28, scale: 0.8 },  facing: 'front', type: 'desk' },
    { id: 'qa-zone',        label: 'QA Zone',        desktop: { x: 20, y: 70, scale: 1 },   mobile: { x: 25, y: 60, scale: 0.8 },  facing: 'front', type: 'zone' },
    { id: 'infra-zone',     label: 'Infra Zone',     desktop: { x: 80, y: 70, scale: 1 },   mobile: { x: 75, y: 60, scale: 0.8 },  facing: 'right', type: 'zone' },
    { id: 'center-hub',     label: 'Center Hub',     desktop: { x: 50, y: 55, scale: 1 },   mobile: { x: 50, y: 46, scale: 0.8 },  facing: 'front', type: 'hub' },
  ],
  'office-3': [
    { id: 'command-desk',   label: 'Command Desk',   desktop: { x: 22, y: 32, scale: 1 },   mobile: { x: 25, y: 26, scale: 0.8 },  facing: 'front', type: 'desk' },
    { id: 'dev-desk',       label: 'Dev Desk',       desktop: { x: 48, y: 28, scale: 1 },   mobile: { x: 48, y: 22, scale: 0.8 },  facing: 'front', type: 'desk' },
    { id: 'orch-desk',      label: 'Orch Desk',      desktop: { x: 74, y: 32, scale: 1 },   mobile: { x: 72, y: 26, scale: 0.8 },  facing: 'front', type: 'desk' },
    { id: 'qa-zone',        label: 'QA Zone',        desktop: { x: 22, y: 68, scale: 1 },   mobile: { x: 25, y: 58, scale: 0.8 },  facing: 'front', type: 'zone' },
    { id: 'infra-zone',     label: 'Infra Zone',     desktop: { x: 78, y: 68, scale: 1 },   mobile: { x: 72, y: 58, scale: 0.8 },  facing: 'right', type: 'zone' },
    { id: 'center-hub',     label: 'Center Hub',     desktop: { x: 50, y: 52, scale: 1 },   mobile: { x: 50, y: 44, scale: 0.8 },  facing: 'front', type: 'hub' },
  ],
  'office-4': [
    { id: 'command-desk',   label: 'Command Desk',   desktop: { x: 16, y: 36, scale: 1 },   mobile: { x: 20, y: 28, scale: 0.8 },  facing: 'front', type: 'desk' },
    { id: 'dev-desk',       label: 'Dev Desk',       desktop: { x: 54, y: 30, scale: 1 },   mobile: { x: 52, y: 24, scale: 0.8 },  facing: 'front', type: 'desk' },
    { id: 'orch-desk',      label: 'Orch Desk',      desktop: { x: 78, y: 36, scale: 1 },   mobile: { x: 76, y: 28, scale: 0.8 },  facing: 'front', type: 'desk' },
    { id: 'qa-zone',        label: 'QA Zone',        desktop: { x: 16, y: 74, scale: 1 },   mobile: { x: 20, y: 64, scale: 0.8 },  facing: 'front', type: 'zone' },
    { id: 'infra-zone',     label: 'Infra Zone',     desktop: { x: 84, y: 74, scale: 1 },   mobile: { x: 76, y: 64, scale: 0.8 },  facing: 'right', type: 'zone' },
    { id: 'center-hub',     label: 'Center Hub',     desktop: { x: 50, y: 54, scale: 1 },   mobile: { x: 50, y: 46, scale: 0.8 },  facing: 'front', type: 'hub' },
  ],
};

/** Default agent→slot assignments per scene */
const DEFAULT_ASSIGNMENTS: Record<string, Record<string, string>> = {
  'office-1': { sirius: 'command-desk', draco: 'dev-desk', polaris: 'orch-desk', antares: 'qa-zone', altair: 'infra-zone', capella: 'center-hub' },
  'office-2': { sirius: 'command-desk', draco: 'dev-desk', polaris: 'orch-desk', antares: 'qa-zone', altair: 'infra-zone', capella: 'center-hub' },
  'office-3': { sirius: 'command-desk', draco: 'dev-desk', polaris: 'orch-desk', antares: 'qa-zone', altair: 'infra-zone', capella: 'center-hub' },
  'office-4': { sirius: 'command-desk', draco: 'dev-desk', polaris: 'orch-desk', antares: 'qa-zone', altair: 'infra-zone', capella: 'center-hub' },
};

/** Get slot position for a breakpoint */
export function getSlotPosition(slot: LayoutSlot, isMobile: boolean): SlotPosition {
  return isMobile ? slot.mobile : slot.desktop;
}

/** Load layout from localStorage */
export function loadLayout(): LayoutState {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return createDefaultLayout();
    const parsed = JSON.parse(raw);
    if (parsed?.schemaVersion === LAYOUT_SCHEMA_VERSION) return parsed;
    return createDefaultLayout();
  } catch { return createDefaultLayout(); }
}

/** Save layout to localStorage */
export function saveLayout(state: LayoutState): void {
  localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(state));
}

/** Create default layout state */
export function createDefaultLayout(): LayoutState {
  return {
    schemaVersion: LAYOUT_SCHEMA_VERSION,
    selectedSceneId: 'office-1',
    layouts: { ...DEFAULT_ASSIGNMENTS },
  };
}

/** Get the slot ID that an agent is assigned to in a scene */
export function getAgentSlotId(layout: LayoutState, sceneId: string, agentId: string): string | undefined {
  return layout.layouts[sceneId]?.[agentId];
}

/** Get the slot object for an agent */
export function getAgentSlot(layout: LayoutState, sceneId: string, agentId: string): LayoutSlot | undefined {
  const slotId = getAgentSlotId(layout, sceneId, agentId);
  if (!slotId) return undefined;
  return SCENE_SLOTS[sceneId]?.find((s) => s.id === slotId);
}

/** Get which agent occupies a slot (or undefined) */
export function getSlotAgent(layout: LayoutState, sceneId: string, slotId: string): string | undefined {
  const assignments = layout.layouts[sceneId];
  if (!assignments) return undefined;
  for (const [agentId, assignedSlotId] of Object.entries(assignments)) {
    if (assignedSlotId === slotId) return agentId;
  }
  return undefined;
}

/** Move an agent to a slot. If occupied, swap. */
export function moveAgentToSlot(
  layout: LayoutState,
  sceneId: string,
  agentId: string,
  targetSlotId: string,
): LayoutState {
  const newLayouts = { ...layout.layouts };
  const sceneAssignments = { ...(newLayouts[sceneId] || {}) };

  // Find who's currently in the target slot
  const occupantId = getSlotAgent(layout, sceneId, targetSlotId);
  const agentCurrentSlot = sceneAssignments[agentId];

  // If agent is already in this slot, no-op
  if (agentCurrentSlot === targetSlotId) return layout;

  // If slot is occupied, swap
  if (occupantId && occupantId !== agentId) {
    sceneAssignments[occupantId] = agentCurrentSlot || '';
  }

  // Move agent to target slot
  sceneAssignments[agentId] = targetSlotId;

  newLayouts[sceneId] = sceneAssignments;
  return { ...layout, layouts: newLayouts };
}

/** Reset layout to defaults */
export function resetLayout(): LayoutState {
  return createDefaultLayout();
}
