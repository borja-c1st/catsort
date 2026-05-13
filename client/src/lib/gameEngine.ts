/**
 * CatSort Game Engine
 * Design: Warm peach/cream palette, 6 cat coats (ginger/white/black/tabby/calico/siamese)
 * Each coat has a colorblind-safe non-color cue (stripes/collar/socks/M-mark/patches/mask)
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type CoatId = 'ginger' | 'white' | 'black' | 'tabby' | 'calico' | 'siamese';

export interface Item {
  id: string;
  coat: CoatId;
  isWild?: boolean;
  isLocked?: boolean;
  isBomb?: boolean;
}

export interface Container {
  id: string;
  grabNumber: number;
  capacity: number;
  stack: Item[];
  position: { x: number; y: number };
  coatLocked?: CoatId;
  frozen?: boolean;
  oneWayOut?: boolean;
  oneWayIn?: boolean;
  doubleVanish?: boolean;
  isGoalContainer?: boolean;
}

export interface Chunk {
  items: Item[];
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

export type TriggerEvent = 'onMoveComplete' | 'onVanishComplete' | 'onBudgetWarning';

export type TriggerAction =
  | { type: 'spawnItems'; containerId: string; items: Item[] }
  | { type: 'freezeContainer'; containerId: string }
  | { type: 'thawContainer'; containerId: string }
  | { type: 'grantBudget'; moves?: number; seconds?: number };

export interface LevelTrigger {
  event: TriggerEvent;
  condition?: { movesCompleted?: number; vanishesCompleted?: number };
  action: TriggerAction;
  fired?: boolean;
}

export interface LevelConfig {
  id: number;
  name: string;
  world: number;
  levelInWorld: number;
  isBoss: boolean;
  description: string;
  goalCoats: CoatId[];
  mergeSizeK: number;
  budget: BudgetConfig;
  containers: ContainerConfig[];
  triggers: LevelTrigger[];
  starThresholds: { two: number; three: number };
}

export interface ContainerConfig {
  id: string;
  grabNumber: number;
  capacity: number;
  startStack: CoatId[];
  position: { x: number; y: number };
  coatLocked?: CoatId;
  frozen?: boolean;
  oneWayOut?: boolean;
  oneWayIn?: boolean;
  doubleVanish?: boolean;
  isGoalContainer?: boolean;
}

export type GamePhase = 'title' | 'worldMap' | 'playing' | 'levelComplete' | 'levelFail' | 'paused';

export interface GameState {
  phase: GamePhase;
  levelConfig: LevelConfig | null;
  containers: Container[];
  budget: BudgetState;
  selectedContainerId: string | null;
  chunk: Chunk | null;
  score: number;
  chainLength: number;
  bestChain: number;
  movesCompleted: number;
  vanishesCompleted: number;
  goalProgress: Record<CoatId, { cleared: number; total: number }>;
  stars: number;
  message: string | null;
  speechBubbles: SpeechBubble[];
  particles: Particle[];
  currentLevelIndex: number;
}

export interface SpeechBubble {
  id: string;
  text: string;
  x: number;
  y: number;
  life: number;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  type: 'sparkle' | 'heart' | 'star' | 'leaf';
  vx: number;
  vy: number;
  size: number;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

export const COAT_COLORS: Record<CoatId, { body: string; dark: string; label: string; cue: string }> = {
  ginger:  { body: '#E8845A', dark: '#C05A30', label: 'Ginger',  cue: 'stripes' },
  white:   { body: '#F4EEE4', dark: '#C8B898', label: 'White',   cue: 'collar' },
  black:   { body: '#3A3038', dark: '#1A1020', label: 'Black',   cue: 'socks' },
  tabby:   { body: '#A89878', dark: '#786848', label: 'Tabby',   cue: 'M-mark' },
  calico:  { body: '#F4C898', dark: '#C89858', label: 'Calico',  cue: 'patches' },
  siamese: { body: '#E8D8C0', dark: '#8A6848', label: 'Siamese', cue: 'mask' },
};

// ─── Utility helpers ──────────────────────────────────────────────────────────

let _idCounter = 0;
function uid() { return `i${++_idCounter}`; }

function makeItem(coat: CoatId, overrides?: Partial<Item>): Item {
  return { id: uid(), coat, ...overrides };
}

function makeContainer(cfg: ContainerConfig): Container {
  return {
    id: cfg.id,
    grabNumber: cfg.grabNumber,
    capacity: cfg.capacity,
    stack: cfg.startStack.map(c => makeItem(c)),
    position: cfg.position,
    coatLocked: cfg.coatLocked,
    frozen: cfg.frozen ?? false,
    oneWayOut: cfg.oneWayOut ?? false,
    oneWayIn: cfg.oneWayIn ?? false,
    doubleVanish: cfg.doubleVanish ?? false,
    isGoalContainer: cfg.isGoalContainer ?? false,
  };
}

// ─── Vanish engine ────────────────────────────────────────────────────────────

interface Run { startIdx: number; length: number; coat: CoatId }

function findRuns(stack: Item[], k: number): Run[] {
  const runs: Run[] = [];
  let i = 0;
  while (i < stack.length) {
    const coat = stack[i].coat;
    let j = i;
    while (j < stack.length && (stack[j].coat === coat || stack[j].isWild)) j++;
    if (j - i >= k) runs.push({ startIdx: i, length: j - i, coat });
    i = j;
  }
  return runs;
}

interface VanishResult {
  removedItems: Item[];
  chainStep: number;
  scoreGain: number;
}

function resolveVanishes(container: Container, k: number, chainStep: number): VanishResult[] {
  if (container.frozen) return [];
  const results: VanishResult[] = [];
  let step = chainStep;

  while (true) {
    const runs = findRuns(container.stack, k);
    if (!runs.length) break;
    const toRemove = new Set<number>();
    for (const run of runs) {
      for (let i = run.startIdx; i < run.startIdx + run.length; i++) {
        toRemove.add(i);
        if (container.stack[i].isBomb && i > 0) toRemove.add(i - 1);
      }
    }
    const removed = container.stack.filter((_, i) => toRemove.has(i));
    if (removed.some(it => it.isLocked)) break;
    container.stack = container.stack.filter((_, i) => !toRemove.has(i));
    const mult = container.doubleVanish ? 2 : 1;
    const chainBonus = Math.pow(1.5, step);
    results.push({
      removedItems: removed,
      chainStep: step,
      scoreGain: Math.round(removed.length * 10 * mult * chainBonus),
    });
    step++;
  }
  return results;
}

// ─── Goal progress ────────────────────────────────────────────────────────────

function computeGoalProgress(
  containers: Container[],
  goalCoats: CoatId[],
  initialCounts: Record<CoatId, number>
): Record<CoatId, { cleared: number; total: number }> {
  const remaining: Partial<Record<CoatId, number>> = {};
  for (const c of goalCoats) remaining[c] = 0;
  for (const cont of containers) {
    for (const item of cont.stack) {
      if (goalCoats.includes(item.coat)) remaining[item.coat] = (remaining[item.coat] ?? 0) + 1;
    }
  }
  const progress = {} as Record<CoatId, { cleared: number; total: number }>;
  for (const c of goalCoats) {
    const total = initialCounts[c] ?? 0;
    progress[c] = { cleared: total - (remaining[c] ?? 0), total };
  }
  return progress;
}

function checkWin(progress: Record<CoatId, { cleared: number; total: number }>): boolean {
  return Object.values(progress).every(p => p.cleared >= p.total);
}

function computeStars(budget: BudgetState, config: LevelConfig): number {
  const fraction = budget.type === 'time'
    ? budget.secondsLeft / (config.budget.maxSeconds ?? 1)
    : budget.movesLeft / (config.budget.maxMoves ?? 1);
  if (fraction >= config.starThresholds.three) return 3;
  if (fraction >= config.starThresholds.two) return 2;
  return 1;
}

// ─── Trigger system ───────────────────────────────────────────────────────────

function fireTriggers(event: TriggerEvent, state: GameState, containers: Container[]): void {
  if (!state.levelConfig) return;
  for (const trigger of state.levelConfig.triggers) {
    if (trigger.fired) continue;
    if (trigger.event !== event) continue;
    if (trigger.condition?.movesCompleted !== undefined && state.movesCompleted < trigger.condition.movesCompleted) continue;
    if (trigger.condition?.vanishesCompleted !== undefined && state.vanishesCompleted < trigger.condition.vanishesCompleted) continue;

    const action = trigger.action;
    const target = containers.find(c => c.id === (action as { containerId?: string }).containerId);

    if (action.type === 'spawnItems' && target) {
      const free = target.capacity - target.stack.length;
      target.stack.push(...action.items.slice(0, free).map(it => ({ ...it, id: uid() })));
    } else if (action.type === 'freezeContainer' && target) {
      target.frozen = true;
    } else if (action.type === 'thawContainer' && target) {
      target.frozen = false;
    } else if (action.type === 'grantBudget') {
      if (action.moves) state.budget.movesLeft += action.moves;
      if (action.seconds) state.budget.secondsLeft += action.seconds;
    }
    trigger.fired = true;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface VanishStep {
  /** IDs of items that will vanish in this step */
  vanishingIds: string[];
  /** coat of the vanishing run (for highlight colour) */
  coat: CoatId;
  /** ID of the container the vanish happens in */
  containerId: string;
  /** the container state BEFORE this step's items are removed (full stack visible) */
  preState: GameState;
  /** the container state AFTER this step's items are removed */
  postState: GameState;
  scoreGain: number;
}

