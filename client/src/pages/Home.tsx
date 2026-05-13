/**
 * CatSort — Main Game Page
 * Design: Warm peach/cream palette per ArtSpec
 * - Real cat PNG artwork (ginger/white/black/tabby/calico/siamese)
 * - Wooden tower platforms with N-plaque
 * - Nunito 800/900 for UI, Caveat for hand-marks & level names
 * - Speech bubbles ("mrow ~", "purr ♥") as feedback
 * - Booster bar: Undo | +5 moves | Solo grab | Color bomb
 * - World map screen with level nodes
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  COAT_COLORS,
  LEVELS,
  type CoatId,
  type Container,
  type GameState,
  type Particle,
  type SpeechBubble,
  cancelGrab,
  grabChunk,
  initLevelState,
  placeChunk,
} from '@/lib/gameEngine';

// ─── Cat image URLs ───────────────────────────────────────────────────────────

const CAT_IMGS: Record<CoatId, string> = {
  ginger:  '/manus-storage/ginger_0340cade.png',
  white:   '/manus-storage/white_b12276c1.png',
  black:   '/manus-storage/black_3bc1a94e.png',
  tabby:   '/manus-storage/tabby_68f506a3.png',
  calico:  '/manus-storage/calico_a0255629.png',
  siamese: '/manus-storage/siamese_2ffcf313.png',
};

// ─── Kitten images (used in goal strip / level complete) ────────────────────────
const KITTEN_IMGS: Record<CoatId, string> = {
  ginger:  '/manus-storage/kitten-ginger_645d1633.png',
  white:   '/manus-storage/kitten-white_d0147484.png',
  black:   '/manus-storage/kitten-black_b0db4380.png',
  tabby:   '/manus-storage/kitten-tabby_1186b8e3.png',
  calico:  '/manus-storage/kitten-calico_50de4d87.png',
  siamese: '/manus-storage/kitten-siamese_98f2fa78.png',
};

// ─── UI asset URLs ────────────────────────────────────────────────────────────
const A = {
  // Tower states (capacity-based variants)
  towerN2Empty:    '/manus-storage/tower-n2-empty_4ab60b5f.png',
  towerN3Empty:    '/manus-storage/tower-n3-empty_c3c7bffb.png',
  towerN4Empty:    '/manus-storage/tower-n4-empty_7ee14419.png',
  towerN5Empty:    '/manus-storage/tower-n5-empty_d11a9867.png',
  towerN3Stacked:  '/manus-storage/tower-n3-stacked_b8603250.png',
  towerN4Stacked:  '/manus-storage/tower-n4-stacked_062362ab.png',
  towerN5Stacked:  '/manus-storage/tower-n5-stacked_f7bf6ad5.png',
  towerSelected:   '/manus-storage/tower-selected_2237999b.png',
  towerLocked:     '/manus-storage/tower-locked_aba116df.png',
  towerFrozen:     '/manus-storage/tower-frozen_bc2b239c.png',
  // New capacity-specific tower PNGs (4-10 cats)
  tower4:  '/manus-storage/tower-4-cats_ffab4384.png',
  tower5:  '/manus-storage/tower-5-cats_c2ad6cdb.png',
  tower6:  '/manus-storage/tower-6-cats_1a73deef.png',
  tower7:  '/manus-storage/tower-7-cats_713f1f6f.png',
  tower8:  '/manus-storage/tower-8-cats_41f4ac2c.png',
  tower9:  '/manus-storage/tower-9-cats_03f77149.png',
  tower10: '/manus-storage/tower-10-cats_0de06d4b.png',
  plaque:          '/manus-storage/plaque_1b59acd4.png',
  // Map
  mapBanner:       '/manus-storage/map-banner_499b49c7.png',
  mapNodeCurrent:  '/manus-storage/map-node-current_8376b5f6.png',
  mapNodeBoss:     '/manus-storage/map-node-boss_05df8254.png',
  mapNodeDone1:    '/manus-storage/map-node-done-1_b7bea12f.png',
  mapNodeDone3:    '/manus-storage/map-node-done-3_cf1cacbd.png',
  mapNodeLocked:   '/manus-storage/map-node-locked_bbc89941.png',
  // Stars
  starOn:          '/manus-storage/star-on_a37d6a47.png',
  starOff:         '/manus-storage/star-off_ccaab9e5.png',
  starOnBig:       '/manus-storage/star-on-big_b9380cda.png',
  // Goal
  goalPill:        '/manus-storage/goal-pill_784349f2.png',
  goalCard:        '/manus-storage/goal-card_3c06c850.png',
  // HUD chips
  chipMoves:       '/manus-storage/chip-moves_74ecaa95.png',
  chipChain:       '/manus-storage/chip-chain_864e5f8b.png',
  chipScore:       '/manus-storage/chip-score_0e77272e.png',
  chipPause:       '/manus-storage/chip-pause_fab80519.png',
  chipCog:         '/manus-storage/chip-cog_fea69ce4.png',
  chipTimeAlert:   '/manus-storage/chip-time-alert_e23ed43a.png',
  chainTag:        '/manus-storage/chain-tag_c1385af6.png',
  // Boosters
  boosterUndo:     '/manus-storage/booster-undo_0e7fa853.png',
  boosterMoves:    '/manus-storage/booster-moves_a607edc5.png',
  boosterSolo:     '/manus-storage/booster-solo_240e6f3a.png',
  boosterBomb:     '/manus-storage/booster-bomb_5205d3f6.png',
  // Burst effects
  burstHearts:     '/manus-storage/vanish-burst-hearts_768f2efd.png',
  burstLeaves:     '/manus-storage/vanish-burst-leaves_49c2af02.png',
  // Buttons
  btnPrimary:      '/manus-storage/btn-primary_8172d026.png',
  btnGhost:        '/manus-storage/btn-ghost_39cb2f76.png',
};

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  cream:    '#FFF3E8',
  peach:    '#FFE6DB',
  peachMid: '#FFCFB3',
  accent:   '#E8745A',
  pink:     '#F4B8C8',
  butter:   '#F4DC78',
  sage:     '#A8C8A0',
  sky:      '#A8C8E8',
  lavender: '#C8B8E8',
  brown:    '#3A2A25',
  brownMid: '#7A5A48',
  brownLight: '#C8A888',
  platform: '#D4A878',
  platformDark: '#A87848',
  plaque:   '#C89858',
  plaqueDark: '#8A6838',
  bossNavy: '#1A1830',
  bossNavyMid: '#2A2848',
};

// ─── Cat image component ──────────────────────────────────────────────────────

function CatImg({ coat, size = 52 }: { coat: CoatId; size?: number }) {
  return (
    <img
      src={CAT_IMGS[coat]}
      alt={COAT_COLORS[coat].label}
      width={size}
      height={size}
      style={{ objectFit: 'contain', display: 'block', imageRendering: 'auto' }}
      draggable={false}
    />
  );
}

// ─── Pillar cap (top decorative arch) ────────────────────────────────────────

function PillarCap({ isBoss }: { isBoss: boolean }) {
  return (
    <div style={{
      width: '100%', height: 16,
      background: isBoss
        ? 'linear-gradient(180deg, #4A4870 0%, #3A3860 100%)'
        : `linear-gradient(180deg, ${C.platform} 0%, ${C.platformDark} 100%)`,
      borderRadius: '10px 10px 3px 3px',
      boxShadow: isBoss ? '0 2px 6px rgba(0,0,0,0.4)' : `0 2px 4px ${C.platformDark}88`,
    }} />
  );
}

// ─── Pillar base ──────────────────────────────────────────────────────────────

function PillarBase({ n, isBoss }: { n: number; isBoss: boolean }) {
  return (
    <div style={{
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0,
    }}>
      {/* Wide footing */}
      <div style={{
        width: '110%',
        height: 10,
        background: isBoss
          ? 'linear-gradient(180deg, #3A3860 0%, #2A2848 100%)'
          : `linear-gradient(180deg, ${C.platformDark} 0%, #8A5828 100%)`,
        borderRadius: '4px 4px 8px 8px',
        boxShadow: isBoss ? '0 3px 8px rgba(0,0,0,0.5)' : '0 3px 6px rgba(0,0,0,0.2)',
      }} />
      {/* N-grab badge using plaque PNG */}
      <div style={{
        marginTop: 4,
        position: 'relative',
        width: 44, height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <img src={A.plaque} alt="" width={44} height={28}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', opacity: isBoss ? 0.7 : 1 }}
          draggable={false}
        />
        <span style={{
          position: 'relative', zIndex: 1,
          fontFamily: 'Nunito, sans-serif',
          fontWeight: 900,
          fontSize: 14,
          color: '#FFF7E1',
          lineHeight: 1,
          textShadow: '0 1px 3px rgba(0,0,0,0.5)',
        }}>{n}</span>
      </div>
    </div>
  );
}

