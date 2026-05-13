# CatSort Design Notes

## Typography
- **Nunito 800/900** — UI & numerals (HUD, buttons, scores)
- **Caveat** — meows, hand-marks, level names (cursive handwritten feel)

## Palette
| Name | Hex (approx) | Usage |
|------|-------------|-------|
| cream | #FFF3E8 | Background |
| peach | #FFCFB3 | Light bg tint, tower platforms |
| accent | #E8745A | Buttons, highlights, ginger cat |
| pink | #F4B8C8 | Pink cat, UI accents |
| butter | #F4DC78 | Yellow cat, star icons |
| sage | #A8C8A0 | Green cat, calm elements |
| sky | #A8C8E8 | Blue cat, sky elements |
| lavender | #C8B8E8 | Purple cat, level map |
| brown | #3A2A25 | Text, outlines (replaces black) |

## Cat Coats (6 types with colorblind-safe non-color cues)
1. **ginger** — orange, stripes
2. **white** — white, collar
3. **black** — black, socks
4. **tabby** — grey, 'M' marking on forehead
5. **calico** — white+orange+black patches
6. **siamese** — cream+dark mask

## Cat Tower Design
- Cats sit on **round wooden platforms** (ellipse base, warm brown)
- A **wooden plaque** on the side shows the grab number N (engraved look)
- Cats stack vertically, each with a cute rounded body
- Empty tower shows just the platform with "empty" label

## Screen 01 — Standard Level (mid-move)
- **Top bar**: pause button | "WORLD 1 · LEVEL 7" | settings icon
- **Goal strip**: "GOAL · MERGE { K = 3 } · Send the ginger kittens home" + cat avatar + progress "5/9"
- **Stats row**: 🐾 14 moves | ⏱ chain ×1 | ⭐ 3,420
- **Game area**: warm peach background (#FFE6DB), towers with cats stacked on platforms
- **Chunk lifted**: "mrow ~" speech bubble + sparkle particles floating near lifted cats
- **"purr ♥"** speech bubble appears near a tower when cats match
- **Bottom booster bar**: Undo | +5 moves | Solo grab | Color bomb (pill buttons)
- **Grab number plaque**: rounded rect with N in white, attached to tower side

## Screen 02 — Boss Level
- **Dark background** (deep navy/charcoal) for boss atmosphere
- **Top**: "★ BOSS · MOONLIT WINDOW ★" with star decorations
- **Spawn trigger notice**: "SPAWN TRIGGER · EVERY 3 MOVES"
- **Goal**: "Clear two coats before dawn" + two cat avatars + progress
- **Timer**: "0:24 left" (time-based budget for boss)
- **CHAIN ×3** banner in large text during cascade
- **"meow meow!"** and **"mreow!"** speech bubbles
- **Revive button** visible when about to fail

## Screen 03 — Level Complete
- **"Naptime!"** as the win title (Caveat font, large)
- 3 stars displayed
- Stats: Score | Moves left | Best chain
- Buttons: "Next level →" (accent) | "Replay" (secondary)

## Screen 04 — World Map
- **"WORLD 1 · COZY LIVING ROOM"** header
- Progress: "14/30" cats cleared
- **"Up next · Level 7"** with level description
- Level nodes in a grid: numbered circles, completed ones show ★★★
- Locked levels shown greyed out

## Key UI Patterns
- Warm peach/cream background for standard levels
- Dark navy for boss levels
- Rounded pill buttons for boosters
- Speech bubbles ("mrow ~", "purr ♥") as feedback
- Wooden platform aesthetic for towers
- N-plaque: rounded rect showing grab number, attached to tower right side
- Chain banner: large bold text overlay during combos