export interface MoveResult {
  success: boolean;
  error?: string;
  vanishResults: VanishResult[];
  /** Ordered list of vanish animation steps for staged playback */
  vanishSteps: VanishStep[];
  won: boolean;
  failed: boolean;
  newState: GameState;
}

export function grabChunk(state: GameState, sourceId: string): GameState {
  const containers = state.containers.map(c => ({ ...c, stack: [...c.stack] }));
  const source = containers.find(c => c.id === sourceId);
  if (!source) return state;
  if (source.oneWayIn) return { ...state, message: 'This tower only accepts cats!' };
  if (source.stack.length < 1) {
    return { ...state, message: 'No cats to grab!' };
  }
  // Grab up to grabNumber cats, but never more than what's available
  const count = Math.min(source.grabNumber, source.stack.length);
  const grabbed = source.stack.splice(source.stack.length - count, count).reverse();
  return { ...state, containers, selectedContainerId: sourceId, chunk: { items: grabbed, sourceContainerId: sourceId }, message: null };
}

export function cancelGrab(state: GameState): GameState {
  if (!state.chunk) return state;
  const containers = state.containers.map(c => ({ ...c, stack: [...c.stack] }));
  const source = containers.find(c => c.id === state.chunk!.sourceContainerId);
  if (source) source.stack.push(...[...state.chunk.items].reverse());
  return { ...state, containers, chunk: null, selectedContainerId: null, message: null };
}