// ─── Tower / Container ────────────────────────────────────────────────────────

function TowerContainer({
  container, isSelected, hasChunk, onTap, isBoss,
}: {
  container: Container;
  isSelected: boolean;
  hasChunk: boolean;
  onTap: (e: React.MouseEvent) => void;
  isBoss: boolean;
}) {
  const isEmpty = container.stack.length === 0;
  const isFull = container.stack.length >= container.capacity;
  const canPlace = hasChunk && !container.oneWayOut;

  // Pick the tower background PNG based on state
  // Pick tower PNG by capacity — new assets cover 4-10, fall back to old for 2-3
  const towerBgImg = container.frozen
    ? A.towerFrozen
    : container.coatLocked
    ? A.towerLocked
    : isSelected
    ? A.towerSelected
    : (() => {
        const cap = container.capacity;
        if (cap >= 10) return A.tower10;
        if (cap === 9)  return A.tower9;
        if (cap === 8)  return A.tower8;
        if (cap === 7)  return A.tower7;
        if (cap === 6)  return A.tower6;
        if (cap === 5)  return A.tower5;
        if (cap === 4)  return A.tower4;
        // Fallback for capacity 2-3
        const hasStack = container.stack.length > 0;
        if (cap === 3) return hasStack ? A.towerN3Stacked : A.towerN3Empty;
        return hasStack ? A.towerN3Stacked : A.towerN2Empty;
      })();

  // Scale pillar height proportionally to capacity so taller towers have more room
  const BASE_H = 130; // height for capacity 4
  const PER_CAT = 28; // extra px per cat slot above 4
  const cap = container.capacity;

  const borderColor = isSelected
    ? C.accent
    : canPlace
    ? C.peachMid
    : 'transparent';

  // PILLAR_HEIGHT scales with capacity so taller towers have more room for cats
  const PILLAR_H = BASE_H + Math.max(0, cap - 4) * PER_CAT;
  // Cat size shrinks slightly for larger towers so they still fit
  const CAT_SIZE = cap <= 5 ? 48 : cap <= 7 ? 44 : cap <= 9 ? 40 : 36;

  return (
    <motion.div
      onClick={onTap}
      whileTap={{ scale: 0.96 }}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        width: 72,
      }}
    >
      {/* Special badges above pillar */}
      {container.frozen && (
        <div style={{ position: 'absolute', top: -18, left: 2, fontSize: 14, zIndex: 12 }}>❄️</div>
      )}
      {container.coatLocked && (
        <div style={{
          position: 'absolute', top: -18, right: 2, fontSize: 9, zIndex: 12,
          background: COAT_COLORS[container.coatLocked].body,
          borderRadius: 6, padding: '1px 4px',
          color: C.brown, fontWeight: 700, fontFamily: 'Nunito, sans-serif',
        }}>
          {COAT_COLORS[container.coatLocked].label}
        </div>
      )}

      {/* Pillar shaft — FIXED HEIGHT with PNG background */}
      <motion.div
        animate={
          isSelected
            ? { filter: 'drop-shadow(0 0 6px rgba(232,116,90,0.7))' }
            : canPlace
            ? { filter: 'drop-shadow(0 0 4px rgba(200,200,100,0.5))' }
            : { filter: 'none' }
        }
        style={{
          position: 'relative',
          width: '100%',
          height: PILLAR_H,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '4px 4px 6px',
          overflow: 'hidden',
          border: `2px solid ${borderColor}`,
          borderRadius: 6,
        }}
      >
        {/* Tower PNG background */}
        <img
          src={towerBgImg}
          alt=""
          draggable={false}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'fill',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* Cat stack — grows upward from bottom */}
        <div style={{
          position: 'relative', zIndex: 2,
          display: 'flex',
          flexDirection: 'column-reverse',
          alignItems: 'center',
          width: '100%',
          gap: 0,
        }}>
          <AnimatePresence>
            {container.stack.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ scale: 0.5, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.3, opacity: 0, y: -16 }}
                transition={{ type: 'spring', stiffness: 340, damping: 24, delay: idx * 0.015 }}
                style={{ display: 'flex', justifyContent: 'center', marginBottom: -10 }}
              >
                <CatImg coat={item.coat} size={CAT_SIZE} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Full indicator */}
        {isFull && (
          <div style={{
            position: 'absolute', top: 4, right: 4, zIndex: 3,
            width: 8, height: 8, borderRadius: '50%',
            background: '#E85A5A',
            boxShadow: '0 0 4px rgba(232,90,90,0.6)',
          }} />
        )}
      </motion.div>

      {/* Pillar base + N-badge */}
      <PillarBase n={container.grabNumber} isBoss={isBoss} />
    </motion.div>
  );
}

