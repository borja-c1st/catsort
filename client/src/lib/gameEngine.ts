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
    return { success: false, error: 'Not enough space!', vanishResults: [], vanishSteps: [], won: false, failed: false, newState: state };
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

      vanishSteps.push({ vanishingIds, coat, preState, postState, scoreGain: stepScore });
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

export const LEVELS: LevelConfig[] = [
  // ── LEVEL 1 ─ grab ≤2, merge 2, 3 towers ──────────────────────────────────
  {
    id: 1, name: 'Sunny Windowsill', world: 1, levelInWorld: 1, isBoss: false,
    description: 'Send the ginger kittens home',
    goalCoats: ['ginger'],
    mergeSizeK: 2,
    budget: { type: 'moves', maxMoves: 20 },
    starThresholds: { two: 0.3, three: 0.6 },
    triggers: [],
    containers: [
      // 3 towers: 2 filled + 1 empty buffer
      { id: 'c1', grabNumber: 2, capacity: 6, position: { x: 0, y: 0 }, startStack: ['white', 'ginger', 'tabby', 'ginger'] },
      { id: 'c2', grabNumber: 2, capacity: 6, position: { x: 1, y: 0 }, startStack: ['ginger', 'tabby', 'ginger', 'white'] },
      { id: 'c3', grabNumber: 2, capacity: 6, position: { x: 2, y: 0 }, startStack: [] },
    ],
  },
  // ── LEVEL 2 ─ grab ≤2, merge 2, 4 towers ──────────────────────────────────
  {
    id: 2, name: 'Bookshelf Nap', world: 1, levelInWorld: 2, isBoss: false,
    description: 'Clear the tabby cats',
    goalCoats: ['tabby'],
    mergeSizeK: 2,
    budget: { type: 'moves', maxMoves: 22 },
    starThresholds: { two: 0.3, three: 0.55 },
    triggers: [],
    containers: [
      // 4 towers: 3 filled + 1 empty buffer
      { id: 'c1', grabNumber: 2, capacity: 6, position: { x: 0, y: 0 }, startStack: ['white', 'tabby', 'ginger', 'tabby'] },
      { id: 'c2', grabNumber: 2, capacity: 6, position: { x: 1, y: 0 }, startStack: ['tabby', 'white', 'tabby', 'ginger'] },
      { id: 'c3', grabNumber: 2, capacity: 6, position: { x: 2, y: 0 }, startStack: ['ginger', 'tabby', 'white'] },
      { id: 'c4', grabNumber: 2, capacity: 6, position: { x: 3, y: 0 }, startStack: [] },
    ],
  },
  // ── LEVEL 3 ─ grab ≤3, merge 3, 3 towers ──────────────────────────────────
  {
    id: 3, name: 'Calico Corner', world: 1, levelInWorld: 3, isBoss: false,
    description: 'Collect all the calico cats',
    goalCoats: ['calico'],
    mergeSizeK: 3,
    budget: { type: 'moves', maxMoves: 22 },
    starThresholds: { two: 0.3, three: 0.55 },
    triggers: [],
    containers: [
      // 3 towers: 2 filled + 1 empty
      { id: 'c1', grabNumber: 3, capacity: 7, position: { x: 0, y: 0 }, startStack: ['siamese', 'calico', 'black', 'calico', 'siamese'] },
      { id: 'c2', grabNumber: 3, capacity: 7, position: { x: 1, y: 0 }, startStack: ['calico', 'black', 'calico', 'siamese', 'calico'] },
      { id: 'c3', grabNumber: 3, capacity: 7, position: { x: 2, y: 0 }, startStack: [] },
    ],
  },
  // ── LEVEL 4 ─ grab ≤3, merge 3, 4 towers ──────────────────────────────────
  {
    id: 4, name: 'Surprise Guests', world: 1, levelInWorld: 4, isBoss: false,
    description: 'Send the siamese cats to rest',
    goalCoats: ['siamese'],
    mergeSizeK: 3,
    budget: { type: 'moves', maxMoves: 26 },
    starThresholds: { two: 0.25, three: 0.5 },
    triggers: [],
    containers: [
      // 4 towers: 3 filled + 1 empty
      { id: 'c1', grabNumber: 3, capacity: 8, position: { x: 0, y: 0 }, startStack: ['ginger', 'siamese', 'tabby', 'black', 'siamese'] },
      { id: 'c2', grabNumber: 3, capacity: 8, position: { x: 1, y: 0 }, startStack: ['siamese', 'calico', 'black', 'siamese', 'tabby'] },
      { id: 'c3', grabNumber: 3, capacity: 8, position: { x: 2, y: 0 }, startStack: ['tabby', 'siamese', 'calico', 'ginger'] },
      { id: 'c4', grabNumber: 3, capacity: 8, position: { x: 3, y: 0 }, startStack: [] },
    ],
  },
  // ── LEVEL 5 ─ grab ≤3, merge 3, 5 towers (boss) ───────────────────────────
  {
    id: 5, name: 'Moonlit Window', world: 1, levelInWorld: 5, isBoss: true,
    description: 'Clear two coats before dawn',
    goalCoats: ['ginger', 'white'],
    mergeSizeK: 3,
    budget: { type: 'moves', maxMoves: 30 },
    starThresholds: { two: 0.2, three: 0.45 },
    triggers: [
      {
        event: 'onVanishComplete',
        condition: { vanishesCompleted: 2 },
        action: { type: 'grantBudget', moves: 3 },
      },
    ],
    containers: [
      // 5 towers: 4 filled + 1 empty
      { id: 'c1', grabNumber: 3, capacity: 9, position: { x: 0, y: 0 }, startStack: ['white', 'ginger', 'tabby', 'ginger', 'white', 'black'] },
      { id: 'c2', grabNumber: 3, capacity: 9, position: { x: 1, y: 0 }, startStack: ['ginger', 'white', 'calico', 'ginger', 'tabby'] },
      { id: 'c3', grabNumber: 3, capacity: 9, position: { x: 2, y: 0 }, startStack: ['tabby', 'white', 'ginger', 'black', 'calico'] },
      { id: 'c4', grabNumber: 3, capacity: 9, position: { x: 3, y: 0 }, startStack: ['white', 'ginger', 'tabby', 'black'] },
      { id: 'c5', grabNumber: 3, capacity: 9, position: { x: 4, y: 0 }, startStack: [] },
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