export function placeChunk(state: GameState, targetId: string): MoveResult {
  if (!state.chunk || !state.levelConfig) {
    return { success: false, error: 'No chunk in flight', vanishResults: [], vanishSteps: [], won: false, failed: false, newState: state };
  }
  const chunk = state.chunk;

  // ── Legality checks (operate on fresh copies) ──────────────────────────────
  const checkContainers = state.containers.map(c => ({ ...c, stack: c.stack.map(it => ({ ...it })) }));
  const checkTarget = checkContainers.find(c => c.id === targetId);
  if (!checkTarget) return { success: false, error: 'Target not found', vanishResults: [], vanishSteps: [], won: false, failed: false, newState: state };
  if (targetId === chunk.sourceContainerId) {
    return { success: false, error: 'Cannot place on same tower', vanishResults: [], vanishSteps: [], won: false, failed: false, newState: cancelGrab(state) };
  }
  if (checkTarget.oneWayOut) return { success: false, error: 'This tower only sends cats out!', vanishResults: [], vanishSteps: [], won: false, failed: false, newState: state };
  if (checkTarget.coatLocked) {
    if (!chunk.items.every(it => it.coat === checkTarget.coatLocked || it.isWild)) {
      return { success: false, error: `Only ${COAT_COLORS[checkTarget.coatLocked!].label} cats here!`, vanishResults: [], vanishSteps: [], won: false, failed: false, newState: state };
    }
  }
  if (checkTarget.capacity - checkTarget.stack.length < chunk.items.length) {
    return { success: false, error: 'Max capacity!', vanishResults: [], vanishSteps: [], won: false, failed: false, newState: state };
  }

  // ── Build vanishSteps for staged animation ─────────────────────────────────
  // We replay the placement on a scratch copy to capture each intermediate state.
  const vanishSteps: VanishStep[] = [];
  {
    // scratch copy for step-building
    const sc = state.containers.map(c => ({ ...c, stack: c.stack.map(it => ({ ...it })) }));
    const scTarget = sc.find(c => c.id === targetId)!;
    scTarget.stack.push(...[...chunk.items].reverse());

    let stepChain = 0;
    while (true) {
      const runs = findRuns(scTarget.stack, state.levelConfig.mergeSizeK);
      if (!runs.length) break;
      const toRemove = new Set<number>();
      for (const run of runs) {
        for (let i = run.startIdx; i < run.startIdx + run.length; i++) {
          toRemove.add(i);
          if (scTarget.stack[i].isBomb && i > 0) toRemove.add(i - 1);
        }
      }
      const vanishingIds = scTarget.stack.filter((_, i) => toRemove.has(i)).map(it => it.id);
      const coat = runs[0].coat;
      if (scTarget.stack.some((it, i) => toRemove.has(i) && it.isLocked)) break;

      // preState: full stack including cats about to vanish
      const preContainers = sc.map(c => ({ ...c, stack: [...c.stack.map(it => ({ ...it }))] }));
      const preState: GameState = {
        ...state,
        containers: preContainers,
        chunk: null,
        selectedContainerId: null,
        message: null,
        speechBubbles: [],
        particles: [],
      };

      // remove the cats
      scTarget.stack = scTarget.stack.filter((_, i) => !toRemove.has(i));
      const mult = scTarget.doubleVanish ? 2 : 1;
      const chainBonus = Math.pow(1.5, stepChain);
      const stepScore = Math.round(vanishingIds.length * 10 * mult * chainBonus);

      // postState: stack after removal
      const postContainers = sc.map(c => ({ ...c, stack: [...c.stack.map(it => ({ ...it }))] }));
      const postState: GameState = {
        ...state,
        containers: postContainers,
        chunk: null,
        selectedContainerId: null,
        message: null,
        speechBubbles: [],
        particles: [],
      };

      vanishSteps.push({ vanishingIds, coat, containerId: targetId, preState, postState, scoreGain: stepScore });
      stepChain++;
    }
  }

  // ── Final state computation ────────────────────────────────────────────────
  const containers = state.containers.map(c => ({ ...c, stack: c.stack.map(it => ({ ...it })) }));
  const target = containers.find(c => c.id === targetId)!;
  target.stack.push(...[...chunk.items].reverse());
  const vanishResults = resolveVanishes(target, state.levelConfig.mergeSizeK, 0);

  let scoreGain = 0;
  for (const vr of vanishResults) scoreGain += vr.scoreGain;

  const budget = { ...state.budget };
  if (budget.type === 'moves' || budget.type === 'both') budget.movesLeft = Math.max(0, budget.movesLeft - 1);

  const movesCompleted = state.movesCompleted + 1;
  const vanishesCompleted = state.vanishesCompleted + (vanishResults.length > 0 ? 1 : 0);
  const chainLength = vanishResults.length;
  const bestChain = Math.max(state.bestChain, chainLength);

  const initialCounts: Record<CoatId, number> = {} as Record<CoatId, number>;
  for (const c of state.levelConfig.goalCoats) initialCounts[c] = state.goalProgress[c]?.total ?? 0;
  const goalProgress = computeGoalProgress(containers, state.levelConfig.goalCoats, initialCounts);

  const newState: GameState = {
    ...state,
    containers,
    chunk: null,
    selectedContainerId: null,
    score: state.score + scoreGain,
    chainLength,
    bestChain,
    movesCompleted,
    vanishesCompleted,
    budget,
    goalProgress,
    message: null,
    speechBubbles: [],
    particles: [],
  };

  fireTriggers('onMoveComplete', newState, containers);
  if (vanishResults.length > 0) fireTriggers('onVanishComplete', newState, containers);
  if (budget.movesLeft <= Math.ceil((state.levelConfig.budget.maxMoves ?? 20) * 0.3)) {
    fireTriggers('onBudgetWarning', newState, containers);
  }

  const won = checkWin(goalProgress);
  const failed = !won && budget.movesLeft === 0 && (budget.type === 'moves' || budget.type === 'both');

  if (won) {
    const stars = computeStars(budget, state.levelConfig);
    return { success: true, vanishResults, vanishSteps, won: true, failed: false, newState: { ...newState, phase: 'levelComplete', stars } };
  }
  if (failed) {
    return { success: true, vanishResults, vanishSteps, won: false, failed: true, newState: { ...newState, phase: 'levelFail' } };
  }
  return { success: true, vanishResults, vanishSteps, won: false, failed: false, newState };
}

// ─── Level definitions ────────────────────────────────────────────────────────
//
// Difficulty tiers (every 3 levels step up):
//   Tier 1 — L1-3  : merge-2, grab≤2, 3-4 towers, 1 goal coat
//   Tier 2 — L4-6  : merge-3, grab≤3, 4 towers, 1-2 goal coats
//   Tier 3 — L7-9  : merge-3, grab≤3, 4-5 towers, 2 goal coats, tighter budget
//   Tier 4 — L10-12: merge-3, grab≤3, 5 towers, 2 goal coats, locked/frozen
//   Tier 5 — L13-15: merge-3, grab≤3, 5-6 towers, 2-3 goal coats, very tight
//   Tier 6 — L16-18: merge-3, grab≤2, 5-6 towers, 3 goal coats, brutal budget
//   Tier 7 — L19-20: merge-3, grab≤2, 6 towers, 3-6 goal coats, boss finales
//
// World map:
//   World 1 "Cozy Living Room"  — L1-5
//   World 2 "Garden Afternoon"  — L6-10
//   World 3 "Midnight Rooftop"  — L11-15
//   World 4 "Dream Palace"      — L16-20

