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
  type VanishStep,
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

// ─── Bed images for tower bases ───────────────────────────────────────────────

const BED_IMGS = [
  '/manus-storage/bed-basket_ad0f8354.png',
  '/manus-storage/bed-cloud_3ec0a9b1.png',
  '/manus-storage/bed-cushion_844d0e39.png',
  '/manus-storage/bed-donut_d412fb1f.png',
  '/manus-storage/bed-box_5e2246b7.png',
];

function getBedImg(containerIndex: number): string {
  return BED_IMGS[containerIndex % BED_IMGS.length];
}

// ─── Tower / Container ────────────────────────────────────────────────────────

function TowerContainer({
  container, containerIndex, isSelected, hasChunk, onTap, isBoss, vanishHighlightIds,
}: {
  container: Container;
  containerIndex: number;
  isSelected: boolean;
  hasChunk: boolean;
  onTap: (e: React.MouseEvent, towerCenterX: number, towerCenterY: number) => void;
  isBoss: boolean;
  vanishHighlightIds?: Set<string>;
}) {
  const isEmpty = container.stack.length === 0;
  const canPlace = hasChunk && !container.oneWayOut;
  const towerRef = useRef<HTMLDivElement>(null);

  // Cat size — fixed at 44px for up to 10 cats
  const CAT_SIZE = 44;
  // Invisible shaft height — tall enough for 10 cats
  const SHAFT_H = 320;

  const bedImg = getBedImg(containerIndex);

  const handleClick = (e: React.MouseEvent) => {
    // Compute the vertical centre of the cat stack for heart spawn origin
    const rect = towerRef.current?.getBoundingClientRect();
    const cx = rect ? rect.left + rect.width / 2 : e.clientX;
    // Aim at the lower-middle of the shaft where cats live
    const cy = rect ? rect.top + rect.height * 0.55 : e.clientY;
    onTap(e, cx, cy);
  };

  return (
    <motion.div
      ref={towerRef}
      onClick={handleClick}
      whileTap={{ scale: 0.96 }}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        width: 76,
      }}
    >
      {/* Special badges */}
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

      {/* Invisible shaft — keeps click area + stacks cats above bed */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: SHAFT_H,
          // Fully transparent — no background, no border
          background: 'transparent',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingBottom: 4,
        }}
      >


        {/* Cat stack — grows upward from bottom of shaft */}
        <div style={{
          display: 'flex',
          flexDirection: 'column-reverse',
          alignItems: 'center',
          width: '100%',
          gap: 0,
          position: 'relative',
          zIndex: 2,
        }}>
          <AnimatePresence>
            {container.stack.map((item, idx) => {
              const isVanishing = vanishHighlightIds?.has(item.id) ?? false;
              return (
                <motion.div
                  key={item.id}
                  initial={{ scale: 0.5, opacity: 0, y: 20 }}
                  animate={isVanishing
                    ? { scale: [1, 1.3, 0], opacity: [1, 1, 0], y: [0, -10, -10] }
                    : { scale: 1, opacity: 1, y: 0 }
                  }
                  exit={{ scale: 0.3, opacity: 0, y: -16 }}
                  transition={isVanishing
                    ? { duration: 0.45, ease: [0.22, 1, 0.36, 1] }
                    : { type: 'spring', stiffness: 340, damping: 24, delay: idx * 0.015 }
                  }
                  style={{
                    display: 'flex', justifyContent: 'center', marginBottom: -10,
                    filter: isVanishing
                      ? `drop-shadow(0 0 10px ${COAT_COLORS[item.coat].body}) brightness(1.3)`
                      : 'none',
                    zIndex: isVanishing ? 5 : 'auto',
                    position: 'relative',
                  }}
                >
                  <CatImg coat={item.coat} size={CAT_SIZE} />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Empty state hint */}
        {isEmpty && (
          <div style={{
            position: 'absolute',
            bottom: 48,
            left: 0, right: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            opacity: 0.35,
            pointerEvents: 'none',
            zIndex: 2,
          }}>
            <span style={{ fontSize: 18 }}>🐾</span>
          </div>
        )}
      </div>

      {/* Bed image at the base */}
      <div style={{
        position: 'relative',
        width: 80,
        marginTop: -6,
        zIndex: 3,
        filter: isSelected
          ? `drop-shadow(0 0 6px ${C.accent})`
          : canPlace
          ? `drop-shadow(0 0 4px ${C.peachMid})`
          : 'none',
      }}>
        <img
          src={bedImg}
          alt="cat bed"
          width={80}
          height={48}
          style={{ objectFit: 'contain', display: 'block' }}
          draggable={false}
        />
        {/* N-grab badge on the bed */}
        <div style={{
          position: 'absolute',
          bottom: -4,
          right: -4,
          width: 22, height: 22,
          background: isBoss
            ? 'linear-gradient(180deg, #6A68A8 0%, #4A4888 100%)'
            : `linear-gradient(180deg, ${C.plaque} 0%, ${C.plaqueDark} 100%)`,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          border: `1.5px solid rgba(255,255,255,0.5)`,
          zIndex: 4,
        }}>
          <span style={{
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 900,
            fontSize: 12,
            color: '#FFF7E1',
            lineHeight: 1,
          }}>{container.grabNumber}</span>
        </div>
      </div>
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
            initial={{ x: p.x, y: p.y, scale: 0.5, opacity: 0 }}
            animate={{
              x: p.x + p.vx * 50,
              y: p.y + p.vy * 50,
              scale: [0.5, 1.0, 0.7, 0],
              opacity: [0, 1, 1, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 1.6,
              ease: 'easeOut',
              opacity: { times: [0, 0.12, 0.65, 1] },
              scale: { times: [0, 0.12, 0.6, 1] },
            }}
            style={{ position: 'absolute', fontSize: p.size, lineHeight: 1 }}
          >
            {'💗'}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * Spawn hearts that drift gently upward from the cat position.
 * x/y should be the screen-space centre of the vanishing cats.
 */
function spawnParticles(x: number, y: number, count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    // Mostly upward arc with gentle horizontal spread
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
    const speed = 0.4 + Math.random() * 0.9;
    return {
      id: `p${Date.now()}${i}`,
      x: x + (Math.random() - 0.5) * 28,
      y: y + (Math.random() - 0.5) * 18,
      type: 'heart' as const,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 12 + Math.random() * 10,
    };
  });
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
            width: 32, height: 32, borderRadius: '50%',
            background: isBoss ? 'rgba(255,255,255,0.1)' : C.peach,
            border: `1.5px solid ${hudBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, cursor: 'pointer',
          }}
        >⏸</button>
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
            <div key={coat} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <CatImg coat={coat} size={28} />
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
        {/* Moves */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 5,
          background: isBoss ? 'rgba(255,255,255,0.06)' : C.cream,
          borderRadius: 10, padding: '4px 8px',
          border: state.budget.movesLeft <= 5 ? `1.5px solid ${C.accent}` : `1.5px solid ${hudBorder}`,
        }}>
          <span style={{ fontSize: 14 }}>🐾</span>
          <span style={{
            fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 18,
            color: state.budget.movesLeft <= 5 ? C.accent : textColor,
          }}>{state.budget.movesLeft}</span>
          <span style={{ fontSize: 10, color: subColor, fontFamily: 'Nunito, sans-serif' }}>moves</span>
        </div>
        {/* Chain */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 5,
          background: isBoss ? 'rgba(255,255,255,0.06)' : C.cream,
          borderRadius: 10, padding: '4px 8px',
          border: `1.5px solid ${hudBorder}`,
        }}>
          <span style={{ fontSize: 14 }}>⏱</span>
          <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 18, color: textColor }}>
            ×{state.chainLength}
          </span>
          <span style={{ fontSize: 10, color: subColor, fontFamily: 'Nunito, sans-serif' }}>chain</span>
        </div>
        {/* Score */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 5,
          background: isBoss ? 'rgba(255,255,255,0.06)' : C.cream,
          borderRadius: 10, padding: '4px 8px',
          border: `1.5px solid ${hudBorder}`,
        }}>
          <span style={{ fontSize: 14 }}>⭐</span>
          <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 15, color: textColor }}>
            {state.score.toLocaleString()}
          </span>
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
    { icon: '↶', label: 'Undo', onClick: onUndo, disabled: !undoAvailable || hasChunk },
    { icon: '🐾', label: '+5 moves', onClick: onAddMoves, disabled: false },
    { icon: '☝︎', label: 'Solo grab', onClick: onSoloGrab, disabled: hasChunk },
    { icon: '💣', label: 'Color bomb', onClick: onColorBomb, disabled: hasChunk },
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
          <span style={{ fontSize: 18 }}>{b.icon}</span>
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
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1.05, opacity: 1 }}
        exit={{ scale: 1.3, opacity: 0 }}
        transition={{ duration: 0.35 }}
        style={{
          position: 'fixed', top: '42%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 55, pointerEvents: 'none', textAlign: 'center',
        }}
      >
        <div style={{
          fontFamily: 'Nunito, sans-serif', fontWeight: 900,
          fontSize: 42,
          color: isBoss ? C.butter : C.accent,
          textShadow: isBoss
            ? `0 2px 12px rgba(244,220,120,0.6)`
            : `0 2px 12px rgba(232,116,90,0.5)`,
        }}>
          CHAIN ×{chain}
        </div>
        <div style={{ fontSize: 24, marginTop: -4 }}>
          {isBoss ? '✨✨✨' : '💗💗💗'}
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
        <div style={{ display: 'flex', gap: 8 }}>
          {[1, 2, 3].map(s => (
            <motion.div
              key={s}
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: state.stars >= s ? 1.15 : 0.7, rotate: 0 }}
              transition={{ delay: s * 0.18, type: 'spring' }}
              style={{ fontSize: 36, opacity: state.stars >= s ? 1 : 0.2 }}
            >⭐</motion.div>
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
        {/* Header */}
        <div style={{
          background: 'rgba(255,243,232,0.95)',
          borderBottom: `1.5px solid ${C.peachMid}`,
          padding: '14px 16px',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <motion.button whileTap={{ scale: 0.95 }} onClick={onBack} style={{
              background: C.peach, border: `1.5px solid ${C.peachMid}`,
              borderRadius: 12, padding: '4px 12px',
              fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 12,
              color: C.brownMid, cursor: 'pointer',
            }}>← Back</motion.button>
            <div style={{
              fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 14,
              color: C.brownMid, letterSpacing: 1,
            }}>WORLD 1 · COZY LIVING ROOM</div>
            <div style={{ width: 56 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 8, background: C.peach, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4,
                background: `linear-gradient(90deg, ${C.accent}, ${C.pink})`,
                width: `${Math.min(100, (Object.keys(completedLevels).length / LEVELS.length) * 100)}%`,
                transition: 'width 0.5s ease',
              }} />
            </div>
            <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 13, color: C.brown }}>
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
                {/* Cat icon or lock */}
                {locked ? (
                  <div style={{ fontSize: 24 }}>🔒</div>
                ) : level.isBoss ? (
                  <div style={{ fontSize: 24 }}>⚡</div>
                ) : (
                  <CatImg coat={level.goalCoats[0]} size={36} />
                )}

                {/* Level number */}
                <div style={{
                  fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 16,
                  color: locked ? C.brownLight : C.brown,
                }}>{level.id}</div>

                {/* Stars */}
                <div style={{ display: 'flex', gap: 1, fontSize: 12 }}>
                  {[1, 2, 3].map(s => (
                    <span key={s} style={{ opacity: stars >= s ? 1 : 0.2 }}>⭐</span>
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

function GameBoard({ state, onTap, onPause, onUndo, onAddMoves, undoAvailable, vanishHighlightIds }: {
  state: GameState;
  onTap: (containerId: string, e: React.MouseEvent, towerCenterX: number, towerCenterY: number) => void;
  onPause: () => void;
  onUndo: () => void;
  onAddMoves: () => void;
  undoAvailable: boolean;
  vanishHighlightIds: Set<string>;
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
          {state.containers.map((container, idx) => (
            <TowerContainer
              key={container.id}
              container={container}
              containerIndex={idx}
              isSelected={state.selectedContainerId === container.id}
              hasChunk={hasChunk}
              onTap={(e: React.MouseEvent, cx: number, cy: number) => onTap(container.id, e, cx, cy)}
              isBoss={isBoss}
              vanishHighlightIds={vanishHighlightIds}
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
  // Staged vanish animation
  const [vanishHighlightIds, setVanishHighlightIds] = useState<Set<string>>(new Set());
  const [isAnimating, setIsAnimating] = useState(false);

  const chainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

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

  const handleTap = useCallback((containerId: string, event: React.MouseEvent, towerCenterX = 200, towerCenterY = 350) => {
    if (!gameState || gameState.phase !== 'playing') return;
    if (isAnimating) return; // block input during vanish sequence

    if (!gameState.chunk) {
      // Grab phase
      const next = grabChunk(gameState, containerId);
      if (next.chunk) {
        const bubble = makeBubble('mrow ~', (event.clientX ?? 160) - 30, (event.clientY ?? 300) - 50);
        setGameState({ ...next, speechBubbles: [bubble] });
      } else {
        setGameState(next);
      }
    } else {
      // Place phase — free cancel on source tap
      if (containerId === gameState.chunk.sourceContainerId) {
        setGameState(cancelGrab(gameState));
        return;
      }

      const savedState = gameState;
      const result = placeChunk(gameState, containerId);

      if (!result.success) {
        // For capacity errors, keep the chunk in hand so player can try another tower
        if (result.error === 'Max capacity!') {
          setGameState({ ...gameState, message: 'Max capacity! 🐾' });
        } else {
          const cancelled = cancelGrab(gameState);
          setGameState({ ...cancelled, message: result.error ?? 'Cannot place here!' });
        }
        return;
      }

      // Save for undo
      setPrevState(savedState);

      // Clear any running animation timers
      animTimersRef.current.forEach(t => clearTimeout(t));
      animTimersRef.current = [];

      const steps = result.vanishSteps;

      if (steps.length === 0) {
        // No vanish — apply final state immediately
        setGameState(result.newState);
        return;
      }

      // ── Staged vanish sequence ────────────────────────────────────────────
      // Timing per step: 150ms show pre-state → 350ms highlight → hearts burst
      const SHOW_MS = 150;   // brief pause after placement before highlight
      const SHAKE_MS = 350;  // highlight duration before hearts fire
      const GAP_MS = 80;     // gap before next chain step
      const STEP_MS = SHOW_MS + SHAKE_MS + GAP_MS;

      setIsAnimating(true);

      steps.forEach((step, i) => {
        const stepStart = i * STEP_MS;

        // 1. Show pre-state (full stack including cats about to vanish)
        const t1 = setTimeout(() => {
          setGameState(step.preState);
          setVanishHighlightIds(new Set());
        }, stepStart);

        // 2. Highlight the vanishing cats (glow + shake)
        const t2 = setTimeout(() => {
          setVanishHighlightIds(new Set(step.vanishingIds));
        }, stepStart + SHOW_MS);

        // 3. Transition to post-state (cats removed) + hearts explosion
        const t3 = setTimeout(() => {
          setVanishHighlightIds(new Set());
          // Spawn hearts burst at the tap location for each vanish step
          const heartCount = 10 + step.vanishingIds.length * 2;
          const hearts = spawnParticles(towerCenterX, towerCenterY, heartCount);
          setGameState(prev => prev ? { ...step.postState, particles: [...(prev.particles ?? []), ...hearts] } : step.postState);
          // Show chain banner for combos
          if (i >= 1) {
            setShowChain(i + 1);
            if (chainTimerRef.current) clearTimeout(chainTimerRef.current);
            chainTimerRef.current = setTimeout(() => setShowChain(0), 1200);
          }
          // Purr bubble on each vanish
          const bubble = makeBubble('purr ♥', (event.clientX ?? 160) - 20, (event.clientY ?? 300) - 60);
          setGameState(prev => prev ? { ...prev, speechBubbles: [bubble] } : prev);
        }, stepStart + SHOW_MS + SHAKE_MS);

        animTimersRef.current.push(t1, t2, t3);
      });

      // 4. After all steps, commit the final resolved state
      const finalT = setTimeout(() => {
        setGameState({ ...result.newState, particles: [] });
        setVanishHighlightIds(new Set());
        setIsAnimating(false);

        if (result.won && gameState.levelConfig) {
          const levelId = gameState.levelConfig.id;
          setCompletedLevels(prev => ({
            ...prev,
            [levelId]: Math.max(prev[levelId] ?? 0, result.newState.stars),
          }));
        }
      }, steps.length * STEP_MS + 80);

      animTimersRef.current.push(finalT);
    }
  }, [gameState, isAnimating]);

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
        vanishHighlightIds={vanishHighlightIds}
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
