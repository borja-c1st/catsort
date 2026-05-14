# CatSort 🐱

> **Stack · Sort · Vanish!** — A hypercasual mobile puzzle game built with React 19 + Vite + Tailwind 4.

**Live preview:** [catsortgame-8d7memwq.manus.space](https://catsortgame-8d7memwq.manus.space)
**GitHub:** [github.com/borja-c1st/catsort](https://github.com/borja-c1st/catsort)

---

## Branches

| Branch | Owner | Purpose |
|--------|-------|---------|
| `main` | — | Stable, always-deployable trunk |
| `borja` | Borja | Borja's feature work |
| `bobby` | Bobby | Bobby's feature work |
| `denzil` | Denzil | Denzil's feature work |

**Workflow:** branch from `main` → develop → PR back into `main`.

---

## How to Run

```bash
# Install dependencies
pnpm install

# Start dev server (http://localhost:3000)
pnpm dev

# TypeScript check
npx tsc --noEmit
```

No backend, no database — pure static React SPA.

---

## How to Play

1. **Tap a tower** to grab its top N cats (N shown on the bed badge).
2. **Tap another tower** to drop them there.
3. When **K or more cats of the same coat** are stacked consecutively, they **vanish** with a hearts explosion.
4. **Clear all goal-coat cats** shown in the top bar to win the level.
5. Each tower holds a **maximum of 10 cats**. Trying to overfill shows a "Max capacity 🐾" toast.

---

## Project Structure

```
catsort_game/
├── client/
│   ├── index.html              ← Google Fonts (Fredoka One, Nunito, Caveat)
│   └── src/
│       ├── pages/
│       │   └── Home.tsx        ← ENTIRE game UI (see component map below)
│       ├── lib/
│       │   └── gameEngine.ts   ← All game logic (pure functions, no React)
│       └── index.css           ← Global tokens, Tailwind base
├── server/                     ← Placeholder only (static project)
└── shared/
    └── const.ts                ← Shared constants
```

---

## Key Files

### `client/src/lib/gameEngine.ts` — Game Logic

Pure TypeScript, zero React. All game state transitions happen here.

**Key types:**
```ts
type CoatId = 'ginger' | 'white' | 'tabby' | 'calico' | 'black' | 'siamese';

interface CatItem { id: string; coat: CoatId; }
interface ContainerState { id: string; items: CatItem[]; grabN: number; capacity: number; }
interface GameState { /* full game state */ }
interface LevelConfig { /* level definition */ }
```

**Key functions:**
| Function | Description |
|----------|-------------|
| `startLevel(levelIndex)` | Returns initial `GameState` for a level |
| `placeChunk(state, fromId, toId)` | Core move: grab N cats from `fromId`, place on `toId`. Returns `{ next: GameState, steps: AnimStep[] }` |
| `findRuns(items, k)` | Finds consecutive same-coat runs of length ≥ K |
| `computeStars(state)` | Returns 1–3 stars based on moves remaining |

**`AnimStep` union** (drives all animations in `Home.tsx`):
```ts
type AnimStep =
  | { type: 'settle' }                          // cats land
  | { type: 'vanish'; containerId: string; itemIds: string[] }  // cats pop
  | { type: 'win' }
  | { type: 'fail' };
```

**Level config shape:**
```ts
interface LevelConfig {
  name: string;
  description: string;
  mergeSizeK: number;           // how many same-coat cats trigger a vanish
  goalCoats: CoatId[];          // coats the player must clear
  containers: {
    id: string;
    grabN: number;              // how many cats this tower lets you grab
    capacity: number;           // max cats (always 10)
    initialItems: CoatId[];     // bottom → top order
  }[];
  budget: { maxMoves: number };
}
```

**20 levels across 4 worlds** (defined in `LEVELS` array):
- **World 1** (L1–5): Cozy Living Room — K=2, 3 towers, intro mechanics
- **World 2** (L6–10): Garden Afternoon — K=2–3, 4 towers, mixed coats
- **World 3** (L11–15): Midnight Rooftop — K=3, 5 towers, tighter budgets
- **World 4** (L16–20): Dream Palace — K=3–4, 5–6 towers, boss levels

---

### `client/src/pages/Home.tsx` — All UI

One large file (~1600 lines). Component map:

| Component | Description |
|-----------|-------------|
| `Root` | Top-level state manager. Owns `gameState`, `screen`, `burst` (particles), `catItemRefs` |
| `TitleScreen` | Landing screen with cat parade and Play Now button |
| `WorldMap` | Saga-style scrollable level selector (bottom = L1, top = L20) |
| `GameBoard` | Main game screen. Contains HUD + towers + boosters |
| `CurrencyBar` | Top bar: coins 🪙, gems 💎, lives ❤️ |
| `HUD` | Level name, moves counter, goal cats display |
| `MergeKBadge` | Big "MERGE N" pill shown above towers |
| `TowerContainer` | Single tower: invisible shaft + bed image + cat stack |
| `CatIdleWrapper` | `requestAnimationFrame` idle wobble (cosine scale + sine rotation) |
| `FloatingChunk` | Grabbed cats floating above the board |
| `BoosterBar` | 3 gradient booster buttons (Undo / +5 Moves / Bomb) |
| `ParticleLayer` | Renders the hearts burst explosion particles |
| `LevelCompleteOverlay` | Bottom-sheet win screen with King-style stars |
| `LevelFailOverlay` | Bottom-sheet fail screen |
| `PauseOverlay` | Bottom-sheet pause screen |

**State flow in `Root`:**
```
screen: 'title' → 'worldmap' → 'game'
gameState.phase: 'playing' → 'animating' → 'won' | 'failed'
```

**Vanish animation sequence** (timing constants at top of `handleTap`):
```
SETTLE_MS (120ms) → SHOW_MS glow (600ms) → burst fires (50ms delay) → cats pop (630ms CSS) → CHAIN_GAP (220ms) → next step or done
```

---

## Design System

**Fonts:** Fredoka One (headings/badges), Nunito (body/buttons), Caveat (decorative)

**Color palette** (`C` object in `Home.tsx`):
```ts
const C = {
  cream: '#FFF8F0',
  peach: '#FFE8D8',
  peachMid: '#FFCFB3',
  accent: '#E8745A',      // primary CTA
  brown: '#3A2A25',
  brownMid: '#7A5A50',
  bossNavy: '#1A1830',
  // ...
};
```

**Design philosophy (King/Supercell/Voodoo):**
- Fully rounded corners everywhere (`borderRadius: 999` for pills)
- 3D press-shadow buttons (`boxShadow: '0 6px 0 #darkColor'`)
- Bottom-sheet overlays (slide up from bottom, `borderRadius: '32px 32px 0 0'`)
- Fredoka One for all game-facing text
- Soft pastel gradient backgrounds
- No sharp corners anywhere

---

## Cat Coats

| CoatId | Emoji | Label | Color |
|--------|-------|-------|-------|
| `ginger` | 🟠 | Ginger | `#E8745A` |
| `white` | ⚪ | White | `#F0EDE8` |
| `tabby` | 🩶 | Tabby | `#8A8A9A` |
| `calico` | 🌸 | Calico | `#E8A87C` |
| `black` | ⚫ | Black | `#2A2A3A` |
| `siamese` | 🤍 | Siamese | `#D4C4B0` |

Cat images are rendered as emoji via `CatImg` component (SVG/emoji fallback, no external assets needed).

---

## Game Mechanics Context (`game_mechanics_context/`)

The `game_mechanics_context/` folder is a **design specification library** cloned from [BobbyAnalyst/CatSort](https://github.com/BobbyAnalyst/CatSort). It defines every game mechanic as a standalone prompt-ready document. Any AI agent or developer working on this project should read these specs before implementing or modifying game logic.

### What It Is

A 19-file prompt-net that fully specifies the CatSort puzzle engine — from the atomic `Item` up to `BossLevel` and `Booster`. Each file is ≤ 120 lines, theme-agnostic (no `cat` or `tower` in interfaces), and designed to be fed directly to a code-capable AI agent.

### Reading Order

Always start with `Overview.md`, then follow this dependency order:

| # | File | What it defines |
|---|------|-----------------|
| 0 | [`Overview.md`](game_mechanics_context/Overview.md) | Spine of the spec — locked design decisions, core loop diagram, domain element list. **Read first.** |
| 1 | [`Container.md`](game_mechanics_context/Container.md) | Stack-holding location with grab number N (maps to a Tower in the game) |
| 2 | [`Item.md`](game_mechanics_context/Item.md) | Colored unit; one coat from the Level palette (maps to a Cat) |
| 3 | [`Chunk.md`](game_mechanics_context/Chunk.md) | Transient N-Item group lifted during a Move (the floating grabbed cats) |
| 4 | [`Grab.md`](game_mechanics_context/Grab.md) | Removes exactly N top Items from a source Container |
| 5 | [`Placement.md`](game_mechanics_context/Placement.md) | Drops a Chunk onto a target Container |
| 6 | [`Move.md`](game_mechanics_context/Move.md) | One Grab + one Placement; ticks the Budget |
| 7 | [`Budget.md`](game_mechanics_context/Budget.md) | Move and/or time limit |
| 8 | [`Vanish.md`](game_mechanics_context/Vanish.md) | Post-Placement merge-K scan; runs of ≥ K same-coat Items vanish anywhere in the stack |
| 9 | [`WinCondition.md`](game_mechanics_context/WinCondition.md) | All goal-coat Items cleared |
| 10 | [`FailCondition.md`](game_mechanics_context/FailCondition.md) | Budget exhausted before WinCondition |
| 11 | [`SpecialContainer.md`](game_mechanics_context/SpecialContainer.md) | Container variants (frozen, locked, etc.) |
| 12 | [`SpecialItem.md`](game_mechanics_context/SpecialItem.md) | Item variants (wild, locked, etc.) |
| 13 | [`LevelTrigger.md`](game_mechanics_context/LevelTrigger.md) | Declarative per-Level rules firing on game events |
| 14 | [`Level.md`](game_mechanics_context/Level.md) | Assembles Containers + palette + goal coats + K + Budget + triggers + specials |
| 15 | [`BossLevel.md`](game_mechanics_context/BossLevel.md) | Level archetype (`isBoss: true`) with spawn triggers + tight Budget |
| 16 | [`Booster.md`](game_mechanics_context/Booster.md) | Runtime hooks for assist/override consumables (Undo, +Moves, Bomb) |
| 17 | [`Theme.md`](game_mechanics_context/Theme.md) | How CatSort consumes the project Theme contract |
| 18 | [`ArtSpec.md`](game_mechanics_context/ArtSpec.md) | Art-direction brief for the cat launch skin |
| 19 | [`ArtLibrary.md`](game_mechanics_context/ArtLibrary.md) | Runtime asset registry; placeholder → polish swap |

### How Elements Interact

Runtime data flow during a single Move:

```
Player taps source
  → Grab (lifts N top Items)
    → Chunk (transient group)
      → Player taps target
        → Placement (pushes onto Container, ticks Move)
          → Budget (decremented)
          → Vanish (scans whole stack for runs ≥ K)
            → cascades on gravity collapse
            → emits clearance to WinCondition
          → FailCondition (if Budget hits zero)
```

Cross-cutting modifiers: `LevelTrigger` fires on Move/Vanish/Budget events; `SpecialContainer` modifies stack behavior; `SpecialItem` modifies Vanish run rules; `Booster` is player-invoked override.

### Mapping Spec → Code

| Spec term | Code equivalent |
|-----------|-----------------|
| `Container` | `ContainerState` in `gameEngine.ts` |
| `Item` | `CatItem` in `gameEngine.ts` |
| `Chunk` | The `heldChunk` in `GameState` |
| `Grab` | First half of `placeChunk()` |
| `Placement` | Second half of `placeChunk()` |
| `Vanish` | `findRuns()` + `VanishStep` in `gameEngine.ts` |
| `Budget` | `GameState.budget.movesLeft` |
| `WinCondition` | `goalCoats` cleared check in `placeChunk()` |
| `Level` | `LevelConfig` + `LEVELS[]` in `gameEngine.ts` |
| `Booster` | `BoosterBar` in `Home.tsx` (UI only, logic not yet implemented) |

### For AI Agents

When implementing a new mechanic (e.g. a `SpecialContainer` variant or a new `Booster`):
1. Read the corresponding spec file in `game_mechanics_context/`
2. Check the **Reads First** links at the top of that spec file
3. Map the spec's TypeScript interface to the existing types in `gameEngine.ts`
4. Implement in `gameEngine.ts` (pure logic) first, then wire up UI in `Home.tsx`
5. Run `npx tsc --noEmit` before committing

---

## Planned / Backlog

- [ ] Sound effects (mrow on grab, pop on vanish, chime on win)
- [ ] Booster functionality (Undo, +5 Moves, Bomb — currently show toast "coming soon")
- [ ] Real coin/gem economy (earn on level clear, spend on boosters)
- [ ] World unlock animation (fanfare when boss level beaten)
- [ ] Level preview on node tap (cat lineup + star requirements)
- [ ] Title screen hypercasual redesign (Fredoka One + gradient buttons)
- [ ] Saga map decorations (clouds, grass, path connectors)
- [ ] Persistent save (localStorage for stars + unlocked levels)

---

## For AI Agents

If you are an AI agent continuing work on this project:

1. **Read `gameEngine.ts` first** — all game logic lives there. Never put game logic in React components.
2. **`Home.tsx` is one file** — search for the component you need with `grep` before editing.
3. **TypeScript check before committing:** `cd /home/ubuntu/catsort_game && npx tsc --noEmit`
4. **No backend** — this is a pure static SPA. Do not add server routes.
5. **Asset uploads** — use `manus-upload-file --webdev` for any images; do not put assets in `client/public/` or `client/src/assets/`.
6. **Checkpoint before risky changes** — use `webdev_save_checkpoint` before large refactors.
7. **Branch discipline** — work on your named branch, PR into `main`.

The game is fully playable end-to-end. Focus areas for next session: sound effects, booster implementation, and persistent save state.