export const LEVELS: LevelConfig[] = [

  // ════════════════════════════════════════════════════════════════════════
  // WORLD 1 — Cozy Living Room  (L1-5)
  // ════════════════════════════════════════════════════════════════════════

  // L1 — Tier 1: merge-2, grab≤2, 3 towers, goal: ginger
  {
    id: 1, name: 'Sunny Windowsill', world: 1, levelInWorld: 1, isBoss: false,
    description: 'Send the ginger kittens home',
    goalCoats: ['ginger'], mergeSizeK: 2,
    budget: { type: 'moves', maxMoves: 20 },
    starThresholds: { two: 0.35, three: 0.65 }, triggers: [],
    containers: [
      { id: 'c1', grabNumber: 2, capacity: 10, position: { x: 0, y: 0 }, startStack: ['white', 'ginger', 'tabby', 'ginger'] },
      { id: 'c2', grabNumber: 2, capacity: 10, position: { x: 1, y: 0 }, startStack: ['ginger', 'tabby', 'ginger', 'white'] },
      { id: 'c3', grabNumber: 2, capacity: 10, position: { x: 2, y: 0 }, startStack: [] },
    ],
  },

  // L2 — Tier 1: merge-2, grab≤2, 4 towers, goal: tabby+white
  {
    id: 2, name: 'Bookshelf Nap', world: 1, levelInWorld: 2, isBoss: false,
    description: 'Sort the tabby and white cats',
    goalCoats: ['tabby', 'white'], mergeSizeK: 2,
    budget: { type: 'moves', maxMoves: 24 },
    starThresholds: { two: 0.3, three: 0.6 }, triggers: [],
    containers: [
      { id: 'c1', grabNumber: 2, capacity: 10, position: { x: 0, y: 0 }, startStack: ['ginger', 'tabby', 'white', 'tabby'] },
      { id: 'c2', grabNumber: 2, capacity: 10, position: { x: 1, y: 0 }, startStack: ['tabby', 'ginger', 'tabby', 'white'] },
      { id: 'c3', grabNumber: 2, capacity: 10, position: { x: 2, y: 0 }, startStack: ['ginger', 'ginger'] },
      { id: 'c4', grabNumber: 2, capacity: 10, position: { x: 3, y: 0 }, startStack: [] },
    ],
  },

  // L3 — Tier 1→2 bridge: merge-3, grab≤3, 3 towers, goal: calico
  {
    id: 3, name: 'Calico Corner', world: 1, levelInWorld: 3, isBoss: false,
    description: 'Collect all the calico cats',
    goalCoats: ['calico'], mergeSizeK: 3,
    budget: { type: 'moves', maxMoves: 22 },
    starThresholds: { two: 0.3, three: 0.55 }, triggers: [],
    containers: [
      { id: 'c1', grabNumber: 3, capacity: 10, position: { x: 0, y: 0 }, startStack: ['siamese', 'calico', 'black', 'calico', 'siamese'] },
      { id: 'c2', grabNumber: 3, capacity: 10, position: { x: 1, y: 0 }, startStack: ['calico', 'black', 'calico', 'siamese', 'calico'] },
      { id: 'c3', grabNumber: 3, capacity: 10, position: { x: 2, y: 0 }, startStack: [] },
    ],
  },

  // L4 — Tier 2: merge-3, grab≤3, 4 towers, goal: siamese
  {
    id: 4, name: 'Surprise Guests', world: 1, levelInWorld: 4, isBoss: false,
    description: 'Send the siamese cats to rest',
    goalCoats: ['siamese'], mergeSizeK: 3,
    budget: { type: 'moves', maxMoves: 26 },
    starThresholds: { two: 0.25, three: 0.5 }, triggers: [],
    containers: [
      { id: 'c1', grabNumber: 3, capacity: 10, position: { x: 0, y: 0 }, startStack: ['ginger', 'siamese', 'tabby', 'black', 'siamese'] },
      { id: 'c2', grabNumber: 3, capacity: 10, position: { x: 1, y: 0 }, startStack: ['siamese', 'calico', 'black', 'siamese', 'tabby'] },
      { id: 'c3', grabNumber: 3, capacity: 10, position: { x: 2, y: 0 }, startStack: ['tabby', 'siamese', 'calico', 'ginger'] },
      { id: 'c4', grabNumber: 3, capacity: 10, position: { x: 3, y: 0 }, startStack: [] },
    ],
  },

  // L5 — Tier 2 boss: merge-3, grab≤3, 5 towers, goal: ginger+white
  {
    id: 5, name: 'Moonlit Window', world: 1, levelInWorld: 5, isBoss: true,
    description: 'Clear two coats before dawn',
    goalCoats: ['ginger', 'white'], mergeSizeK: 3,
    budget: { type: 'moves', maxMoves: 30 },
    starThresholds: { two: 0.2, three: 0.45 },
    triggers: [{ event: 'onVanishComplete', condition: { vanishesCompleted: 2 }, action: { type: 'grantBudget', moves: 3 } }],
    containers: [
      { id: 'c1', grabNumber: 3, capacity: 10, position: { x: 0, y: 0 }, startStack: ['white', 'ginger', 'tabby', 'ginger', 'white', 'black'] },
      { id: 'c2', grabNumber: 3, capacity: 10, position: { x: 1, y: 0 }, startStack: ['ginger', 'white', 'calico', 'ginger', 'tabby'] },
      { id: 'c3', grabNumber: 3, capacity: 10, position: { x: 2, y: 0 }, startStack: ['tabby', 'white', 'ginger', 'black', 'calico'] },
      { id: 'c4', grabNumber: 3, capacity: 10, position: { x: 3, y: 0 }, startStack: ['white', 'ginger', 'tabby', 'black'] },
      { id: 'c5', grabNumber: 3, capacity: 10, position: { x: 4, y: 0 }, startStack: [] },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════
  // WORLD 2 — Garden Afternoon  (L6-10)
  // ════════════════════════════════════════════════════════════════════════

  // L6 — Tier 3: merge-3, grab≤3, 4 towers, goal: black+tabby
  {
    id: 6, name: 'Garden Fence', world: 2, levelInWorld: 1, isBoss: false,
    description: 'Shoo the black and tabby cats off the fence',
    goalCoats: ['black', 'tabby'], mergeSizeK: 3,
    budget: { type: 'moves', maxMoves: 26 },
    starThresholds: { two: 0.25, three: 0.5 }, triggers: [],
    containers: [
      { id: 'c1', grabNumber: 3, capacity: 10, position: { x: 0, y: 0 }, startStack: ['white', 'black', 'tabby', 'calico', 'black'] },
      { id: 'c2', grabNumber: 3, capacity: 10, position: { x: 1, y: 0 }, startStack: ['tabby', 'ginger', 'black', 'tabby', 'ginger'] },
      { id: 'c3', grabNumber: 3, capacity: 10, position: { x: 2, y: 0 }, startStack: ['black', 'calico', 'tabby', 'white', 'tabby'] },
      { id: 'c4', grabNumber: 3, capacity: 10, position: { x: 3, y: 0 }, startStack: [] },
    ],
  },

  // L7 — Tier 3: merge-3, grab≤3, 5 towers, goal: calico+siamese
  {
    id: 7, name: 'Flower Bed Snooze', world: 2, levelInWorld: 2, isBoss: false,
    description: 'Wake the calico and siamese from the flower beds',
    goalCoats: ['calico', 'siamese'], mergeSizeK: 3,
    budget: { type: 'moves', maxMoves: 28 },
    starThresholds: { two: 0.25, three: 0.5 }, triggers: [],
    containers: [
      { id: 'c1', grabNumber: 3, capacity: 10, position: { x: 0, y: 0 }, startStack: ['ginger', 'calico', 'black', 'siamese', 'calico'] },
      { id: 'c2', grabNumber: 3, capacity: 10, position: { x: 1, y: 0 }, startStack: ['siamese', 'tabby', 'calico', 'black', 'siamese'] },
      { id: 'c3', grabNumber: 3, capacity: 10, position: { x: 2, y: 0 }, startStack: ['calico', 'ginger', 'siamese', 'tabby', 'calico'] },
      { id: 'c4', grabNumber: 3, capacity: 10, position: { x: 3, y: 0 }, startStack: ['black', 'siamese', 'ginger'] },
      { id: 'c5', grabNumber: 3, capacity: 10, position: { x: 4, y: 0 }, startStack: [] },
    ],
  },

  // L8 — Tier 3→4 bridge: merge-3, grab≤3, 5 towers, goal: ginger+black, tighter
  {
    id: 8, name: 'Butterfly Chase', world: 2, levelInWorld: 3, isBoss: false,
    description: 'Catch the ginger and black cats before they escape',
    goalCoats: ['ginger', 'black'], mergeSizeK: 3,
    budget: { type: 'moves', maxMoves: 24 },
    starThresholds: { two: 0.2, three: 0.45 }, triggers: [],
    containers: [
      { id: 'c1', grabNumber: 3, capacity: 10, position: { x: 0, y: 0 }, startStack: ['tabby', 'ginger', 'white', 'black', 'ginger'] },
      { id: 'c2', grabNumber: 3, capacity: 10, position: { x: 1, y: 0 }, startStack: ['black', 'calico', 'ginger', 'tabby', 'black'] },
      { id: 'c3', grabNumber: 3, capacity: 10, position: { x: 2, y: 0 }, startStack: ['ginger', 'siamese', 'black', 'white', 'ginger'] },
      { id: 'c4', grabNumber: 3, capacity: 10, position: { x: 3, y: 0 }, startStack: ['black', 'tabby', 'calico'] },
      { id: 'c5', grabNumber: 3, capacity: 10, position: { x: 4, y: 0 }, startStack: [] },
    ],
  },

  // L9 — Tier 4: merge-3, grab≤3, 5 towers, goal: white+siamese, frozen tower
  {
    id: 9, name: 'Frozen Fountain', world: 2, levelInWorld: 4, isBoss: false,
    description: 'Thaw the fountain and free the white and siamese cats',
    goalCoats: ['white', 'siamese'], mergeSizeK: 3,
    budget: { type: 'moves', maxMoves: 26 },
    starThresholds: { two: 0.2, three: 0.45 }, triggers: [],
    containers: [
      { id: 'c1', grabNumber: 3, capacity: 10, position: { x: 0, y: 0 }, startStack: ['white', 'tabby', 'siamese', 'ginger', 'white'] },
      { id: 'c2', grabNumber: 3, capacity: 10, position: { x: 1, y: 0 }, startStack: ['siamese', 'black', 'white', 'calico', 'siamese'], frozen: true },
      { id: 'c3', grabNumber: 3, capacity: 10, position: { x: 2, y: 0 }, startStack: ['ginger', 'white', 'tabby', 'siamese', 'black'] },
      { id: 'c4', grabNumber: 3, capacity: 10, position: { x: 3, y: 0 }, startStack: ['calico', 'siamese', 'ginger'] },
      { id: 'c5', grabNumber: 3, capacity: 10, position: { x: 4, y: 0 }, startStack: [] },
    ],
  },

  // L10 — Tier 4 boss: merge-3, grab≤3, 6 towers, goal: tabby+calico+ginger
  {
    id: 10, name: 'Garden Party Boss', world: 2, levelInWorld: 5, isBoss: true,
    description: 'Clear three coats from the garden party',
    goalCoats: ['tabby', 'calico', 'ginger'], mergeSizeK: 3,
    budget: { type: 'moves', maxMoves: 34 },
    starThresholds: { two: 0.18, three: 0.4 },
    triggers: [{ event: 'onVanishComplete', condition: { vanishesCompleted: 3 }, action: { type: 'grantBudget', moves: 4 } }],
    containers: [
      { id: 'c1', grabNumber: 3, capacity: 10, position: { x: 0, y: 0 }, startStack: ['ginger', 'tabby', 'calico', 'black', 'ginger', 'tabby'] },
      { id: 'c2', grabNumber: 3, capacity: 10, position: { x: 1, y: 0 }, startStack: ['calico', 'siamese', 'ginger', 'tabby', 'calico'] },
      { id: 'c3', grabNumber: 3, capacity: 10, position: { x: 2, y: 0 }, startStack: ['tabby', 'white', 'calico', 'ginger', 'black'] },
      { id: 'c4', grabNumber: 3, capacity: 10, position: { x: 3, y: 0 }, startStack: ['ginger', 'calico', 'tabby', 'siamese', 'ginger'] },
      { id: 'c5', grabNumber: 3, capacity: 10, position: { x: 4, y: 0 }, startStack: ['black', 'tabby', 'white'] },
      { id: 'c6', grabNumber: 3, capacity: 10, position: { x: 5, y: 0 }, startStack: [] },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════
  // WORLD 3 — Midnight Rooftop  (L11-15)
  // ════════════════════════════════════════════════════════════════════════

  // L11 — Tier 5: merge-3, grab≤2, 5 towers, goal: black+siamese
  {
    id: 11, name: 'Rooftop Shadows', world: 3, levelInWorld: 1, isBoss: false,
    description: 'Clear the shadows from the midnight rooftop',
    goalCoats: ['black', 'siamese'], mergeSizeK: 3,
    budget: { type: 'moves', maxMoves: 24 },
    starThresholds: { two: 0.2, three: 0.42 }, triggers: [],
    containers: [
      { id: 'c1', grabNumber: 2, capacity: 10, position: { x: 0, y: 0 }, startStack: ['white', 'black', 'siamese', 'tabby', 'black', 'siamese'] },
      { id: 'c2', grabNumber: 2, capacity: 10, position: { x: 1, y: 0 }, startStack: ['siamese', 'ginger', 'black', 'calico', 'siamese'] },
      { id: 'c3', grabNumber: 2, capacity: 10, position: { x: 2, y: 0 }, startStack: ['black', 'tabby', 'siamese', 'white', 'black'] },
      { id: 'c4', grabNumber: 2, capacity: 10, position: { x: 3, y: 0 }, startStack: ['ginger', 'siamese', 'calico'] },
      { id: 'c5', grabNumber: 2, capacity: 10, position: { x: 4, y: 0 }, startStack: [] },
    ],
  },

  // L12 — Tier 5: merge-3, grab≤2, 5 towers, goal: white+ginger, coat-locked
  {
    id: 12, name: 'Chimney Perch', world: 3, levelInWorld: 2, isBoss: false,
    description: 'Sort the white cats to their locked tower',
    goalCoats: ['white', 'ginger'], mergeSizeK: 3,
    budget: { type: 'moves', maxMoves: 26 },
    starThresholds: { two: 0.2, three: 0.42 }, triggers: [],
    containers: [
      { id: 'c1', grabNumber: 2, capacity: 10, position: { x: 0, y: 0 }, startStack: ['tabby', 'white', 'ginger', 'black', 'white'] },
      { id: 'c2', grabNumber: 2, capacity: 10, position: { x: 1, y: 0 }, startStack: ['ginger', 'calico', 'white', 'siamese', 'ginger'] },
      { id: 'c3', grabNumber: 2, capacity: 10, position: { x: 2, y: 0 }, startStack: ['white', 'black', 'ginger', 'tabby', 'white'], coatLocked: 'white' },
      { id: 'c4', grabNumber: 2, capacity: 10, position: { x: 3, y: 0 }, startStack: ['siamese', 'ginger', 'calico'] },
      { id: 'c5', grabNumber: 2, capacity: 10, position: { x: 4, y: 0 }, startStack: [] },
    ],
  },

  // L13 — Tier 5→6 bridge: merge-3, grab≤2, 6 towers, goal: calico+tabby, tight
  {
    id: 13, name: 'Neon Alley', world: 3, levelInWorld: 3, isBoss: false,
    description: 'Sort the alley cats before the rain comes',
    goalCoats: ['calico', 'tabby'], mergeSizeK: 3,
    budget: { type: 'moves', maxMoves: 22 },
    starThresholds: { two: 0.18, three: 0.38 }, triggers: [],
    containers: [
      { id: 'c1', grabNumber: 2, capacity: 10, position: { x: 0, y: 0 }, startStack: ['siamese', 'calico', 'tabby', 'black', 'calico', 'tabby'] },
      { id: 'c2', grabNumber: 2, capacity: 10, position: { x: 1, y: 0 }, startStack: ['tabby', 'white', 'calico', 'ginger', 'tabby'] },
      { id: 'c3', grabNumber: 2, capacity: 10, position: { x: 2, y: 0 }, startStack: ['calico', 'black', 'tabby', 'siamese', 'calico'] },
      { id: 'c4', grabNumber: 2, capacity: 10, position: { x: 3, y: 0 }, startStack: ['tabby', 'ginger', 'calico', 'white'] },
      { id: 'c5', grabNumber: 2, capacity: 10, position: { x: 4, y: 0 }, startStack: ['black', 'calico'] },
      { id: 'c6', grabNumber: 2, capacity: 10, position: { x: 5, y: 0 }, startStack: [] },
    ],
  },

  // L14 — Tier 6: merge-3, grab≤2, 6 towers, goal: ginger+white+black
  {
    id: 14, name: 'Water Tower', world: 3, levelInWorld: 4, isBoss: false,
    description: 'Three coats, six towers, one chance',
    goalCoats: ['ginger', 'white', 'black'], mergeSizeK: 3,
    budget: { type: 'moves', maxMoves: 28 },
    starThresholds: { two: 0.18, three: 0.38 }, triggers: [],
    containers: [
      { id: 'c1', grabNumber: 2, capacity: 10, position: { x: 0, y: 0 }, startStack: ['tabby', 'ginger', 'white', 'black', 'ginger', 'calico'] },
      { id: 'c2', grabNumber: 2, capacity: 10, position: { x: 1, y: 0 }, startStack: ['black', 'siamese', 'ginger', 'white', 'black'] },
      { id: 'c3', grabNumber: 2, capacity: 10, position: { x: 2, y: 0 }, startStack: ['white', 'calico', 'black', 'tabby', 'white'] },
      { id: 'c4', grabNumber: 2, capacity: 10, position: { x: 3, y: 0 }, startStack: ['ginger', 'black', 'white', 'siamese', 'ginger'] },
      { id: 'c5', grabNumber: 2, capacity: 10, position: { x: 4, y: 0 }, startStack: ['black', 'tabby', 'ginger'] },
      { id: 'c6', grabNumber: 2, capacity: 10, position: { x: 5, y: 0 }, startStack: [] },
    ],
  },

  // L15 — Tier 6 boss: merge-3, grab≤2, 6 towers, goal: siamese+calico+tabby
  {
    id: 15, name: 'Midnight Boss', world: 3, levelInWorld: 5, isBoss: true,
    description: 'The rooftop king demands order',
    goalCoats: ['siamese', 'calico', 'tabby'], mergeSizeK: 3,
    budget: { type: 'moves', maxMoves: 32 },
    starThresholds: { two: 0.15, three: 0.35 },
    triggers: [{ event: 'onVanishComplete', condition: { vanishesCompleted: 3 }, action: { type: 'grantBudget', moves: 4 } }],
    containers: [
      { id: 'c1', grabNumber: 2, capacity: 10, position: { x: 0, y: 0 }, startStack: ['siamese', 'calico', 'tabby', 'black', 'siamese', 'calico'] },
      { id: 'c2', grabNumber: 2, capacity: 10, position: { x: 1, y: 0 }, startStack: ['tabby', 'white', 'siamese', 'calico', 'tabby', 'ginger'] },
      { id: 'c3', grabNumber: 2, capacity: 10, position: { x: 2, y: 0 }, startStack: ['calico', 'black', 'tabby', 'siamese', 'calico'] },
      { id: 'c4', grabNumber: 2, capacity: 10, position: { x: 3, y: 0 }, startStack: ['siamese', 'ginger', 'calico', 'tabby', 'siamese'] },
      { id: 'c5', grabNumber: 2, capacity: 10, position: { x: 4, y: 0 }, startStack: ['tabby', 'calico', 'black', 'siamese'] },
      { id: 'c6', grabNumber: 2, capacity: 10, position: { x: 5, y: 0 }, startStack: [] },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════
  // WORLD 4 — Dream Palace  (L16-20)
  // ════════════════════════════════════════════════════════════════════════

  // L16 — Tier 7: merge-3, grab≤2, 6 towers, goal: ginger+siamese+black
  {
    id: 16, name: 'Crystal Corridor', world: 4, levelInWorld: 1, isBoss: false,
    description: 'The palace cats are scattered through the corridors',
    goalCoats: ['ginger', 'siamese', 'black'], mergeSizeK: 3,
    budget: { type: 'moves', maxMoves: 26 },
    starThresholds: { two: 0.15, three: 0.32 }, triggers: [],
    containers: [
      { id: 'c1', grabNumber: 2, capacity: 10, position: { x: 0, y: 0 }, startStack: ['white', 'ginger', 'siamese', 'black', 'ginger', 'calico'] },
      { id: 'c2', grabNumber: 2, capacity: 10, position: { x: 1, y: 0 }, startStack: ['black', 'tabby', 'ginger', 'siamese', 'black'] },
      { id: 'c3', grabNumber: 2, capacity: 10, position: { x: 2, y: 0 }, startStack: ['siamese', 'calico', 'black', 'ginger', 'siamese'] },
      { id: 'c4', grabNumber: 2, capacity: 10, position: { x: 3, y: 0 }, startStack: ['ginger', 'black', 'tabby', 'siamese', 'ginger'] },
      { id: 'c5', grabNumber: 2, capacity: 10, position: { x: 4, y: 0 }, startStack: ['black', 'siamese', 'white', 'calico'] },
      { id: 'c6', grabNumber: 2, capacity: 10, position: { x: 5, y: 0 }, startStack: [] },
    ],
  },

  // L17 — Tier 7: merge-3, grab≤2, 6 towers, goal: white+tabby+calico
  {
    id: 17, name: 'Throne Room', world: 4, levelInWorld: 2, isBoss: false,
    description: 'Only the worthy cats may sit on the throne',
    goalCoats: ['white', 'tabby', 'calico'], mergeSizeK: 3,
    budget: { type: 'moves', maxMoves: 28 },
    starThresholds: { two: 0.15, three: 0.32 }, triggers: [],
    containers: [
      { id: 'c1', grabNumber: 2, capacity: 10, position: { x: 0, y: 0 }, startStack: ['ginger', 'white', 'tabby', 'calico', 'white', 'black'] },
      { id: 'c2', grabNumber: 2, capacity: 10, position: { x: 1, y: 0 }, startStack: ['calico', 'siamese', 'white', 'tabby', 'calico'] },
      { id: 'c3', grabNumber: 2, capacity: 10, position: { x: 2, y: 0 }, startStack: ['tabby', 'black', 'calico', 'white', 'tabby'] },
      { id: 'c4', grabNumber: 2, capacity: 10, position: { x: 3, y: 0 }, startStack: ['white', 'ginger', 'tabby', 'siamese', 'white'] },
      { id: 'c5', grabNumber: 2, capacity: 10, position: { x: 4, y: 0 }, startStack: ['calico', 'tabby', 'black', 'white'] },
      { id: 'c6', grabNumber: 2, capacity: 10, position: { x: 5, y: 0 }, startStack: [] },
    ],
  },

  // L18 — Tier 7: merge-3, grab≤2, 6 towers, goal: all 6 coats, brutal
  {
    id: 18, name: 'Hall of Mirrors', world: 4, levelInWorld: 3, isBoss: false,
    description: 'Every cat must find its reflection',
    goalCoats: ['ginger', 'white', 'black', 'tabby', 'calico', 'siamese'], mergeSizeK: 3,
    budget: { type: 'moves', maxMoves: 36 },
    starThresholds: { two: 0.12, three: 0.28 }, triggers: [],
    containers: [
      { id: 'c1', grabNumber: 2, capacity: 10, position: { x: 0, y: 0 }, startStack: ['ginger', 'white', 'black', 'tabby', 'calico', 'siamese'] },
      { id: 'c2', grabNumber: 2, capacity: 10, position: { x: 1, y: 0 }, startStack: ['siamese', 'ginger', 'calico', 'black', 'white'] },
      { id: 'c3', grabNumber: 2, capacity: 10, position: { x: 2, y: 0 }, startStack: ['tabby', 'calico', 'ginger', 'siamese', 'black'] },
      { id: 'c4', grabNumber: 2, capacity: 10, position: { x: 3, y: 0 }, startStack: ['white', 'tabby', 'siamese', 'ginger', 'calico'] },
      { id: 'c5', grabNumber: 2, capacity: 10, position: { x: 4, y: 0 }, startStack: ['black', 'siamese', 'tabby', 'white'] },
      { id: 'c6', grabNumber: 2, capacity: 10, position: { x: 5, y: 0 }, startStack: [] },
    ],
  },

  // L19 — Tier 7 penultimate: merge-3, grab≤2, 6 towers, goal: 4 coats
  {
    id: 19, name: 'Dream Staircase', world: 4, levelInWorld: 4, isBoss: false,
    description: 'Ascend the dream staircase with four coats cleared',
    goalCoats: ['ginger', 'black', 'calico', 'siamese'], mergeSizeK: 3,
    budget: { type: 'moves', maxMoves: 30 },
    starThresholds: { two: 0.12, three: 0.28 }, triggers: [],
    containers: [
      { id: 'c1', grabNumber: 2, capacity: 10, position: { x: 0, y: 0 }, startStack: ['white', 'ginger', 'black', 'calico', 'siamese', 'tabby'] },
      { id: 'c2', grabNumber: 2, capacity: 10, position: { x: 1, y: 0 }, startStack: ['siamese', 'calico', 'ginger', 'black', 'siamese'] },
      { id: 'c3', grabNumber: 2, capacity: 10, position: { x: 2, y: 0 }, startStack: ['black', 'tabby', 'siamese', 'ginger', 'calico'] },
      { id: 'c4', grabNumber: 2, capacity: 10, position: { x: 3, y: 0 }, startStack: ['calico', 'ginger', 'black', 'white', 'ginger'] },
      { id: 'c5', grabNumber: 2, capacity: 10, position: { x: 4, y: 0 }, startStack: ['siamese', 'black', 'calico', 'tabby'] },
      { id: 'c6', grabNumber: 2, capacity: 10, position: { x: 5, y: 0 }, startStack: [] },
    ],
  },

  // L20 — FINAL BOSS: merge-3, grab≤2, 6 towers, goal: all 6 coats
  {
    id: 20, name: 'The Dream Palace', world: 4, levelInWorld: 5, isBoss: true,
    description: 'The ultimate challenge — clear every coat from the palace',
    goalCoats: ['ginger', 'white', 'black', 'tabby', 'calico', 'siamese'], mergeSizeK: 3,
    budget: { type: 'moves', maxMoves: 40 },
    starThresholds: { two: 0.1, three: 0.25 },
    triggers: [
      { event: 'onVanishComplete', condition: { vanishesCompleted: 3 }, action: { type: 'grantBudget', moves: 3 } },
      { event: 'onVanishComplete', condition: { vanishesCompleted: 6 }, action: { type: 'grantBudget', moves: 3 } },
    ],
    containers: [
      { id: 'c1', grabNumber: 2, capacity: 10, position: { x: 0, y: 0 }, startStack: ['ginger', 'white', 'black', 'tabby', 'calico', 'siamese'] },
      { id: 'c2', grabNumber: 2, capacity: 10, position: { x: 1, y: 0 }, startStack: ['siamese', 'ginger', 'calico', 'black', 'white', 'tabby'] },
      { id: 'c3', grabNumber: 2, capacity: 10, position: { x: 2, y: 0 }, startStack: ['tabby', 'calico', 'ginger', 'siamese', 'black', 'white'] },
      { id: 'c4', grabNumber: 2, capacity: 10, position: { x: 3, y: 0 }, startStack: ['white', 'black', 'siamese', 'ginger', 'calico', 'tabby'] },
      { id: 'c5', grabNumber: 2, capacity: 10, position: { x: 4, y: 0 }, startStack: ['black', 'tabby', 'white', 'calico', 'siamese'] },
      { id: 'c6', grabNumber: 2, capacity: 10, position: { x: 5, y: 0 }, startStack: [] },
    ],
  },
];

// ─── State factory ────────────────────────────────────────────────────────────

export function initLevelState(levelConfig: LevelConfig, levelIndex: number): GameState {
  const containers = levelConfig.containers.map(makeContainer);
  const goalProgress = {} as Record<CoatId, { cleared: number; total: number }>;
  for (const coat of levelConfig.goalCoats) {
    let total = 0;
    for (const c of containers) for (const it of c.stack) if (it.coat === coat) total++;
    goalProgress[coat] = { cleared: 0, total };
  }
  const budget: BudgetState = {
    type: levelConfig.budget.type,
    movesLeft: levelConfig.budget.maxMoves ?? 999,
    secondsLeft: levelConfig.budget.maxSeconds ?? 999,
  };
  const triggers = levelConfig.triggers.map(t => ({ ...t, fired: false }));
  return {
    phase: 'playing',
    levelConfig: { ...levelConfig, triggers },
    containers,
    budget,
    selectedContainerId: null,
    chunk: null,
    score: 0,
    chainLength: 0,
    bestChain: 0,
    movesCompleted: 0,
    vanishesCompleted: 0,
    goalProgress,
    stars: 0,
    message: null,
    speechBubbles: [],
    particles: [],
    currentLevelIndex: levelIndex,
  };
}
