/**
 * CatSort Game Engine
 * Design: Kawaii Storybook Illustration
 * Core mechanic: stack-sort transport + merge-N vanish with chunk grab
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type ColorId = 'coral' | 'periwinkle' | 'sage' | 'peach' | 'lilac' | 'wild';

export interface Item {
  id: string;
  color: ColorId;
  isWild?: boolean;
  isLocked?: boolean;
  isBomb?: boolean;
  isGoalDouble?: boolean;
}

export interface Container {
  id: string;
  grabNumber: number;       // N — how many items are lifted per tap
  capacity: number;         // max items this container can hold
  stack: Item[];            // index 0 = bottom, last = top
  position: { x: number; y: number };
  // Special container variants
  colorLocked?: ColorId;    // only items of this color may be placed
  frozen?: boolean;         // no vanish runs until thawed
  oneWayOut?: boolean;      // items can only leave, not enter
  oneWayIn?: boolean;       // items can only enter, not leave
  doubleVanish?: boolean;   // vanish in this container scores 2×
  narrow?: boolean;         // capacity smaller than others (already encoded in capacity)
  isGoalContainer?: boolean;// visual hint
}

export interface Chunk {
  items: Item[];            // top-down order (index 0 = was top of source)
  sourceContainerId: string;
}

export type BudgetType = 'moves' | 'time' | 'both';

export interface BudgetConfig {
  type: BudgetType;
  maxMoves?: number;
  maxSeconds?: number;
}

export interface BudgetState {
  movesLeft: number;
  secondsLeft: number;
  type: BudgetType;
}

export type TriggerEvent =
  | 'onMoveComplete'
  | 'onVanishComplete'
  | 'onBudgetWarning'
  | 'onLevelStart';

export type TriggerAction =
  | { type: 'spawnItems'; containerId: string; items: Item[] }
  | { type: 'freezeContainer'; containerId: string }
  | { type: 'thawContainer'; containerId: string }
  | { type: 'grantBudget'; moves?: number; seconds?: number }
  | { type: 'convertItems'; containerId: string; fromColor: ColorId; toColor: ColorId };

export interface LevelTrigger {
  event: TriggerEvent;
  condition?: { movesCompleted?: number; vanishesCompleted?: number };
  action: TriggerAction;
  fired?: boolean;
}

export interface LevelConfig {
  id: number;
  name: string;
  isBoss: boolean;
  palette: ColorId[];
  goalColors: ColorId[];
  mergeSizeK: number;
  budget: BudgetConfig;
  containers: ContainerConfig[];
  triggers: LevelTrigger[];
  starThresholds: { two: number; three: number }; // fraction of budget remaining
}

export interface ContainerConfig {
  id: string;
  grabNumber: number;
  capacity: number;
  startStack: ColorId[];   // bottom to top
  position: { x: number; y: number };
  colorLocked?: ColorId;
  frozen?: boolean;
  oneWayOut?: boolean;
  oneWayIn?: boolean;
  doubleVanish?: boolean;
  narrow?: boolean;
  isGoalContainer?: boolean;
}

export type GamePhase =
  | 'title'
  | 'levelSelect'
  | 'playing'
  | 'levelComplete'
  | 'levelFail'
  | 'paused';

export interface GameState {
  phase: GamePhase;
  levelConfig: LevelConfig | null;
  containers: Container[];
  budget: BudgetState;
  selectedContainerId: string | null;
  chunk: Chunk | null;
  score: number;
  chainLength: number;
  movesCompleted: number;
  vanishesCompleted: number;
  goalProgress: Record<ColorId, { cleared: number; total: number }>;
  stars: number;
  message: string | null;
  particles: Particle[];
  currentLevelIndex: number;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  color: string;
  type: 'heart' | 'star' | 'sparkle';
  vx: number;
  vy: number;
  life: number; // 0-1
  size: number;
}

// ─── Color palette ────────────────────────────────────────────────────────────

export const COLOR_MAP: Record<ColorId, string> = {
  coral:      '#F4A0A0',
  periwinkle: '#A0A8F4',
  sage:       '#A0D4A0',
  peach:      '#F4C880',
  lilac:      '#C8A0F4',
  wild:       '#F4F4A0',
};

export const COLOR_DARK: Record<ColorId, string> = {
  coral:      '#C05050',
  periwinkle: '#4050C0',
  sage:       '#406040',
  peach:      '#C07820',
  lilac:      '#7040C0',
  wild:       '#808040',
};

export const COLOR_EMOJI: Record<ColorId, string> = {
  coral:      '🐱',
  periwinkle: '🐱',
  sage:       '🐱',
  peach:      '🐱',
  lilac:      '🐱',
  wild:       '⭐',
};

// ─── Utility helpers ──────────────────────────────────────────────────────────

let _idCounter = 0;
function uid() { return `i${++_idCounter}`; }

function makeItem(color: ColorId, overrides?: Partial<Item>): Item {
  return { id: uid(), color, ...overrides };
}

function makeContainer(cfg: ContainerConfig): Container {
  return {
    id: cfg.id,
    grabNumber: cfg.grabNumber,
    capacity: cfg.capacity,
    stack: cfg.startStack.map(c => makeItem(c)),
    position: cfg.position,
    colorLocked: cfg.colorLocked,
    frozen: cfg.frozen ?? false,
    oneWayOut: cfg.oneWayOut ?? false,
    oneWayIn: cfg.oneWayIn ?? false,
    doubleVanish: cfg.doubleVanish ?? false,
    narrow: cfg.narrow ?? false,
    isGoalContainer: cfg.isGoalContainer ?? false,
  };
}

// ─── Vanish engine ────────────────────────────────────────────────────────────

interface Run { startIdx: number; length: number; color: ColorId }

function findSameColorRuns(stack: Item[], k: number): Run[] {
  const runs: Run[] = [];
  let i = 0;
  while (i < stack.length) {
    const color = stack[i].color;
    let j = i;
    // wild items count as any color for run detection
    while (j < stack.length && (stack[j].color === color || stack[j].isWild)) {
      j++;
    }
    const len = j - i;
    if (len >= k) {
      runs.push({ startIdx: i, length: len, color });
    }
    i = j;
  }
  return runs;
}

interface VanishResult {
  removedItems: Item[];
  chainStep: number;
  scoreGain: number;
  doubleVanish: boolean;
}

function resolveVanishes(
  container: Container,
  k: number,
  chainStep: number
): VanishResult[] {
  if (container.frozen) return [];
  const results: VanishResult[] = [];
  let step = chainStep;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const runs = findSameColorRuns(container.stack, k);
    if (runs.length === 0) break;

    // Collect all indices to remove
    const indicesToRemove = new Set<number>();
    for (const run of runs) {
      for (let i = run.startIdx; i < run.startIdx + run.length; i++) {
        indicesToRemove.add(i);
        // bomb: also remove item directly below
        if (container.stack[i].isBomb && i > 0) {
          indicesToRemove.add(i - 1);
        }
      }
    }

    const removed = container.stack.filter((_, idx) => indicesToRemove.has(idx));
    // locked items block their run
    const hasLocked = removed.some(it => it.isLocked);
    if (hasLocked) break;

    container.stack = container.stack.filter((_, idx) => !indicesToRemove.has(idx));

    const multiplier = container.doubleVanish ? 2 : 1;
    const chainBonus = Math.pow(1.5, step);
    const goalDoubleBonus = removed.filter(it => it.isGoalDouble).length;
    const scoreGain = Math.round(removed.length * 10 * multiplier * chainBonus) + goalDoubleBonus * 20;

    results.push({ removedItems: removed, chainStep: step, scoreGain, doubleVanish: container.doubleVanish ?? false });
    step++;
  }

  return results;
}

// ─── Goal progress ────────────────────────────────────────────────────────────

function computeGoalProgress(
  containers: Container[],
  goalColors: ColorId[],
  initialCounts: Record<ColorId, number>
): Record<ColorId, { cleared: number; total: number }> {
  const remaining: Record<ColorId, number> = {} as Record<ColorId, number>;
  for (const c of goalColors) remaining[c] = 0;
  for (const cont of containers) {
    for (const item of cont.stack) {
      if (goalColors.includes(item.color)) {
        remaining[item.color] = (remaining[item.color] ?? 0) + 1;
      }
    }
  }
  const progress: Record<ColorId, { cleared: number; total: number }> = {} as Record<ColorId, { cleared: number; total: number }>;
  for (const c of goalColors) {
    const total = initialCounts[c] ?? 0;
    const left = remaining[c] ?? 0;
    progress[c] = { cleared: total - left, total };
  }
  return progress;
}

function checkWin(progress: Record<ColorId, { cleared: number; total: number }>): boolean {
  return Object.values(progress).every(p => p.cleared >= p.total);
}

// ─── Stars ────────────────────────────────────────────────────────────────────

function computeStars(budget: BudgetState, config: LevelConfig): number {
  let fraction = 0;
  if (config.budget.type === 'moves' || config.budget.type === 'both') {
    fraction = budget.movesLeft / (config.budget.maxMoves ?? 1);
  } else {
    fraction = budget.secondsLeft / (config.budget.maxSeconds ?? 1);
  }
  if (fraction >= config.starThresholds.three) return 3;
  if (fraction >= config.starThresholds.two) return 2;
  return 1;
}

// ─── Trigger system ───────────────────────────────────────────────────────────

function fireTriggers(
  event: TriggerEvent,
  state: GameState,
  containers: Container[]
): void {
  if (!state.levelConfig) return;
  for (const trigger of state.levelConfig.triggers) {
    if (trigger.fired) continue;
    if (trigger.event !== event) continue;

    // Check conditions
    if (trigger.condition?.movesCompleted !== undefined &&
        state.movesCompleted < trigger.condition.movesCompleted) continue;
    if (trigger.condition?.vanishesCompleted !== undefined &&
        state.vanishesCompleted < trigger.condition.vanishesCompleted) continue;

    const action = trigger.action;
    const target = containers.find(c => c.id === (action as { containerId?: string }).containerId);

    if (action.type === 'spawnItems' && target) {
      const freeSpace = target.capacity - target.stack.length;
      const toAdd = action.items.slice(0, freeSpace);
      target.stack.push(...toAdd.map(it => ({ ...it, id: uid() })));
    } else if (action.type === 'freezeContainer' && target) {
      target.frozen = true;
    } else if (action.type === 'thawContainer' && target) {
      target.frozen = false;
    } else if (action.type === 'grantBudget') {
      if (action.moves) state.budget.movesLeft += action.moves;
      if (action.seconds) state.budget.secondsLeft += action.seconds;
    } else if (action.type === 'convertItems' && target) {
      target.stack = target.stack.map(it =>
        it.color === action.fromColor ? { ...it, color: action.toColor } : it
      );
    }

    trigger.fired = true;
  }
}

// ─── Main action: executeMove ─────────────────────────────────────────────────

export interface MoveResult {
  success: boolean;
  error?: string;
  vanishResults: VanishResult[];
  won: boolean;
  failed: boolean;
  newState: GameState;
}

export function grabChunk(state: GameState, sourceId: string): GameState {
  const containers = state.containers.map(c => ({ ...c, stack: [...c.stack] }));
  const source = containers.find(c => c.id === sourceId);
  if (!source) return state;
  if (source.oneWayIn) return { ...state, message: 'This tower only accepts cats!' };
  if (source.stack.length < source.grabNumber) {
    return { ...state, message: `Need at least ${source.grabNumber} cats to grab!` };
  }

  const n = source.grabNumber;
  const grabbed = source.stack.splice(source.stack.length - n, n).reverse(); // top-first
  const chunk: Chunk = { items: grabbed, sourceContainerId: sourceId };

  return { ...state, containers, selectedContainerId: sourceId, chunk, message: null };
}

export function cancelGrab(state: GameState): GameState {
  if (!state.chunk) return state;
  // Return items to source
  const containers = state.containers.map(c => ({ ...c, stack: [...c.stack] }));
  const source = containers.find(c => c.id === state.chunk!.sourceContainerId);
  if (source) {
    const returned = [...state.chunk.items].reverse(); // restore original order
    source.stack.push(...returned);
  }
  return { ...state, containers, chunk: null, selectedContainerId: null, message: null };
}

export function placeChunk(state: GameState, targetId: string): MoveResult {
  if (!state.chunk || !state.levelConfig) {
    return { success: false, error: 'No chunk in flight', vanishResults: [], won: false, failed: false, newState: state };
  }

  const containers = state.containers.map(c => ({
    ...c,
    stack: c.stack.map(it => ({ ...it })),
  }));
  const target = containers.find(c => c.id === targetId);
  const chunk = state.chunk;

  if (!target) {
    return { success: false, error: 'Target not found', vanishResults: [], won: false, failed: false, newState: state };
  }

  // Self-placement is illegal
  if (targetId === chunk.sourceContainerId) {
    const restored = cancelGrab(state);
    return { success: false, error: 'Cannot place on same tower', vanishResults: [], won: false, failed: false, newState: restored };
  }

  // One-way-out: cannot receive
  if (target.oneWayOut) {
    return { success: false, error: 'This tower only sends cats out!', vanishResults: [], won: false, failed: false, newState: state };
  }

  // Color-locked: only matching color
  if (target.colorLocked) {
    const allMatch = chunk.items.every(it => it.color === target.colorLocked || it.isWild);
    if (!allMatch) {
      return { success: false, error: `Only ${target.colorLocked} cats here!`, vanishResults: [], won: false, failed: false, newState: state };
    }
  }

  // Capacity check
  const freeSpace = target.capacity - target.stack.length;
  if (freeSpace < chunk.items.length) {
    return { success: false, error: 'Not enough space!', vanishResults: [], won: false, failed: false, newState: state };
  }

  // Place chunk (items in chunk are top-first, push in reverse so original top ends up on top)
  const toPlace = [...chunk.items].reverse();
  target.stack.push(...toPlace);

  // Vanish scan
  const vanishResults = resolveVanishes(target, state.levelConfig.mergeSizeK, 0);

  // Score
  let scoreGain = 0;
  let totalVanished = 0;
  for (const vr of vanishResults) {
    scoreGain += vr.scoreGain;
    totalVanished += vr.removedItems.length;
  }

  // Budget decrement
  const budget = { ...state.budget };
  if (budget.type === 'moves' || budget.type === 'both') {
    budget.movesLeft = Math.max(0, budget.movesLeft - 1);
  }

  const movesCompleted = state.movesCompleted + 1;
  const vanishesCompleted = state.vanishesCompleted + (vanishResults.length > 0 ? 1 : 0);

  // Compute goal progress
  const goalColors = state.levelConfig.goalColors;
  const initialCounts: Record<ColorId, number> = {} as Record<ColorId, number>;
  for (const c of goalColors) {
    initialCounts[c] = state.goalProgress[c]?.total ?? 0;
  }
  const goalProgress = computeGoalProgress(containers, goalColors, initialCounts);

  const newState: GameState = {
    ...state,
    containers,
    chunk: null,
    selectedContainerId: null,
    score: state.score + scoreGain,
    chainLength: vanishResults.length,
    movesCompleted,
    vanishesCompleted,
    budget,
    goalProgress,
    message: null,
    particles: [],
  };

  // Fire triggers
  fireTriggers('onMoveComplete', newState, containers);
  if (vanishResults.length > 0) {
    fireTriggers('onVanishComplete', newState, containers);
  }
  if (budget.movesLeft <= Math.ceil((state.levelConfig.budget.maxMoves ?? 20) * 0.3)) {
    fireTriggers('onBudgetWarning', newState, containers);
  }

  // Win / fail check
  const won = checkWin(goalProgress);
  const failed = !won && budget.movesLeft === 0 && (budget.type === 'moves' || budget.type === 'both');

  if (won) {
    const stars = computeStars(budget, state.levelConfig);
    return { success: true, vanishResults, won: true, failed: false, newState: { ...newState, phase: 'levelComplete', stars } };
  }
  if (failed) {
    return { success: true, vanishResults, won: false, failed: true, newState: { ...newState, phase: 'levelFail' } };
  }

  return { success: true, vanishResults, won: false, failed: false, newState };
}

// ─── Level definitions ────────────────────────────────────────────────────────

export const LEVELS: LevelConfig[] = [
  // Level 1 — Tutorial: merge-2, 3 containers, single goal color
  {
    id: 1,
    name: 'Cozy Corner',
    isBoss: false,
    palette: ['coral', 'periwinkle', 'sage'],
    goalColors: ['coral'],
    mergeSizeK: 2,
    budget: { type: 'moves', maxMoves: 20 },
    starThresholds: { two: 0.3, three: 0.6 },
    triggers: [],
    containers: [
      { id: 'c1', grabNumber: 2, capacity: 6, position: { x: 0, y: 0 },
        startStack: ['periwinkle', 'coral', 'sage', 'coral'] },
      { id: 'c2', grabNumber: 2, capacity: 6, position: { x: 1, y: 0 },
        startStack: ['coral', 'sage', 'coral', 'periwinkle'] },
      { id: 'c3', grabNumber: 2, capacity: 6, position: { x: 2, y: 0 },
        startStack: ['sage', 'periwinkle', 'sage'] },
      { id: 'c4', grabNumber: 2, capacity: 6, position: { x: 3, y: 0 },
        startStack: [] },
    ],
  },

  // Level 2 — Two goal colors, merge-3
  {
    id: 2,
    name: 'Paw Patrol',
    isBoss: false,
    palette: ['coral', 'periwinkle', 'sage', 'peach'],
    goalColors: ['coral', 'sage'],
    mergeSizeK: 3,
    budget: { type: 'moves', maxMoves: 25 },
    starThresholds: { two: 0.3, three: 0.55 },
    triggers: [],
    containers: [
      { id: 'c1', grabNumber: 2, capacity: 8, position: { x: 0, y: 0 },
        startStack: ['peach', 'coral', 'sage', 'coral', 'periwinkle'] },
      { id: 'c2', grabNumber: 3, capacity: 8, position: { x: 1, y: 0 },
        startStack: ['sage', 'coral', 'peach', 'sage', 'coral'] },
      { id: 'c3', grabNumber: 2, capacity: 8, position: { x: 2, y: 0 },
        startStack: ['coral', 'periwinkle', 'sage', 'peach'] },
      { id: 'c4', grabNumber: 3, capacity: 8, position: { x: 3, y: 0 },
        startStack: ['periwinkle', 'sage', 'coral', 'peach'] },
      { id: 'c5', grabNumber: 2, capacity: 8, position: { x: 4, y: 0 },
        startStack: [] },
    ],
  },

  // Level 3 — Color-locked special container + merge-2
  {
    id: 3,
    name: 'Lilac Lounge',
    isBoss: false,
    palette: ['coral', 'lilac', 'peach'],
    goalColors: ['lilac'],
    mergeSizeK: 2,
    budget: { type: 'moves', maxMoves: 22 },
    starThresholds: { two: 0.3, three: 0.55 },
    triggers: [],
    containers: [
      { id: 'c1', grabNumber: 2, capacity: 6, position: { x: 0, y: 0 },
        startStack: ['peach', 'lilac', 'coral', 'lilac'] },
      { id: 'c2', grabNumber: 2, capacity: 6, position: { x: 1, y: 0 },
        startStack: ['lilac', 'coral', 'peach', 'lilac'] },
      { id: 'c3', grabNumber: 2, capacity: 6, position: { x: 2, y: 0 },
        startStack: ['coral', 'lilac', 'peach'] },
      { id: 'c4', grabNumber: 2, capacity: 4, position: { x: 3, y: 0 },
        startStack: [], colorLocked: 'lilac', isGoalContainer: true },
      { id: 'c5', grabNumber: 2, capacity: 6, position: { x: 4, y: 0 },
        startStack: [] },
    ],
  },

  // Level 4 — Trigger: spawn items after 5 moves + merge-3
  {
    id: 4,
    name: 'Surprise Party',
    isBoss: false,
    palette: ['coral', 'periwinkle', 'sage', 'peach', 'lilac'],
    goalColors: ['peach'],
    mergeSizeK: 3,
    budget: { type: 'moves', maxMoves: 30 },
    starThresholds: { two: 0.25, three: 0.5 },
    triggers: [
      {
        event: 'onMoveComplete',
        condition: { movesCompleted: 5 },
        action: { type: 'spawnItems', containerId: 'c1', items: [
          { id: 'sp1', color: 'coral' },
          { id: 'sp2', color: 'periwinkle' },
        ] },
      },
    ],
    containers: [
      { id: 'c1', grabNumber: 3, capacity: 8, position: { x: 0, y: 0 },
        startStack: ['periwinkle', 'peach', 'sage', 'coral', 'peach'] },
      { id: 'c2', grabNumber: 2, capacity: 8, position: { x: 1, y: 0 },
        startStack: ['peach', 'lilac', 'coral', 'peach', 'sage'] },
      { id: 'c3', grabNumber: 3, capacity: 8, position: { x: 2, y: 0 },
        startStack: ['sage', 'peach', 'lilac', 'periwinkle'] },
      { id: 'c4', grabNumber: 2, capacity: 8, position: { x: 3, y: 0 },
        startStack: ['coral', 'peach', 'sage'] },
      { id: 'c5', grabNumber: 3, capacity: 8, position: { x: 4, y: 0 },
        startStack: [] },
    ],
  },

  // Level 5 — Boss: tight budget + spawn trigger every 3 moves
  {
    id: 5,
    name: '⚡ Boss: Tower Rush',
    isBoss: true,
    palette: ['coral', 'periwinkle', 'sage', 'peach', 'lilac'],
    goalColors: ['coral', 'periwinkle'],
    mergeSizeK: 3,
    budget: { type: 'moves', maxMoves: 20 },
    starThresholds: { two: 0.2, three: 0.45 },
    triggers: [
      {
        event: 'onMoveComplete',
        condition: { movesCompleted: 3 },
        action: { type: 'spawnItems', containerId: 'c2', items: [
          { id: 'b1', color: 'lilac' },
          { id: 'b2', color: 'sage' },
        ] },
      },
      {
        event: 'onMoveComplete',
        condition: { movesCompleted: 8 },
        action: { type: 'spawnItems', containerId: 'c3', items: [
          { id: 'b3', color: 'peach' },
          { id: 'b4', color: 'lilac' },
        ] },
      },
      {
        event: 'onVanishComplete',
        condition: { vanishesCompleted: 2 },
        action: { type: 'grantBudget', moves: 3 },
      },
    ],
    containers: [
      { id: 'c1', grabNumber: 3, capacity: 9, position: { x: 0, y: 0 },
        startStack: ['periwinkle', 'coral', 'sage', 'coral', 'periwinkle', 'lilac'] },
      { id: 'c2', grabNumber: 2, capacity: 9, position: { x: 1, y: 0 },
        startStack: ['coral', 'periwinkle', 'peach', 'coral', 'sage'] },
      { id: 'c3', grabNumber: 3, capacity: 9, position: { x: 2, y: 0 },
        startStack: ['sage', 'periwinkle', 'coral', 'lilac', 'peach'] },
      { id: 'c4', grabNumber: 2, capacity: 9, position: { x: 3, y: 0 },
        startStack: ['periwinkle', 'coral', 'sage'] },
      { id: 'c5', grabNumber: 3, capacity: 9, position: { x: 4, y: 0 },
        startStack: [] },
    ],
  },
];

// ─── Initial state factory ────────────────────────────────────────────────────

export function initLevelState(levelConfig: LevelConfig, levelIndex: number): GameState {
  const containers = levelConfig.containers.map(makeContainer);

  // Count initial goal items
  const goalProgress: Record<ColorId, { cleared: number; total: number }> = {} as Record<ColorId, { cleared: number; total: number }>;
  for (const color of levelConfig.goalColors) {
    let total = 0;
    for (const c of containers) {
      for (const it of c.stack) {
        if (it.color === color) total++;
      }
    }
    goalProgress[color] = { cleared: 0, total };
  }

  const budget: BudgetState = {
    type: levelConfig.budget.type,
    movesLeft: levelConfig.budget.maxMoves ?? 999,
    secondsLeft: levelConfig.budget.maxSeconds ?? 999,
  };

  // Reset trigger fired flags
  const triggers = levelConfig.triggers.map(t => ({ ...t, fired: false }));
  const resetConfig = { ...levelConfig, triggers };

  return {
    phase: 'playing',
    levelConfig: resetConfig,
    containers,
    budget,
    selectedContainerId: null,
    chunk: null,
    score: 0,
    chainLength: 0,
    movesCompleted: 0,
    vanishesCompleted: 0,
    goalProgress,
    stars: 0,
    message: null,
    particles: [],
    currentLevelIndex: levelIndex,
  };
}