// ─── Floating chunk tray ──────────────────────────────────────────────────────

/**
 * FloatingChunk — cats cluster near the cursor/touch point and wiggle.
 * Follows pointermove / touchmove globally while a chunk is held.
 */
function FloatingChunk({ chunk }: { chunk: NonNullable<GameState['chunk']> }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const onPointer = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY });
    const onTouch = (e: TouchEvent) => {
      if (e.touches.length > 0) setPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    };
    window.addEventListener('pointermove', onPointer);
    window.addEventListener('touchmove', onTouch, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('touchmove', onTouch);
    };
  }, []);

  // Offset so the cluster appears above-left of the finger/cursor
  const offsetX = -28;
  const offsetY = -28;

  const x = pos ? pos.x + offsetX : window.innerWidth / 2;
  const y = pos ? pos.y + offsetY : 90;

  return (
    <motion.div
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.6, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 60,
        pointerEvents: 'none',
        display: 'flex',
        gap: chunk.items.length > 2 ? 2 : 4,
        alignItems: 'center',
        justifyContent: 'center',
        filter: 'drop-shadow(0 4px 12px rgba(232,116,90,0.45))',
      }}
    >
      {chunk.items.map((item, i) => (
        <motion.div
          key={item.id}
          animate={{
            y: [0, -5, 0, -3, 0],
            rotate: [0, i % 2 === 0 ? 6 : -6, 0, i % 2 === 0 ? 4 : -4, 0],
          }}
          transition={{
            repeat: Infinity,
            duration: 0.9 + i * 0.12,
            ease: 'easeInOut',
            delay: i * 0.08,
          }}
        >
          <CatImg coat={item.coat} size={46} />
        </motion.div>
      ))}
    </motion.div>
  );
}

// ─── Speech bubbles ───────────────────────────────────────────────────────────

