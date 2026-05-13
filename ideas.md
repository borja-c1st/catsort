# CatSort — Design Ideas

<response>
<idea>
**Design Movement:** Kawaii Storybook Illustration
**Core Principles:**
1. Every element feels hand-drawn — soft ink outlines, slight wobble on shapes, imperfect fills
2. Pastel-on-cream palette with warm paper texture underlay
3. Cats are the star — expressive, large-eyed, round-bodied characters dominate the visual hierarchy
4. Delight through micro-surprise: every interaction triggers a small illustrated reaction

**Color Philosophy:** Warm cream (#FFF8F0) background with dusty rose, lavender, mint, and butter yellow as the five cat colors. Deep charcoal (#2D2D2D) for outlines and text — never pure black. Emotional intent: safe, warm, nostalgic, like a children's picture book.

**Layout Paradigm:** Vertical scroll-free portrait canvas. Towers arranged in a gentle arc across the lower 60% of the screen. HUD floats at top as a thin illustrated banner. No rigid grid — towers are placed organically with slight height variation.

**Signature Elements:**
1. Rounded, slightly-squished tower shapes with visible wood-grain texture
2. Cat items drawn as round blobs with two ears, dot eyes, and a tiny nose
3. Particle bursts on vanish: floating hearts and sparkle stars

**Interaction Philosophy:** Taps feel bouncy — selected tower wobbles, lifted cats float with a gentle bob animation. Illegal placements shake the tower with a cartoon "no" wiggle.

**Animation:** Spring physics on all movement (stiffness 200, damping 20). Cats bounce into place. Vanish plays a sequential pop with ascending pitch. Cascade chains produce increasingly large heart bursts.

**Typography System:** "Nunito" (rounded, friendly) for all UI text. Bold 700 for numbers/scores, Regular 400 for labels. No serif anywhere.
</idea>
<probability>0.08</probability>
</response>

<response>
<idea>
**Design Movement:** Soft Risograph / Zine Aesthetic
**Core Principles:**
1. Deliberate color misregistration — slight offset shadows in a second color give depth without 3D
2. Halftone dot textures on backgrounds and container fills
3. Bold, flat shapes with thick borders — no gradients, no blur
4. Playful asymmetry: UI panels are slightly tilted, labels are hand-stamped

**Color Philosophy:** Off-white (#F5F0E8) base. Five vivid but muted cat colors: terracotta, sage green, dusty blue, golden yellow, lilac. Black borders at 3px. Ink-on-paper emotional register — artisanal, indie, tactile.

**Layout Paradigm:** Towers sit on a "shelf" — a thick horizontal band across the bottom third. Each tower is a rectangular card with a torn-paper top edge. The shelf has a subtle wood-grain halftone pattern.

**Signature Elements:**
1. Halftone dot overlay on every colored surface
2. Stamp-style labels for N values and move counts
3. Risograph-style double-exposure shadow on selected tower

**Interaction Philosophy:** Interactions feel like pressing rubber stamps — quick, satisfying, slightly imprecise. Taps produce an ink-splat ripple. Vanish plays a "thud-pop" with ink-splash particles.

**Animation:** Short, snappy — 120ms ease-out for most interactions. No spring physics; instead, slight overshoot via cubic-bezier(0.34, 1.56, 0.64, 1). Cascade chains produce stacked ink-splash bursts.

**Typography System:** "Fredoka One" for headings and numbers. "Nunito" for body/labels. Slight letter-spacing on uppercase labels for stamp feel.
</idea>
<probability>0.07</probability>
</response>

<response>
<idea>
**Design Movement:** Cozy Cottagecore / Soft Glassmorphism
**Core Principles:**
1. Frosted-glass panels over a soft watercolor gradient background
2. Warm, muted pastels — nothing saturated, everything feels like it's been left in afternoon sun
3. Organic shapes — containers are rounded towers with a slight taper, cats are plush-toy round
4. Layered depth: background gradient → mid-layer frosted glass → foreground cats with soft drop shadows

**Color Philosophy:** Background: a slow diagonal gradient from dusty rose (#F9D5D3) to soft lavender (#E8D5F9) to mint (#D5F9E8). Cat colors: coral, periwinkle, sage, peach, lilac — all desaturated 30%. Emotional intent: dreamy, cozy, Instagram-worthy.

**Layout Paradigm:** Towers float on a frosted glass "play mat" card centered in the portrait viewport. The card has a soft shadow and rounded corners. Towers are evenly spaced but vary in height. HUD is a thin frosted strip at the top.

**Signature Elements:**
1. Frosted glass containers with a subtle inner glow on selection
2. Cats rendered as soft rounded blobs with a plush-toy texture (subtle radial gradient)
3. Vanish burst: expanding ring of soft petals/hearts that fade out

**Interaction Philosophy:** Everything feels soft and forgiving. Selected tower glows. Dragging a chunk shows a translucent ghost. Illegal placement dims the target and shows a gentle pulse.

**Animation:** Slow, dreamy — 250ms ease-out for most transitions. Cats float up with a gentle arc on grab. Vanish plays a slow bloom animation. Score increments with a gentle number roll.

**Typography System:** "Quicksand" (rounded, airy) for all text. Light 300 for labels, SemiBold 600 for numbers. Slight tracking on headings.
</idea>
<probability>0.09</probability>
</response>