function SpeechBubbleLayer({ bubbles }: { bubbles: SpeechBubble[] }) {
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 40 }}>
      <AnimatePresence>
        {bubbles.map(b => (
          <motion.div
            key={b.id}
            initial={{ opacity: 0, scale: 0.7, y: 0 }}
            animate={{ opacity: 1, scale: 1, y: -8 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            transition={{ duration: 0.3 }}
            style={{
              position: 'absolute',
              left: b.x,
              top: b.y,
              background: 'rgba(255,255,255,0.95)',
              border: `1.5px solid ${C.peachMid}`,
              borderRadius: 12,
              padding: '4px 10px',
              fontFamily: 'Caveat, cursive',
              fontSize: 15,
              color: C.brownMid,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          >
            {b.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── Particle layer ───────────────────────────────────────────────────────────

function ParticleLayer({ particles }: { particles: Particle[] }) {
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 45 }}>
      <AnimatePresence>
        {particles.map(p => (
          <motion.div
            key={p.id}
            initial={{ x: p.x, y: p.y, scale: 1, opacity: 1 }}
            animate={{ x: p.x + p.vx * 70, y: p.y + p.vy * 70, scale: 0, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.75, ease: 'easeOut' }}
            style={{ position: 'absolute', fontSize: p.size, lineHeight: 1 }}
          >
            {p.type === 'heart' ? '💗' : p.type === 'star' ? '✨' : p.type === 'leaf' ? '🍃' : '⭐'}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function spawnParticles(x: number, y: number, count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${Date.now()}${i}`,
    x, y,
    type: (['heart', 'star', 'sparkle', 'leaf'] as const)[i % 4],
    vx: (Math.random() - 0.5) * 3.5,
    vy: -(Math.random() * 2.5 + 0.5),
    size: 14 + Math.random() * 10,
  }));
}

function makeBubble(text: string, x: number, y: number): SpeechBubble {
  return { id: `b${Date.now()}${Math.random()}`, text, x, y, life: 1 };
}

// ─── HUD ──────────────────────────────────────────────────────────────────────

function HUD({ state, onPause, isBoss }: { state: GameState; onPause: () => void; isBoss: boolean }) {
  const cfg = state.levelConfig!;
  const goalEntries = Object.entries(state.goalProgress) as [CoatId, { cleared: number; total: number }][];
  const textColor = isBoss ? '#E8E0F0' : C.brown;
  const subColor = isBoss ? 'rgba(232,224,240,0.6)' : C.brownMid;
  const hudBg = isBoss
    ? 'rgba(26,24,48,0.95)'
    : 'rgba(255,243,232,0.97)';
  const hudBorder = isBoss ? 'rgba(255,255,255,0.1)' : C.peachMid;

  return (
    <div style={{
      width: '100%',
      background: hudBg,
      borderBottom: `1.5px solid ${hudBorder}`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      padding: '8px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      {/* Top row: pause | world+level | settings */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={onPause}
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'transparent',
            border: 'none', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <img src={A.chipPause} alt="Pause" width={36} height={36}
            draggable={false} style={{ objectFit: 'contain' }}
          />
        </button>
        <div style={{
          fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 13,
          color: isBoss ? C.butter : C.brownMid, letterSpacing: 1,
          textAlign: 'center',
        }}>
          {isBoss ? '★ BOSS · ' : `WORLD ${cfg.world} · `}LEVEL {cfg.id}
        </div>
        <div style={{ width: 32 }} />
      </div>

      {/* Goal strip */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: isBoss ? 'rgba(255,255,255,0.06)' : C.peach,
        borderRadius: 12, padding: '5px 10px',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: subColor, fontFamily: 'Nunito, sans-serif', letterSpacing: 0.8 }}>
            GOAL · MERGE &#123; K = {cfg.mergeSizeK} &#125;
          </div>
          <div style={{ fontSize: 13, fontFamily: 'Caveat, cursive', color: textColor, marginTop: 1 }}>
            {cfg.description}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {goalEntries.map(([coat, prog]) => (
            <div key={coat} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              {/* Goal pill PNG background */}
              <div style={{ position: 'relative', width: 44, height: 44 }}>
                <img src={A.goalPill} alt="" draggable={false}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill',
                    opacity: prog.cleared >= prog.total ? 0.5 : 1 }}
                />
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <img
                    src={KITTEN_IMGS[coat]}
                    alt={coat}
                    width={30} height={30}
                    draggable={false}
                    style={{ objectFit: 'contain' }}
                  />
                </div>
              </div>
              <div style={{
                fontSize: 11, fontWeight: 800, fontFamily: 'Nunito, sans-serif',
                color: prog.cleared >= prog.total ? C.sage : textColor,
              }}>
                {prog.cleared}/{prog.total}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {/* Moves chip */}
        <div style={{ position: 'relative', flex: 1, height: 40 }}>
          <img src={state.budget.movesLeft <= 5 ? A.chipTimeAlert : A.chipMoves} alt=""
            draggable={false}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }}
          />
          <div style={{
            position: 'relative', zIndex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', gap: 3,
          }}>
            <span style={{
              fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 17,
              color: state.budget.movesLeft <= 5 ? '#E85A5A' : textColor,
            }}>{state.budget.movesLeft}</span>
            <span style={{ fontSize: 9, color: subColor, fontFamily: 'Nunito, sans-serif' }}>moves</span>
          </div>
        </div>
        {/* Chain chip */}
        <div style={{ position: 'relative', flex: 1, height: 40 }}>
          <img src={A.chipChain} alt=""
            draggable={false}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }}
          />
          <div style={{
            position: 'relative', zIndex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', gap: 3,
          }}>
            <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 17, color: textColor }}>
              ×{state.chainLength}
            </span>
            <span style={{ fontSize: 9, color: subColor, fontFamily: 'Nunito, sans-serif' }}>chain</span>
          </div>
        </div>
        {/* Score chip */}
        <div style={{ position: 'relative', flex: 1, height: 40 }}>
          <img src={A.chipScore} alt=""
            draggable={false}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }}
          />
          <div style={{
            position: 'relative', zIndex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%',
          }}>
            <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 14, color: textColor }}>
              {state.score.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Boss spawn trigger notice */}
      {isBoss && (
        <div style={{
          fontSize: 10, fontFamily: 'Nunito, sans-serif', fontWeight: 700,
          color: 'rgba(244,220,120,0.9)', textAlign: 'center', letterSpacing: 0.8,
        }}>
          SPAWN TRIGGER · EVERY 3 MOVES
        </div>
      )}
    </div>
  );
}

// ─── Booster bar ──────────────────────────────────────────────────────────────

function BoosterBar({
  onUndo, onAddMoves, onSoloGrab, onColorBomb, hasChunk, isBoss, undoAvailable,
}: {
  onUndo: () => void;
  onAddMoves: () => void;
  onSoloGrab: () => void;
  onColorBomb: () => void;
  hasChunk: boolean;
  isBoss: boolean;
  undoAvailable: boolean;
}) {
  const bg = isBoss ? 'rgba(26,24,48,0.97)' : 'rgba(255,243,232,0.97)';
  const border = isBoss ? 'rgba(255,255,255,0.1)' : C.peachMid;
  const btnBg = isBoss ? 'rgba(255,255,255,0.08)' : C.cream;
  const btnBorder = isBoss ? 'rgba(255,255,255,0.15)' : C.peachMid;
  const textColor = isBoss ? '#E8E0F0' : C.brown;

  const boosters = [
    { img: A.boosterUndo,  label: 'Undo',       onClick: onUndo,       disabled: !undoAvailable || hasChunk },
    { img: A.boosterMoves, label: '+5 moves',   onClick: onAddMoves,   disabled: false },
    { img: A.boosterSolo,  label: 'Solo grab',  onClick: onSoloGrab,   disabled: hasChunk },
    { img: A.boosterBomb,  label: 'Color bomb', onClick: onColorBomb,  disabled: hasChunk },
  ];

  return (
    <div style={{
      width: '100%',
      background: bg,
      borderTop: `1.5px solid ${border}`,
      padding: '8px 12px max(10px, env(safe-area-inset-bottom, 10px))',
      display: 'flex',
      gap: 8,
      flexShrink: 0,
    }}>
      {boosters.map(b => (
        <motion.button
          key={b.label}
          whileTap={{ scale: 0.93 }}
          onClick={b.onClick}
          disabled={b.disabled}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            background: btnBg,
            border: `1.5px solid ${btnBorder}`,
            borderRadius: 14,
            padding: '6px 4px',
            cursor: b.disabled ? 'not-allowed' : 'pointer',
            opacity: b.disabled ? 0.4 : 1,
          }}
        >
          <img src={b.img} alt={b.label} width={36} height={36}
            draggable={false}
            style={{ objectFit: 'contain' }}
          />
          <span style={{
            fontSize: 9, fontFamily: 'Nunito, sans-serif', fontWeight: 700,
            color: textColor, textAlign: 'center', lineHeight: 1.2,
          }}>{b.label}</span>
        </motion.button>
      ))}
      {hasChunk && (
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={() => {}} // cancel handled by game logic
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            background: `${C.accent}22`,
            border: `1.5px solid ${C.accent}`,
            borderRadius: 14,
            padding: '6px 4px',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 18 }}>✕</span>
          <span style={{
            fontSize: 9, fontFamily: 'Nunito, sans-serif', fontWeight: 700,
            color: C.accent, textAlign: 'center',
          }}>Cancel</span>
        </motion.button>
      )}
    </div>
  );
}

// ─── Chain banner ─────────────────────────────────────────────────────────────

function ChainBanner({ chain, isBoss }: { chain: number; isBoss: boolean }) {
  if (chain < 2) return null;
  return (
    <AnimatePresence>
      <motion.div
        key={chain}
        initial={{ scale: 0.5, opacity: 0, y: 10 }}
        animate={{ scale: 1.05, opacity: 1, y: 0 }}
        exit={{ scale: 1.3, opacity: 0, y: -10 }}
        transition={{ duration: 0.35 }}
        style={{
          position: 'fixed', top: '42%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 55, pointerEvents: 'none', textAlign: 'center',
        }}
      >
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 180, height: 72 }}>
          <img src={A.chainTag} alt="" draggable={false}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }}
          />
          <span style={{
            position: 'relative', zIndex: 1,
            fontFamily: 'Nunito, sans-serif', fontWeight: 900,
            fontSize: 32,
            color: isBoss ? C.butter : C.accent,
            textShadow: isBoss
              ? `0 2px 8px rgba(244,220,120,0.6)`
              : `0 2px 8px rgba(232,116,90,0.5)`,
          }}>CHAIN ×{chain}</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Game message toast ───────────────────────────────────────────────────────

function GameMessage({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key={message}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          style={{
            position: 'fixed', bottom: 120, left: '50%', transform: 'translateX(-50%)',
            zIndex: 60, pointerEvents: 'none',
            background: 'rgba(232,116,90,0.95)',
            color: '#fff', borderRadius: 16,
            padding: '8px 18px',
            fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13,
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            whiteSpace: 'nowrap',
          }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Level complete overlay ───────────────────────────────────────────────────

function LevelCompleteOverlay({ state, onNext, onReplay, onMenu }: {
  state: GameState; onNext: () => void; onReplay: () => void; onMenu: () => void;
}) {
  const hasNext = state.currentLevelIndex < LEVELS.length - 1;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 70,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,230,219,0.88)', backdropFilter: 'blur(6px)',
      }}
    >
      <motion.div
        initial={{ scale: 0.8, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        style={{
          width: 300, borderRadius: 28,
          background: C.cream,
          border: `2px solid ${C.peachMid}`,
          boxShadow: '0 8px 40px rgba(232,116,90,0.25)',
          padding: '28px 24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        }}
      >
        {/* Cat parade */}
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
          {(['ginger', 'white', 'tabby'] as CoatId[]).map(c => (
            <motion.div
              key={c}
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 0.8, delay: ['ginger','white','tabby'].indexOf(c) * 0.2 }}
            >
              <CatImg coat={c} size={44} />
            </motion.div>
          ))}
        </div>

        <div style={{ fontFamily: 'Caveat, cursive', fontSize: 36, color: C.brown, textAlign: 'center', lineHeight: 1.1 }}>
          Naptime!
        </div>
        <div style={{ fontSize: 12, color: C.brownMid, fontFamily: 'Nunito, sans-serif', textAlign: 'center' }}>
          All {state.levelConfig?.goalCoats.map(c => COAT_COLORS[c].label).join(' & ')} kittens are home and purring.
        </div>

        {/* Stars */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          {[1, 2, 3].map(s => (
            <motion.div
              key={s}
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: state.stars >= s ? 1.1 : 0.65, rotate: 0 }}
              transition={{ delay: s * 0.18, type: 'spring' }}
            >
              <img
                src={state.stars >= s ? A.starOnBig : A.starOff}
                alt={state.stars >= s ? 'star' : 'empty star'}
                width={s === 2 ? 52 : 40} height={s === 2 ? 52 : 40}
                draggable={false}
                style={{ objectFit: 'contain', opacity: state.stars >= s ? 1 : 0.35 }}
              />
            </motion.div>
          ))}
        </div>

        {/* Stats */}
        <div style={{
          width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: 8, textAlign: 'center',
        }}>
          {[
            { label: 'Score', value: state.score.toLocaleString() },
            { label: 'Moves left', value: `${state.budget.movesLeft} / ${state.levelConfig?.budget.maxMoves}` },
            { label: 'Best chain', value: `×${state.bestChain}` },
          ].map(s => (
            <div key={s.label} style={{
              background: C.peach, borderRadius: 12, padding: '6px 4px',
            }}>
              <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'Nunito, sans-serif', color: C.brown }}>{s.value}</div>
              <div style={{ fontSize: 9, color: C.brownMid, fontFamily: 'Nunito, sans-serif' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {hasNext && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onNext}
              style={{
                width: '100%', padding: '13px', borderRadius: 20,
                background: `linear-gradient(135deg, ${C.accent}, #C85040)`,
                color: '#fff', fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 16,
                border: 'none', cursor: 'pointer',
                boxShadow: `0 4px 16px rgba(232,116,90,0.4)`,
              }}
            >
              Next level →
            </motion.button>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <motion.button whileTap={{ scale: 0.96 }} onClick={onReplay} style={{
              flex: 1, padding: '10px', borderRadius: 16,
              background: C.peach, color: C.brownMid,
              fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13,
              border: `1.5px solid ${C.peachMid}`, cursor: 'pointer',
            }}>Replay</motion.button>
            <motion.button whileTap={{ scale: 0.96 }} onClick={onMenu} style={{
              flex: 1, padding: '10px', borderRadius: 16,
              background: C.peach, color: C.brownMid,
              fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13,
              border: `1.5px solid ${C.peachMid}`, cursor: 'pointer',
            }}>World Map</motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Level fail overlay ───────────────────────────────────────────────────────

function LevelFailOverlay({ onReplay, onMenu }: { onReplay: () => void; onMenu: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 70,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(200,140,120,0.75)', backdropFilter: 'blur(6px)',
      }}
    >
      <motion.div
        initial={{ scale: 0.8, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        style={{
          width: 280, borderRadius: 28,
          background: C.cream,
          border: `2px solid ${C.peachMid}`,
          boxShadow: '0 8px 32px rgba(200,100,80,0.2)',
          padding: '28px 24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        }}
      >
        <div style={{ fontSize: 56 }}>😿</div>
        <div style={{ fontFamily: 'Caveat, cursive', fontSize: 30, color: C.brown }}>Out of moves!</div>
        <div style={{ fontSize: 12, color: C.brownMid, fontFamily: 'Nunito, sans-serif', textAlign: 'center' }}>
          The kittens are still mixed up... try again!
        </div>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <motion.button whileTap={{ scale: 0.96 }} onClick={onReplay} style={{
            width: '100%', padding: '13px', borderRadius: 20,
            background: `linear-gradient(135deg, ${C.accent}, #C85040)`,
            color: '#fff', fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 16,
            border: 'none', cursor: 'pointer',
          }}>Try Again</motion.button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={onMenu} style={{
            width: '100%', padding: '10px', borderRadius: 16,
            background: C.peach, color: C.brownMid,
            fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13,
            border: `1.5px solid ${C.peachMid}`, cursor: 'pointer',
          }}>World Map</motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Pause overlay ────────────────────────────────────────────────────────────

function PauseOverlay({ onResume, onMenu, isBoss }: { onResume: () => void; onMenu: () => void; isBoss: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 70,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isBoss ? 'rgba(10,8,30,0.85)' : 'rgba(255,230,219,0.85)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        style={{
          width: 260, borderRadius: 28,
          background: isBoss ? C.bossNavy : C.cream,
          border: `2px solid ${isBoss ? 'rgba(255,255,255,0.15)' : C.peachMid}`,
          padding: '28px 24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        }}
      >
        <div style={{ fontSize: 44 }}>⏸</div>
        <div style={{ fontFamily: 'Caveat, cursive', fontSize: 30, color: isBoss ? '#E8E0F0' : C.brown }}>Paused</div>
        <motion.button whileTap={{ scale: 0.96 }} onClick={onResume} style={{
          width: '100%', padding: '13px', borderRadius: 20,
          background: `linear-gradient(135deg, ${C.accent}, #C85040)`,
          color: '#fff', fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 16,
          border: 'none', cursor: 'pointer',
        }}>Resume</motion.button>
        <motion.button whileTap={{ scale: 0.96 }} onClick={onMenu} style={{
          width: '100%', padding: '10px', borderRadius: 16,
          background: isBoss ? 'rgba(255,255,255,0.08)' : C.peach,
          color: isBoss ? '#E8E0F0' : C.brownMid,
          fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13,
          border: `1.5px solid ${isBoss ? 'rgba(255,255,255,0.15)' : C.peachMid}`,
          cursor: 'pointer',
        }}>World Map</motion.button>
      </motion.div>
    </motion.div>
  );
}

// ─── World map screen ─────────────────────────────────────────────────────────

function WorldMap({ onSelect, completedLevels, onBack }: {
  onSelect: (idx: number) => void;
  completedLevels: Record<number, number>;
  onBack: () => void;
}) {
  const totalCleared = Object.values(completedLevels).reduce((a, b) => a + b, 0);
  const nextIdx = LEVELS.findIndex(l => !(completedLevels[l.id] >= 1));
  const nextLevel = nextIdx >= 0 ? LEVELS[nextIdx] : null;

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(180deg, ${C.peach} 0%, ${C.cream} 100%)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      overflowY: 'auto',
    }}>
      <div style={{ width: '100%', maxWidth: 420, padding: '0 0 40px' }}>
        {/* Map banner */}
        <div style={{ position: 'relative', width: '100%' }}>
          <img src={A.mapBanner} alt="World 1" draggable={false}
            style={{ width: '100%', display: 'block', maxHeight: 120, objectFit: 'cover' }}
          />
          <motion.button whileTap={{ scale: 0.95 }} onClick={onBack} style={{
            position: 'absolute', top: 10, left: 12,
            background: 'rgba(255,243,232,0.9)', border: `1.5px solid ${C.peachMid}`,
            borderRadius: 12, padding: '4px 12px',
            fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 12,
            color: C.brownMid, cursor: 'pointer',
          }}>← Back</motion.button>
          {/* Progress bar overlay */}
          <div style={{
            position: 'absolute', bottom: 8, left: 12, right: 12,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.4)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4,
                background: `linear-gradient(90deg, ${C.accent}, ${C.pink})`,
                width: `${Math.min(100, (Object.keys(completedLevels).length / LEVELS.length) * 100)}%`,
                transition: 'width 0.5s ease',
              }} />
            </div>
            <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 12, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
              {Object.keys(completedLevels).length}/{LEVELS.length}
            </div>
          </div>
        </div>

        {/* Up next card */}
        {nextLevel && (
          <div style={{ margin: '16px 16px 0', padding: '12px 14px', background: 'rgba(255,255,255,0.7)', borderRadius: 18, border: `1.5px solid ${C.peachMid}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, fontFamily: 'Nunito, sans-serif', letterSpacing: 0.8 }}>UP NEXT · LEVEL {nextLevel.id}</div>
            <div style={{ fontFamily: 'Caveat, cursive', fontSize: 20, color: C.brown, marginTop: 2 }}>{nextLevel.name}</div>
            <div style={{ fontSize: 11, color: C.brownMid, fontFamily: 'Nunito, sans-serif', marginTop: 2 }}>
              merge×{nextLevel.mergeSizeK} · {nextLevel.budget.maxMoves} moves · {nextLevel.goalCoats.map(c => COAT_COLORS[c].label).join(' & ')} cats
            </div>
          </div>
        )}

        {/* Level grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12, padding: '16px',
        }}>
          {LEVELS.map((level, idx) => {
            const stars = completedLevels[level.id] ?? 0;
            const locked = idx > 0 && !(completedLevels[LEVELS[idx - 1].id] >= 1);
            const isNext = !locked && stars === 0;

            return (
              <motion.button
                key={level.id}
                whileTap={{ scale: 0.94 }}
                onClick={() => !locked && onSelect(idx)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  background: locked
                    ? 'rgba(200,180,160,0.3)'
                    : level.isBoss
                    ? 'rgba(232,116,90,0.15)'
                    : isNext
                    ? 'rgba(255,255,255,0.9)'
                    : 'rgba(255,243,232,0.8)',
                  border: level.isBoss
                    ? `2px solid ${C.accent}`
                    : isNext
                    ? `2px solid ${C.accent}`
                    : `1.5px solid ${C.peachMid}`,
                  borderRadius: 18,
                  padding: '12px 8px',
                  cursor: locked ? 'not-allowed' : 'pointer',
                  opacity: locked ? 0.5 : 1,
                  boxShadow: isNext ? `0 4px 16px rgba(232,116,90,0.2)` : 'none',
                }}
              >
                {/* Map node PNG */}
                <div style={{ position: 'relative', width: 64, height: 64 }}>
                  <img
                    src={
                      locked ? A.mapNodeLocked
                      : level.isBoss ? A.mapNodeBoss
                      : stars >= 3 ? A.mapNodeDone3
                      : stars >= 1 ? A.mapNodeDone1
                      : A.mapNodeCurrent
                    }
                    alt=""
                    draggable={false}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                  {/* Level number overlay */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 18,
                    color: locked ? 'rgba(255,255,255,0.5)' : '#fff',
                    textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                  }}>{level.id}</div>
                </div>

                {/* Stars */}
                <div style={{ display: 'flex', gap: 2 }}>
                  {[1, 2, 3].map(s => (
                    <img key={s} src={stars >= s ? A.starOn : A.starOff} alt=""
                      width={14} height={14} draggable={false}
                      style={{ objectFit: 'contain' }}
                    />
                  ))}
                </div>

                {/* Level name */}
                <div style={{
                  fontSize: 9, fontFamily: 'Caveat, cursive', color: C.brownMid,
                  textAlign: 'center', lineHeight: 1.2,
                }}>{level.name}</div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Title screen ─────────────────────────────────────────────────────────────

function TitleScreen({ onPlay }: { onPlay: () => void }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(180deg, ${C.peach} 0%, ${C.cream} 60%, ${C.peach} 100%)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '0 24px',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: '100%', maxWidth: 340 }}
      >
        {/* Cat parade */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          {(['ginger', 'white', 'black', 'tabby', 'calico', 'siamese'] as CoatId[]).map((c, i) => (
            <motion.div
              key={c}
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.18, ease: 'easeInOut' }}
            >
              <CatImg coat={c} size={46} />
            </motion.div>
          ))}
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 48,
            color: C.brown,
            textShadow: `0 3px 12px rgba(232,116,90,0.25)`,
            lineHeight: 1,
          }}>CatSort</div>
          <div style={{
            fontFamily: 'Caveat, cursive', fontSize: 20,
            color: C.brownMid, marginTop: 4,
          }}>Stack · Sort · Vanish!</div>
        </div>

        {/* Wooden tower preview */}
        <div style={{
          display: 'flex', gap: 12, alignItems: 'flex-end',
          background: 'rgba(255,255,255,0.6)',
          borderRadius: 24, padding: '16px 20px',
          border: `1.5px solid ${C.peachMid}`,
        }}>
          {[
            { coat: 'ginger' as CoatId, n: 2 },
            { coat: 'white' as CoatId, n: 3 },
            { coat: 'tabby' as CoatId, n: 2 },
          ].map(({ coat, n }) => (
            <div key={coat} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              <div style={{ position: 'relative' }}>
                <CatImg coat={coat} size={44} />
                <CatImg coat={coat} size={44} />
                <div style={{
                  position: 'absolute', right: -14, top: '20%',
                  width: 22, height: 26,
                  background: `linear-gradient(180deg, ${C.plaque} 0%, ${C.plaqueDark} 100%)`,
                  borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}>
                  <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 13, color: '#FFF7E1' }}>{n}</span>
                </div>
              </div>
              <div style={{
                width: '110%', height: 8,
                background: `linear-gradient(180deg, ${C.platformDark} 0%, #8A5828 100%)`,
                borderRadius: '4px 4px 8px 8px',
                boxShadow: '0 3px 6px rgba(0,0,0,0.18)',
                marginTop: 2,
              }} />
            </div>
          ))}
        </div>

        {/* How to play */}
        <div style={{
          width: '100%', background: 'rgba(255,255,255,0.7)',
          borderRadius: 18, padding: '12px 16px',
          border: `1.5px solid ${C.peachMid}`,
        }}>
          <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 13, color: C.brown, marginBottom: 6 }}>How to Play</div>
          {[
            '1. Tap a tower to grab its top N cats',
            '2. Tap another tower to place them',
            '3. K+ same-coat cats in a row vanish!',
            '4. Clear all goal-coat cats to win 🐾',
          ].map(t => (
            <div key={t} style={{ fontFamily: 'Caveat, cursive', fontSize: 15, color: C.brownMid, lineHeight: 1.7 }}>{t}</div>
          ))}
        </div>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onPlay}
          style={{
            width: '100%', padding: '16px',
            borderRadius: 24,
            background: `linear-gradient(135deg, ${C.accent}, #C85040)`,
            color: '#fff',
            fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 20,
            border: 'none', cursor: 'pointer',
            boxShadow: `0 6px 24px rgba(232,116,90,0.45)`,
          }}
        >
          Play Now! 🐾
        </motion.button>
      </motion.div>
    </div>
  );
}

// ─── Game board ───────────────────────────────────────────────────────────────

function GameBoard({ state, onTap, onPause, onUndo, onAddMoves, undoAvailable }: {
  state: GameState;
  onTap: (containerId: string, e: React.MouseEvent) => void;
  onPause: () => void;
  onUndo: () => void;
  onAddMoves: () => void;
  undoAvailable: boolean;
}) {
  const cfg = state.levelConfig!;
  const isBoss = cfg.isBoss;
  const hasChunk = !!state.chunk;

  const bgStyle = isBoss
    ? { background: `linear-gradient(180deg, ${C.bossNavy} 0%, ${C.bossNavyMid} 100%)` }
    : { background: `linear-gradient(180deg, ${C.peach} 0%, #FFD4C0 40%, ${C.cream} 100%)` };

  return (
    <div style={{
      height: '100dvh', maxWidth: 480, margin: '0 auto',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      ...bgStyle,
    }}>
      <HUD state={state} onPause={onPause} isBoss={isBoss} />

      {/* Tower area — vertically centered */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '8px 8px 8px',
        overflowY: 'auto',
      }}>
        <div style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
          gap: 14, width: '100%', maxWidth: 440,
          alignItems: 'flex-end',
        }}>
          {state.containers.map(container => (
            <TowerContainer
              key={container.id}
              container={container}
              isSelected={state.selectedContainerId === container.id}
              hasChunk={hasChunk}
              onTap={(e: React.MouseEvent) => onTap(container.id, e)}
              isBoss={isBoss}
            />
          ))}
        </div>
      </div>

      {/* Booster bar */}
      <BoosterBar
        onUndo={onUndo}
        onAddMoves={onAddMoves}
        onSoloGrab={() => {}}
        onColorBomb={() => {}}
        hasChunk={hasChunk}
        isBoss={isBoss}
        undoAvailable={undoAvailable}
      />
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [screen, setScreen] = useState<'title' | 'worldMap' | 'playing' | 'paused'>('title');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [completedLevels, setCompletedLevels] = useState<Record<number, number>>({});
  const [showChain, setShowChain] = useState(0);
  const [prevState, setPrevState] = useState<GameState | null>(null); // for undo

  const chainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-clear message
  useEffect(() => {
    if (gameState?.message) {
      if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
      msgTimerRef.current = setTimeout(() => {
        setGameState(prev => prev ? { ...prev, message: null } : prev);
      }, 1800);
    }
  }, [gameState?.message]);

  // Auto-clear speech bubbles
  useEffect(() => {
    if (gameState?.speechBubbles.length) {
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
      bubbleTimerRef.current = setTimeout(() => {
        setGameState(prev => prev ? { ...prev, speechBubbles: [] } : prev);
      }, 1400);
    }
  }, [gameState?.speechBubbles]);

  // Auto-clear particles
  useEffect(() => {
    if (gameState?.particles.length) {
      const t = setTimeout(() => {
        setGameState(prev => prev ? { ...prev, particles: [] } : prev);
      }, 900);
      return () => clearTimeout(t);
    }
  }, [gameState?.particles]);

  const startLevel = useCallback((idx: number) => {
    const cfg = LEVELS[idx];
    const state = initLevelState(cfg, idx);
    setGameState(state);
    setPrevState(null);
    setScreen('playing');
  }, []);

  const handleUndo = useCallback(() => {
    if (prevState) {
      setGameState(prevState);
      setPrevState(null);
    }
  }, [prevState]);

  const handleAddMoves = useCallback(() => {
    setGameState(prev => prev ? {
      ...prev,
      budget: { ...prev.budget, movesLeft: prev.budget.movesLeft + 5 },
      message: '+5 moves added!',
    } : prev);
  }, []);

  const handleTap = useCallback((containerId: string, event: React.MouseEvent) => {
    if (!gameState || gameState.phase !== 'playing') return;

    if (!gameState.chunk) {
      // Grab phase
      const next = grabChunk(gameState, containerId);
      if (next.chunk) {
        // Show "mrow ~" bubble near click
        const bubble = makeBubble('mrow ~', (event.clientX ?? 160) - 30, (event.clientY ?? 300) - 50);
        setGameState({ ...next, speechBubbles: [bubble] });
      } else {
        setGameState(next);
      }
    } else {
      // Place phase
      // Tapping the source container → free cancel (no move cost)
      if (containerId === gameState.chunk.sourceContainerId) {
        setGameState(cancelGrab(gameState));
        return;
      }

      const savedState = gameState;
      const result = placeChunk(gameState, containerId);

      if (!result.success) {
        // Invalid placement → free cancel, show error message briefly
        const cancelled = cancelGrab(gameState);
        setGameState({ ...cancelled, message: result.error ?? 'Cannot place here!' });
        return;
      }

      // Save for undo
      setPrevState(savedState);

      // Particles + speech bubbles
      const particles = result.vanishResults.length > 0
        ? spawnParticles(event.clientX ?? 200, event.clientY ?? 350, result.vanishResults.length * 5)
        : [];

      const bubbles: SpeechBubble[] = [];
      if (result.vanishResults.length > 0) {
        bubbles.push(makeBubble('purr ♥', (event.clientX ?? 160) - 20, (event.clientY ?? 300) - 60));
      }

      // Chain
      const chain = result.vanishResults.length;
      if (chain >= 2) {
        setShowChain(chain);
        if (chainTimerRef.current) clearTimeout(chainTimerRef.current);
        chainTimerRef.current = setTimeout(() => setShowChain(0), 1200);
      }

      setGameState({ ...result.newState, particles, speechBubbles: bubbles });

      if (result.won && gameState.levelConfig) {
        const levelId = gameState.levelConfig.id;
        setCompletedLevels(prev => ({
          ...prev,
          [levelId]: Math.max(prev[levelId] ?? 0, result.newState.stars),
        }));
      }
    }
  }, [gameState]);

  // ── Title ──
  if (screen === 'title') {
    return <TitleScreen onPlay={() => setScreen('worldMap')} />;
  }

  // ── World map ──
  if (screen === 'worldMap') {
    return (
      <WorldMap
        onSelect={startLevel}
        completedLevels={completedLevels}
        onBack={() => setScreen('title')}
      />
    );
  }

  // ── Playing ──
  if (!gameState) return null;

  const isBoss = gameState.levelConfig?.isBoss ?? false;

  return (
    <div style={{ height: '100dvh', overflow: 'hidden' }}>
      <GameBoard
        state={gameState}
        onTap={handleTap}
        onPause={() => setScreen('paused')}
        onUndo={handleUndo}
        onAddMoves={handleAddMoves}
        undoAvailable={!!prevState}
      />

      <AnimatePresence>
        {gameState.chunk && <FloatingChunk chunk={gameState.chunk} />}
      </AnimatePresence>

      <SpeechBubbleLayer bubbles={gameState.speechBubbles} />
      <ParticleLayer particles={gameState.particles} />
      <GameMessage message={gameState.message} />
      <ChainBanner chain={showChain} isBoss={isBoss} />

      <AnimatePresence>
        {gameState.phase === 'levelComplete' && (
          <LevelCompleteOverlay
            state={gameState}
            onNext={() => startLevel(gameState.currentLevelIndex + 1)}
            onReplay={() => startLevel(gameState.currentLevelIndex)}
            onMenu={() => setScreen('worldMap')}
          />
        )}
        {gameState.phase === 'levelFail' && (
          <LevelFailOverlay
            onReplay={() => startLevel(gameState.currentLevelIndex)}
            onMenu={() => setScreen('worldMap')}
          />
        )}
        {screen === 'paused' && (
          <PauseOverlay
            onResume={() => setScreen('playing')}
            onMenu={() => setScreen('worldMap')}
            isBoss={isBoss}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
