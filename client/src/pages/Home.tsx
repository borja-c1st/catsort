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
  ginger:  '/assets/ginger.png',
  white:   '/assets/white.png',
  black:   '/assets/black.png',
  tabby:   '/assets/tabby.png',
  calico:  '/assets/calico.png',
  siamese: '/assets/siamese.png',
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
  '/assets/bed-basket.png',
  '/assets/bed-cloud.png',
  '/assets/bed-cushion.png',
  '/assets/bed-donut.png',
  '/assets/bed-box.png',
];

function getBedImg(containerIndex: number): string {
  return BED_IMGS[containerIndex % BED_IMGS.length];
}

// ─── Cat idle animation ─────────────────────────────────────────────────────

/**
 * Wraps a single cat in a continuous idle wobble:
 *   scale: oscillates 0.92 – 1.0 via cosine squish
 *   rotate: oscillates -3 – +3 deg via sine
 *   y: subtle 2px vertical bob via a slower sine
 * Each cat has a unique phase so the tower looks alive, not robotic.
 */
function CatIdleWrapper({ children, phase, disabled }: {
  children: React.ReactNode;
  phase: number;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (disabled) {
      if (ref.current) ref.current.style.transform = '';
      return;
    }
    const FREQ = 2.2;      // main wobble speed (rad/s)
    const BOB_FREQ = 1.1;  // vertical bob speed
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      // Cosine squish: 0.92 – 1.0
      const scale = 0.96 + 0.04 * Math.cos(t * FREQ + phase);
      // Sine rotation: -3 – +3 deg
      const rot = 3 * Math.sin(t * FREQ * 0.65 + phase);
      // Vertical bob: -2 – 0 px
      const ty = -1.5 * (1 + Math.sin(t * BOB_FREQ + phase + Math.PI / 2));
      if (ref.current) {
        ref.current.style.transform =
          `translateY(${ty.toFixed(2)}px) scale(${scale.toFixed(4)}) rotate(${rot.toFixed(3)}deg)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [disabled, phase]);

  return (
    <div ref={ref} style={{ display: 'flex', justifyContent: 'center', willChange: 'transform' }}>
      {children}
    </div>
  );
}

// ─── Tower / Container ────────────────────────────────────────────────────────

function TowerContainer({
  container, containerIndex, isSelected, hasChunk, onTap, isBoss, vanishHighlightIds, catItemRefs,
}: {
  container: Container;
  containerIndex: number;
  isSelected: boolean;
  hasChunk: boolean;
  onTap: (e: React.MouseEvent, towerCenterX: number, towerCenterY: number) => void;
  isBoss: boolean;
  vanishHighlightIds?: Set<string>;
  catItemRefs?: React.MutableRefObject<Map<string, HTMLElement>>;
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
                  ref={(el) => {
                    if (el) catItemRefs?.current.set(item.id, el as HTMLElement);
                    else catItemRefs?.current.delete(item.id);
                  }}
                  initial={{ scale: 0.6, opacity: 0, y: -24 }}
                  animate={isVanishing
                    ? {
                        // Hypercasual pop: quick scale-up then instant disappear
                        scale: [1, 1.5, 1.6, 0],
                        opacity: [1, 1, 1, 0],
                        y: [0, -6, -8, -8],
                        rotate: [0, (idx % 2 === 0 ? 12 : -12), 0, 0],
                      }
                    : { scale: 1, opacity: 1, y: 0 }
                  }
                  exit={{ scale: 0.5, opacity: 0, y: -8, transition: { duration: 0.1 } }}
                  transition={isVanishing
                    ? { duration: 0.63, ease: [0.22, 1, 0.36, 1], times: [0, 0.35, 0.6, 1] }
                    : { type: 'spring', stiffness: 1400, damping: 50, delay: idx * 0.003 }
                  }
                  style={{
                    display: 'flex', justifyContent: 'center', marginBottom: -10,
                    filter: isVanishing
                      ? `drop-shadow(0 0 14px ${COAT_COLORS[item.coat].body}) drop-shadow(0 0 6px #fff) brightness(1.5)`
                      : 'none',
                    zIndex: isVanishing ? 5 : 'auto',
                    position: 'relative',
                  }}
                >
                  <CatIdleWrapper phase={idx * 1.3 + containerIndex * 0.7} disabled={isVanishing}>
                    <CatImg coat={item.coat} size={CAT_SIZE} />
                  </CatIdleWrapper>
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
        {/* N-grab badge on the bed — chunky Supercell pill */}
        <div style={{
          position: 'absolute',
          bottom: -6,
          right: -8,
          background: isBoss
            ? 'linear-gradient(180deg, #9B8BFF 0%, #6B5BEE 100%)'
            : 'linear-gradient(180deg, #FFB347 0%, #FF8C00 100%)',
          borderRadius: 999,
          padding: '2px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isBoss ? '0 3px 0 #3A30AA' : '0 3px 0 #CC6600',
          border: '2px solid rgba(255,255,255,0.5)',
          zIndex: 4,
        }}>
          <span style={{
            fontFamily: 'Fredoka One, Nunito, sans-serif',
            fontSize: 13,
            color: '#FFF',
            lineHeight: 1,
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
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

  const CAT_SIZE = 44;
  const CAT_GAP = 2;
  // Stack height so we can offset upward from the finger
  const stackH = chunk.items.length * (CAT_SIZE + CAT_GAP);

  // Offset: center horizontally on finger, stack rises above finger
  const offsetX = -(CAT_SIZE / 2);
  const offsetY = -(stackH + 16); // 16px above the bottom of the stack

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
        flexDirection: 'column', // top cat first visually
        gap: CAT_GAP,
        alignItems: 'center',
        filter: 'drop-shadow(0 4px 12px rgba(232,116,90,0.45))',
      }}
    >
      {chunk.items.map((item, i) => (
        <motion.div
          key={item.id}
          animate={{
            x: [0, i % 2 === 0 ? 6 : -6, 0, i % 2 === 0 ? 4 : -4, 0],
            rotate: [0, i % 2 === 0 ? 12 : -12, 0, i % 2 === 0 ? 8 : -8, 0],
            scale: [1, 1.08, 0.95, 1.04, 1],
          }}
          transition={{
            repeat: Infinity,
            duration: 0.65 + i * 0.1,
            ease: 'easeInOut',
            delay: i * 0.07,
          }}
        >
          <CatImg coat={item.coat} size={CAT_SIZE} />
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

// Hypercasual particle emojis — varied for visual richness
const BURST_EMOJIS = ['💗', '💖', '✨', '⭐', '💛', '🧡', '💜', '💙'];

function ParticleLayer({ particles }: { particles: Particle[] }) {
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 45 }}>
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{ x: p.x, y: p.y, scale: 0, opacity: 1, rotate: 0 }}
          animate={{
            x: p.x + p.vx * 40,
            y: p.y + p.vy * 40,
            scale: [0, 0.8, 0.65, 0],
            opacity: [1, 1, 0.8, 0],
            rotate: p.vx > 0 ? 180 : -180,
          }}
          transition={{
            duration: 1.0,
            ease: [0.22, 1, 0.36, 1],
            scale: { times: [0, 0.15, 0.5, 1] },
            opacity: { times: [0, 0.2, 0.65, 1] },
          }}
          style={{
            position: 'absolute',
            fontSize: p.size,
            lineHeight: 1,
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
          }}
        >
          {BURST_EMOJIS[Math.floor(p.size) % BURST_EMOJIS.length]}
        </motion.div>
      ))}
    </div>
  );
}

/**
 * Hypercasual burst: full 360° explosion from the cat midpoint.
 * Fast, punchy, varied sizes — like a mobile merge game pop.
 */
function spawnParticles(x: number, y: number, count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    // Full 360° spread with varied speed — inner ring fast, outer ring slower
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
    const speed = 1.0 + Math.random() * 1.2;
    const sizeVal = 8 + Math.floor(Math.random() * 7); // 8–14px (50% smaller)
    return {
      id: `p${Date.now()}${i}`,
      x: x + (Math.random() - 0.5) * 16,
      y: y + (Math.random() - 0.5) * 16,
      type: 'heart' as const,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: sizeVal,
    };
  });
}

function makeBubble(text: string, x: number, y: number): SpeechBubble {
  return { id: `b${Date.now()}${Math.random()}`, text, x, y, life: 1 };
}

// ─── HUD ──────────────────────────────────────────────────────────────────────
// King/Supercell style: currency bar on top, level badge, goal cats, moves pill

function CurrencyBar({ isBoss }: { isBoss: boolean }) {
  const bg = isBoss
    ? 'linear-gradient(180deg, #2A2650 0%, #1A1830 100%)'
    : 'linear-gradient(180deg, #FF9EBC 0%, #FF7AA8 100%)';
  return (
    <div style={{
      width: '100%',
      background: bg,
      padding: '6px 14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 8,
      flexShrink: 0,
      boxShadow: '0 2px 0px rgba(0,0,0,0.15)',
    }}>
      {/* Coins */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        background: 'rgba(0,0,0,0.2)', borderRadius: 999,
        padding: '3px 10px 3px 4px',
        border: '1.5px solid rgba(255,255,255,0.25)',
      }}>
        <span style={{ fontSize: 16 }}>🪙</span>
        <span style={{ fontFamily: 'Fredoka One, Nunito, sans-serif', fontSize: 14, color: '#FFF', letterSpacing: 0.5 }}>1,240</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginLeft: 2 }}>+</span>
      </div>
      {/* Gems */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        background: 'rgba(0,0,0,0.2)', borderRadius: 999,
        padding: '3px 10px 3px 4px',
        border: '1.5px solid rgba(255,255,255,0.25)',
      }}>
        <span style={{ fontSize: 16 }}>💎</span>
        <span style={{ fontFamily: 'Fredoka One, Nunito, sans-serif', fontSize: 14, color: '#FFF', letterSpacing: 0.5 }}>48</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginLeft: 2 }}>+</span>
      </div>
      {/* Lives */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        background: 'rgba(0,0,0,0.2)', borderRadius: 999,
        padding: '3px 10px 3px 4px',
        border: '1.5px solid rgba(255,255,255,0.25)',
      }}>
        <span style={{ fontSize: 16 }}>❤️</span>
        <span style={{ fontFamily: 'Fredoka One, Nunito, sans-serif', fontSize: 14, color: '#FFF', letterSpacing: 0.5 }}>5</span>
      </div>
    </div>
  );
}

function HUD({ state, onPause, isBoss, onMute, muted }: { state: GameState; onPause: () => void; isBoss: boolean; onMute: () => void; muted: boolean }) {
  const cfg = state.levelConfig!;
  const goalEntries = Object.entries(state.goalProgress) as [CoatId, { cleared: number; total: number }][];
  const isLow = state.budget.movesLeft <= 5;

  const hudBg = isBoss
    ? 'linear-gradient(180deg, #1E1C3A 0%, #2A2848 100%)'
    : 'linear-gradient(180deg, #FFF0FA 0%, #FFE4F4 100%)';
  const textColor = isBoss ? '#F0EAFF' : '#3A2A25';
  const subColor = isBoss ? 'rgba(240,234,255,0.55)' : '#9A7A88';

  return (
    <div style={{
      width: '100%',
      background: hudBg,
      padding: '8px 14px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      flexShrink: 0,
      boxShadow: '0 3px 0px rgba(0,0,0,0.12)',
    }}>
      {/* Row 1: pause | level badge | settings */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onPause}
            style={{
              width: 36, height: 36, borderRadius: 999,
              background: isBoss ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.7)',
              border: 'none',
              boxShadow: '0 3px 0 rgba(0,0,0,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, cursor: 'pointer',
            }}
          >⏸</motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onMute}
            style={{
              width: 36, height: 36, borderRadius: 999,
              background: isBoss ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.7)',
              border: 'none',
              boxShadow: '0 3px 0 rgba(0,0,0,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, cursor: 'pointer',
            }}
          >{muted ? '🔇' : '🔊'}</motion.button>
        </div>

        {/* Level badge — King style pill */}
        <div style={{
          background: isBoss
            ? 'linear-gradient(180deg, #7B68EE 0%, #5A4FCC 100%)'
            : 'linear-gradient(180deg, #FF9EBC 0%, #E8607A 100%)',
          borderRadius: 999,
          padding: '4px 20px',
          boxShadow: isBoss ? '0 4px 0 #3A30AA' : '0 4px 0 #B83050',
          border: '2px solid rgba(255,255,255,0.4)',
        }}>
          <span style={{
            fontFamily: 'Fredoka One, Nunito, sans-serif',
            fontSize: 16, color: '#FFF',
            letterSpacing: 0.5,
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          }}>
            {isBoss ? '⭐ BOSS' : `Level ${cfg.id}`}
          </span>
        </div>

        {/* Score pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: isBoss ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.7)',
          borderRadius: 999, padding: '4px 10px',
          boxShadow: '0 2px 0 rgba(0,0,0,0.1)',
        }}>
          <span style={{ fontSize: 13 }}>⭐</span>
          <span style={{ fontFamily: 'Fredoka One, Nunito, sans-serif', fontSize: 13, color: textColor }}>
            {state.score.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Row 2: goal cats + moves counter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {/* Goal cats */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {goalEntries.map(([coat, prog]) => {
            const done = prog.cleared >= prog.total;
            return (
              <div key={coat} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                background: done
                  ? 'rgba(100,200,100,0.25)'
                  : isBoss ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)',
                borderRadius: 16, padding: '4px 8px',
                border: done ? '2px solid #6CC86C' : '2px solid rgba(255,255,255,0.5)',
                boxShadow: done ? '0 2px 0 #4A9A4A' : '0 2px 0 rgba(0,0,0,0.08)',
                opacity: done ? 0.7 : 1,
                position: 'relative',
              }}>
                {done && (
                  <div style={{
                    position: 'absolute', top: -6, right: -6,
                    width: 16, height: 16, borderRadius: 999,
                    background: '#6CC86C', border: '2px solid #FFF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, color: '#FFF', fontWeight: 900,
                  }}>✓</div>
                )}
                <CatImg coat={coat} size={30} />
                <span style={{
                  fontFamily: 'Fredoka One, Nunito, sans-serif',
                  fontSize: 12, color: done ? '#4A9A4A' : textColor,
                  lineHeight: 1,
                }}>{prog.cleared}/{prog.total}</span>
              </div>
            );
          })}
        </div>

        {/* Moves counter — big chunky pill */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          background: isLow
            ? 'linear-gradient(180deg, #FF6B6B 0%, #E84040 100%)'
            : isBoss
            ? 'linear-gradient(180deg, #7B68EE 0%, #5A4FCC 100%)'
            : 'linear-gradient(180deg, #FFB347 0%, #FF8C00 100%)',
          borderRadius: 20,
          padding: '6px 16px',
          minWidth: 64,
          boxShadow: isLow ? '0 4px 0 #A02020' : isBoss ? '0 4px 0 #3A30AA' : '0 4px 0 #CC6600',
          border: '2px solid rgba(255,255,255,0.4)',
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: 'Fredoka One, Nunito, sans-serif',
            fontSize: 28, color: '#FFF', lineHeight: 1,
            textShadow: '0 2px 4px rgba(0,0,0,0.25)',
          }}>{state.budget.movesLeft}</span>
          <span style={{
            fontFamily: 'Nunito, sans-serif', fontWeight: 700,
            fontSize: 10, color: 'rgba(255,255,255,0.85)', letterSpacing: 0.5,
          }}>MOVES</span>
        </div>
      </div>
    </div>
  );
}

// ─── Booster bar ──────────────────────────────────────────────────────────────
// Supercell/King style: 3 chunky gradient booster buttons with gem cost badges

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
  const bg = isBoss
    ? 'linear-gradient(180deg, #1E1C3A 0%, #2A2848 100%)'
    : 'linear-gradient(180deg, #FFF0FA 0%, #FFE4F4 100%)';

  // 3 main boosters (King-style: each has a distinct color)
  const boosters = [
    {
      icon: '↩️',
      label: 'Undo',
      cost: '💎 1',
      gradient: 'linear-gradient(180deg, #74B9FF 0%, #4A90E2 100%)',
      shadow: '#2A60B0',
      onClick: onUndo,
      disabled: !undoAvailable || hasChunk,
    },
    {
      icon: '🐾',
      label: '+5 Moves',
      cost: '💎 3',
      gradient: 'linear-gradient(180deg, #55EFC4 0%, #00B894 100%)',
      shadow: '#007A60',
      onClick: onAddMoves,
      disabled: false,
    },
    {
      icon: '💣',
      label: 'Bomb',
      cost: '💎 5',
      gradient: 'linear-gradient(180deg, #FD79A8 0%, #E84393 100%)',
      shadow: '#A02060',
      onClick: onColorBomb,
      disabled: hasChunk,
    },
  ];

  return (
    <div style={{
      width: '100%',
      background: bg,
      padding: '10px 16px max(12px, env(safe-area-inset-bottom, 12px))',
      display: 'flex',
      gap: 12,
      flexShrink: 0,
      boxShadow: '0 -3px 0 rgba(0,0,0,0.08)',
    }}>
      {boosters.map(b => (
        <motion.button
          key={b.label}
          whileTap={{ scale: 0.9 }}
          onClick={b.onClick}
          disabled={b.disabled}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            background: b.gradient,
            border: '2.5px solid rgba(255,255,255,0.45)',
            borderRadius: 20,
            padding: '10px 4px 8px',
            cursor: b.disabled ? 'not-allowed' : 'pointer',
            opacity: b.disabled ? 0.45 : 1,
            boxShadow: b.disabled ? 'none' : `0 5px 0 ${b.shadow}, 0 6px 16px rgba(0,0,0,0.15)`,
            position: 'relative',
          }}
        >
          <span style={{ fontSize: 24, lineHeight: 1 }}>{b.icon}</span>
          <span style={{
            fontSize: 10, fontFamily: 'Fredoka One, Nunito, sans-serif',
            color: '#FFF', textAlign: 'center', lineHeight: 1.1,
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          }}>{b.label}</span>
          {/* Cost badge */}
          <div style={{
            position: 'absolute', bottom: -8,
            background: 'rgba(0,0,0,0.55)',
            borderRadius: 999, padding: '2px 7px',
            border: '1.5px solid rgba(255,255,255,0.3)',
          }}>
            <span style={{ fontSize: 9, color: '#FFF', fontFamily: 'Nunito, sans-serif', fontWeight: 700 }}>{b.cost}</span>
          </div>
        </motion.button>
      ))}

      {/* Cancel pill — shown when chunk is held */}
      {hasChunk && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {}}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            background: 'linear-gradient(180deg, #FF7675 0%, #D63031 100%)',
            border: '2.5px solid rgba(255,255,255,0.45)',
            borderRadius: 20,
            padding: '10px 4px 8px',
            cursor: 'pointer',
            boxShadow: '0 5px 0 #8A1010, 0 6px 16px rgba(0,0,0,0.15)',
          }}
        >
          <span style={{ fontSize: 24, lineHeight: 1 }}>✕</span>
          <span style={{
            fontSize: 10, fontFamily: 'Fredoka One, Nunito, sans-serif',
            color: '#FFF', textShadow: '0 1px 2px rgba(0,0,0,0.3)',
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
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(80,40,100,0.55)', backdropFilter: 'blur(8px)',
      }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        style={{
          width: '100%', maxWidth: 480,
          borderRadius: '32px 32px 0 0',
          background: 'linear-gradient(180deg, #FFF0FA 0%, #FFE4F4 100%)',
          boxShadow: '0 -8px 40px rgba(232,96,122,0.3)',
          padding: '28px 24px max(28px, env(safe-area-inset-bottom, 28px))',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        }}
      >
        {/* Stars — big King-style */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', marginTop: -48 }}>
          {[1, 2, 3].map(s => (
            <motion.div
              key={s}
              initial={{ scale: 0, rotate: s === 2 ? -20 : s === 1 ? -35 : 35, y: 20 }}
              animate={{
                scale: state.stars >= s ? (s === 2 ? 1.25 : 1.0) : 0.65,
                rotate: s === 2 ? 0 : s === 1 ? -12 : 12,
                y: s === 2 ? -8 : 0,
              }}
              transition={{ delay: s * 0.15, type: 'spring', stiffness: 300 }}
              style={{
                fontSize: s === 2 ? 64 : 52,
                opacity: state.stars >= s ? 1 : 0.2,
                filter: state.stars >= s ? 'drop-shadow(0 4px 8px rgba(255,200,0,0.6))' : 'none',
              }}
            >⭐</motion.div>
          ))}
        </div>

        <div style={{
          fontFamily: 'Fredoka One, Nunito, sans-serif',
          fontSize: 38, color: '#E8607A',
          textShadow: '0 3px 0 #B83050',
          letterSpacing: 1,
        }}>Level Clear!</div>

        {/* Cat parade */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          {(['ginger', 'white', 'tabby'] as CoatId[]).map((c, i) => (
            <motion.div
              key={c}
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.18 }}
            >
              <CatImg coat={c} size={48} />
            </motion.div>
          ))}
        </div>

        {/* Stats row */}
        <div style={{
          width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: 8, textAlign: 'center',
        }}>
          {[
            { icon: '⭐', label: 'Score', value: state.score.toLocaleString() },
            { icon: '🐾', label: 'Moves Left', value: `${state.budget.movesLeft}` },
            { icon: '⚡', label: 'Best Chain', value: `×${state.bestChain}` },
          ].map(s => (
            <div key={s.label} style={{
              background: 'rgba(255,255,255,0.7)',
              borderRadius: 20, padding: '8px 4px',
              border: '2px solid rgba(255,255,255,0.9)',
              boxShadow: '0 3px 0 rgba(200,100,120,0.15)',
            }}>
              <div style={{ fontSize: 18 }}>{s.icon}</div>
              <div style={{ fontFamily: 'Fredoka One, Nunito, sans-serif', fontSize: 18, color: '#3A2A25' }}>{s.value}</div>
              <div style={{ fontSize: 9, color: '#9A7A88', fontFamily: 'Nunito, sans-serif', fontWeight: 700 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {hasNext && (
            <motion.button whileTap={{ scale: 0.94 }} onClick={onNext} style={{
              width: '100%', padding: '16px', borderRadius: 999,
              background: 'linear-gradient(180deg, #FF9EBC 0%, #E8607A 100%)',
              color: '#fff', fontFamily: 'Fredoka One, Nunito, sans-serif', fontSize: 20,
              border: '3px solid rgba(255,255,255,0.5)', cursor: 'pointer',
              boxShadow: '0 6px 0 #B83050, 0 8px 20px rgba(232,96,122,0.35)',
            }}>Next Level →</motion.button>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <motion.button whileTap={{ scale: 0.94 }} onClick={onReplay} style={{
              flex: 1, padding: '12px', borderRadius: 999,
              background: 'linear-gradient(180deg, #74B9FF 0%, #4A90E2 100%)',
              color: '#fff', fontFamily: 'Fredoka One, Nunito, sans-serif', fontSize: 16,
              border: '3px solid rgba(255,255,255,0.5)', cursor: 'pointer',
              boxShadow: '0 5px 0 #2A60B0',
            }}>Replay</motion.button>
            <motion.button whileTap={{ scale: 0.94 }} onClick={onMenu} style={{
              flex: 1, padding: '12px', borderRadius: 999,
              background: 'linear-gradient(180deg, #A29BFE 0%, #6C5CE7 100%)',
              color: '#fff', fontFamily: 'Fredoka One, Nunito, sans-serif', fontSize: 16,
              border: '3px solid rgba(255,255,255,0.5)', cursor: 'pointer',
              boxShadow: '0 5px 0 #4A3AB0',
            }}>Map</motion.button>
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
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(60,20,40,0.6)', backdropFilter: 'blur(8px)',
      }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        style={{
          width: '100%', maxWidth: 480,
          borderRadius: '32px 32px 0 0',
          background: 'linear-gradient(180deg, #FFF0FA 0%, #FFE4F4 100%)',
          boxShadow: '0 -8px 40px rgba(200,60,80,0.3)',
          padding: '28px 24px max(28px, env(safe-area-inset-bottom, 28px))',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        }}
      >
        <motion.div
          animate={{ rotate: [-5, 5, -5, 5, 0] }}
          transition={{ duration: 0.6, delay: 0.3 }}
          style={{ fontSize: 64 }}
        >😿</motion.div>
        <div style={{
          fontFamily: 'Fredoka One, Nunito, sans-serif',
          fontSize: 34, color: '#E84040',
          textShadow: '0 3px 0 #A02020',
        }}>Out of Moves!</div>
        <div style={{ fontSize: 13, color: '#9A7A88', fontFamily: 'Nunito, sans-serif', fontWeight: 700, textAlign: 'center' }}>
          The kittens are still mixed up...
        </div>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <motion.button whileTap={{ scale: 0.94 }} onClick={onReplay} style={{
            width: '100%', padding: '16px', borderRadius: 999,
            background: 'linear-gradient(180deg, #FF7675 0%, #D63031 100%)',
            color: '#fff', fontFamily: 'Fredoka One, Nunito, sans-serif', fontSize: 20,
            border: '3px solid rgba(255,255,255,0.5)', cursor: 'pointer',
            boxShadow: '0 6px 0 #8A1010, 0 8px 20px rgba(214,48,49,0.35)',
          }}>Try Again!</motion.button>
          <motion.button whileTap={{ scale: 0.94 }} onClick={onMenu} style={{
            width: '100%', padding: '12px', borderRadius: 999,
            background: 'linear-gradient(180deg, #A29BFE 0%, #6C5CE7 100%)',
            color: '#fff', fontFamily: 'Fredoka One, Nunito, sans-serif', fontSize: 16,
            border: '3px solid rgba(255,255,255,0.5)', cursor: 'pointer',
            boxShadow: '0 5px 0 #4A3AB0',
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
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: isBoss ? 'rgba(10,8,30,0.8)' : 'rgba(80,40,100,0.55)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        style={{
          width: '100%', maxWidth: 480,
          borderRadius: '32px 32px 0 0',
          background: isBoss
            ? 'linear-gradient(180deg, #2A2848 0%, #1A1630 100%)'
            : 'linear-gradient(180deg, #FFF0FA 0%, #FFE4F4 100%)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.25)',
          padding: '28px 24px max(28px, env(safe-area-inset-bottom, 28px))',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        }}
      >
        <div style={{ fontSize: 52 }}>⏸️</div>
        <div style={{
          fontFamily: 'Fredoka One, Nunito, sans-serif',
          fontSize: 36,
          color: isBoss ? '#F0EAFF' : '#E8607A',
          textShadow: isBoss ? '0 3px 0 #3A30AA' : '0 3px 0 #B83050',
        }}>Paused</div>
        <motion.button whileTap={{ scale: 0.94 }} onClick={onResume} style={{
          width: '100%', padding: '16px', borderRadius: 999,
          background: 'linear-gradient(180deg, #55EFC4 0%, #00B894 100%)',
          color: '#fff', fontFamily: 'Fredoka One, Nunito, sans-serif', fontSize: 20,
          border: '3px solid rgba(255,255,255,0.5)', cursor: 'pointer',
          boxShadow: '0 6px 0 #007A60, 0 8px 20px rgba(0,184,148,0.35)',
        }}>Resume</motion.button>
        <motion.button whileTap={{ scale: 0.94 }} onClick={onMenu} style={{
          width: '100%', padding: '12px', borderRadius: 999,
          background: 'linear-gradient(180deg, #A29BFE 0%, #6C5CE7 100%)',
          color: '#fff', fontFamily: 'Fredoka One, Nunito, sans-serif', fontSize: 16,
          border: '3px solid rgba(255,255,255,0.5)', cursor: 'pointer',
          boxShadow: '0 5px 0 #4A3AB0',
        }}>World Map</motion.button>
      </motion.div>
    </motion.div>
  );
}

// ─── World map screen ─────────────────────────────────────────────────────────

// World metadata for saga map
const WORLDS = [
  { id: 1, name: 'Cozy Living Room', emoji: '🛋️', bg: `linear-gradient(180deg, #FFE6DB 0%, #FFF3E8 100%)`, pathColor: '#FFCFB3', accent: '#E8745A' },
  { id: 2, name: 'Garden Afternoon', emoji: '🌸', bg: `linear-gradient(180deg, #D4ECC8 0%, #F0F8E8 100%)`, pathColor: '#A8C8A0', accent: '#5A9A5A' },
  { id: 3, name: 'Midnight Rooftop', emoji: '🌙', bg: `linear-gradient(180deg, #1A1830 0%, #2A2848 100%)`, pathColor: '#4A4870', accent: '#A8A8E8' },
  { id: 4, name: 'Dream Palace',     emoji: '✨', bg: `linear-gradient(180deg, #2A1840 0%, #1A1028 100%)`, pathColor: '#6A4888', accent: '#E8B8F8' },
];

// Zigzag x positions for saga path nodes — index 0 = boss (top of world section)
// Pattern: boss center, then zigzag down to L1 at bottom
const SAGA_X = [0.5, 0.25, 0.5, 0.75, 0.5]; // reversed: boss=center, then left, center, right, center

function WorldMap({ onSelect, completedLevels, onBack }: {
  onSelect: (idx: number) => void;
  completedLevels: Record<number, number>;
  onBack: () => void;
}) {
  const completedCount = Object.values(completedLevels).filter(s => s >= 1).length;
  const nextIdx = LEVELS.findIndex(l => !(completedLevels[l.id] >= 1));

  // Scroll to the next unlocked level on mount
  // Worlds render in reverse (World 4 at top, World 1 at bottom), so we scroll to bottom for new players
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Defer scroll until after paint so scrollHeight is accurate
    const raf = requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      if (nextIdx <= 0) {
        // New player — scroll to bottom (World 1 is at the bottom)
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      } else {
        // Scroll so the next level node is visible
        // Worlds are reversed (W4 top, W1 bottom). Each node ~90px.
        const totalNodes = LEVELS.length;
        const nodesFromBottom = totalNodes - nextIdx;
        const nodeHeight = 90;
        const scrollHeight = scrollRef.current.scrollHeight;
        const clientHeight = scrollRef.current.clientHeight;
        const fromBottom = nodesFromBottom * nodeHeight;
        scrollRef.current.scrollTop = Math.max(0, scrollHeight - fromBottom - clientHeight / 2);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [nextIdx]);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      background: '#1A1028',
    }}>
      {/* Sticky header */}
      <div style={{
        background: 'rgba(255,243,232,0.97)',
        borderBottom: `2px solid ${C.peachMid}`,
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        flexShrink: 0, zIndex: 10,
      }}>
        <motion.button whileTap={{ scale: 0.95 }} onClick={onBack} style={{
          background: C.peach, border: `1.5px solid ${C.peachMid}`,
          borderRadius: 12, padding: '5px 14px',
          fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13,
          color: C.brownMid, cursor: 'pointer', flexShrink: 0,
        }}>← Back</motion.button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 15, color: C.brown }}>CatSort Saga</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <div style={{ flex: 1, height: 7, background: C.peach, borderRadius: 4, overflow: 'hidden' }}>
              <motion.div
                style={{ height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${C.accent}, ${C.pink})` }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (completedCount / LEVELS.length) * 100)}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 12, color: C.brownMid, flexShrink: 0 }}>
              {completedCount}/{LEVELS.length} ⭐
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable saga path — World 4 at top, World 1 at bottom (scroll down = easier) */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {[...WORLDS].reverse().map(world => {
          const worldLevels = LEVELS.filter(l => l.world === world.id);
          const isDark = world.id >= 3;
          const textColor = isDark ? '#F0E8FF' : C.brown;
          const subColor = isDark ? '#C0B8D8' : C.brownMid;

          return (
            <div key={world.id} style={{ background: world.bg, padding: '0 0 8px' }}>
              {/* World banner */}
              <div style={{
                padding: '20px 20px 8px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ fontSize: 28 }}>{world.emoji}</div>
                <div>
                  <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 11, letterSpacing: 2, color: world.accent, textTransform: 'uppercase' }}>World {world.id}</div>
                  <div style={{ fontFamily: 'Caveat, cursive', fontSize: 22, color: textColor, lineHeight: 1.1 }}>{world.name}</div>
                </div>
              </div>

              {/* Level nodes in zigzag — reversed so boss (L5/10/15/20) is at top of each world */}
              <div style={{ position: 'relative', padding: '0 0 16px' }}>
                {[...worldLevels].reverse().map((level, i) => {
                  const idx = LEVELS.indexOf(level);
                  const stars = completedLevels[level.id] ?? 0;
                  const locked = idx > 0 && !(completedLevels[LEVELS[idx - 1].id] >= 1);
                  const isNext = !locked && stars === 0;
                  const xFrac = SAGA_X[i];

                  // Node style variants
                  const nodeBg = locked
                    ? (isDark ? 'rgba(60,50,80,0.6)' : 'rgba(200,180,160,0.35)')
                    : level.isBoss
                    ? (isDark ? 'rgba(168,168,232,0.2)' : 'rgba(232,116,90,0.18)')
                    : stars > 0
                    ? (isDark ? 'rgba(100,80,140,0.5)' : 'rgba(255,243,232,0.9)')
                    : 'rgba(255,255,255,0.92)';
                  const nodeBorder = locked
                    ? (isDark ? '1.5px solid rgba(100,90,130,0.4)' : `1.5px solid ${C.peachMid}`)
                    : level.isBoss
                    ? `2.5px solid ${world.accent}`
                    : isNext
                    ? `2px solid ${world.accent}`
                    : `1.5px solid ${isDark ? 'rgba(140,120,180,0.5)' : C.peachMid}`;

                  return (
                    <div key={level.id} style={{
                      display: 'flex',
                      justifyContent: xFrac < 0.5 ? 'flex-start' : xFrac > 0.5 ? 'flex-end' : 'center',
                      padding: `8px ${xFrac === 0.5 ? '0' : '20px'}`,
                      position: 'relative',
                    }}>
                      {/* Connecting line to next node */}
                      {i < worldLevels.length - 1 && (
                        <div style={{
                          position: 'absolute',
                          left: '50%', top: '100%',
                          width: 3, height: 32,
                          background: world.pathColor,
                          opacity: 0.5,
                          borderRadius: 2,
                          transform: 'translateX(-50%)',
                          zIndex: 0,
                        }} />
                      )}

                      <motion.button
                        whileTap={locked ? {} : { scale: 0.93 }}
                        whileHover={locked ? {} : { scale: 1.04 }}
                        onClick={() => !locked && onSelect(idx)}
                        style={{
                          position: 'relative', zIndex: 1,
                          display: 'flex', alignItems: 'center', gap: 10,
                          background: nodeBg,
                          border: nodeBorder,
                          borderRadius: level.isBoss ? 20 : 16,
                          padding: level.isBoss ? '10px 18px' : '8px 14px',
                          cursor: locked ? 'not-allowed' : 'pointer',
                          opacity: locked ? 0.55 : 1,
                          boxShadow: isNext
                            ? `0 4px 20px ${world.accent}44`
                            : level.isBoss && !locked
                            ? `0 4px 16px ${world.accent}33`
                            : 'none',
                          minWidth: 200, maxWidth: 280,
                          transition: 'box-shadow 0.2s',
                        }}
                      >
                        {/* Icon */}
                        <div style={{ flexShrink: 0, position: 'relative' }}>
                          {locked ? (
                            <div style={{ fontSize: 28, lineHeight: 1 }}>🔒</div>
                          ) : level.isBoss ? (
                            <div style={{ fontSize: 28, lineHeight: 1 }}>⚡</div>
                          ) : (
                            <CatImg coat={level.goalCoats[0]} size={40} />
                          )}
                          {/* Pulsing ring for next level */}
                          {isNext && (
                            <motion.div
                              animate={{ scale: [1, 1.4, 1], opacity: [0.7, 0, 0.7] }}
                              transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                              style={{
                                position: 'absolute', inset: -6,
                                borderRadius: '50%',
                                border: `2px solid ${world.accent}`,
                                pointerEvents: 'none',
                              }}
                            />
                          )}
                        </div>

                        {/* Text info */}
                        <div style={{ flex: 1, textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{
                              fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 11,
                              color: world.accent, letterSpacing: 0.5,
                            }}>LVL {level.id}</div>
                            {level.isBoss && (
                              <div style={{
                                fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 9,
                                background: world.accent, color: '#fff',
                                borderRadius: 6, padding: '1px 5px', letterSpacing: 0.5,
                              }}>BOSS</div>
                            )}
                          </div>
                          <div style={{
                            fontFamily: 'Caveat, cursive', fontSize: 17,
                            color: locked ? subColor : textColor, lineHeight: 1.1,
                          }}>{level.name}</div>
                          {!locked && (
                            <div style={{ fontSize: 10, color: subColor, fontFamily: 'Nunito, sans-serif', marginTop: 1 }}>
                              {level.goalCoats.map(c => COAT_COLORS[c].label).join(' · ')} · {level.budget.maxMoves}m
                            </div>
                          )}
                        </div>

                        {/* Stars */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                          {[1, 2, 3].map(s => (
                            <span key={s} style={{ fontSize: 11, opacity: stars >= s ? 1 : 0.2, lineHeight: 1 }}>⭐</span>
                          ))}
                        </div>
                      </motion.button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

// ─── Lobby footer tab bar ─────────────────────────────────────────────────────

const FOOTER_TABS = [
  { id: 'shop',     icon: '🛍️',  label: 'Shop'     },
  { id: 'saga',     icon: '🗺️',  label: 'Saga'     },
  { id: 'home',     icon: '🏠',  label: 'Home'     },
  { id: 'diary',    icon: '📖',  label: 'Diary'    },
  { id: 'settings', icon: '⚙️',  label: 'Settings' },
] as const;

// ─── Title screen / Lobby ─────────────────────────────────────────────────────

function TitleScreen({ onPlay, completedLevels }: { onPlay: () => void; completedLevels: Record<number, number> }) {
  const [activeTab, setActiveTab] = useState<string>('home');

  // Find the next level to play (first incomplete, or last level)
  const nextLevelIdx = Math.min(
    Object.keys(completedLevels).length,
    LEVELS.length - 1
  );
  const nextLevel = LEVELS[nextLevelIdx];

  const handleTabPress = (id: string) => {
    if (id === 'home') { setActiveTab(id); return; }
    if (id === 'saga') { setActiveTab('home'); return; } // saga removed
    setActiveTab(id);
  };

  return (
    <div style={{
      height: '100dvh', maxWidth: 480, margin: '0 auto',
      background: 'linear-gradient(160deg, #7B2FF7 0%, #F107A3 35%, #FF6B35 65%, #FFD700 100%)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
    }}>

      {/* ── Decorative background blobs ── */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        {/* Top-left glow */}
        <div style={{
          position: 'absolute', top: -80, left: -80,
          width: 280, height: 280, borderRadius: '50%',
          background: 'rgba(255,255,255,0.12)',
          filter: 'blur(40px)',
        }} />
        {/* Center glow */}
        <div style={{
          position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 320, height: 320, borderRadius: '50%',
          background: 'rgba(255,180,80,0.18)',
          filter: 'blur(60px)',
        }} />
        {/* Bottom-right glow */}
        <div style={{
          position: 'absolute', bottom: -60, right: -60,
          width: 240, height: 240, borderRadius: '50%',
          background: 'rgba(123,47,247,0.25)',
          filter: 'blur(50px)',
        }} />
        {/* Sparkle dots */}
        {[{x:'15%',y:'18%',s:6},{x:'82%',y:'12%',s:4},{x:'70%',y:'28%',s:5},{x:'10%',y:'55%',s:4},{x:'88%',y:'48%',s:6},{x:'25%',y:'72%',s:5},{x:'75%',y:'68%',s:4}].map((d,i) => (
          <div key={i} style={{
            position: 'absolute', left: d.x, top: d.y,
            width: d.s, height: d.s, borderRadius: '50%',
            background: 'rgba(255,255,255,0.7)',
            boxShadow: '0 0 6px 2px rgba(255,255,255,0.5)',
          }} />
        ))}
      </div>

      {/* ── Currency pills — floating top center, no header bar ── */}
      <div style={{
        position: 'absolute', top: 16, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', gap: 8,
        zIndex: 10,
        padding: '0 16px',
      }}>
        {/* Coins pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'rgba(255,255,255,0.88)',
          borderRadius: 999,
          boxShadow: '0 3px 16px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.9) inset',
          border: '1.5px solid rgba(255,200,130,0.7)',
          padding: '6px 12px 6px 10px',
        }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>🪙</span>
          <span style={{ fontFamily: 'Fredoka One, Nunito, sans-serif', fontSize: 15, color: '#7A4A10', letterSpacing: 0.3, fontWeight: 700 }}>1,240</span>
          <span style={{
            fontSize: 11, color: '#E8745A', fontWeight: 900,
            background: 'rgba(232,116,90,0.15)', borderRadius: 999,
            padding: '1px 6px', marginLeft: 2,
          }}>+</span>
        </div>

        {/* Gems pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'rgba(255,255,255,0.88)',
          borderRadius: 999,
          boxShadow: '0 3px 16px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.9) inset',
          border: '1.5px solid rgba(180,160,240,0.7)',
          padding: '6px 12px 6px 10px',
        }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>💎</span>
          <span style={{ fontFamily: 'Fredoka One, Nunito, sans-serif', fontSize: 15, color: '#4A3A8A', letterSpacing: 0.3, fontWeight: 700 }}>48</span>
          <span style={{
            fontSize: 11, color: '#7B6FD0', fontWeight: 900,
            background: 'rgba(123,111,208,0.15)', borderRadius: 999,
            padding: '1px 6px', marginLeft: 2,
          }}>+</span>
        </div>

        {/* Lives pill — separate */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'rgba(255,255,255,0.88)',
          borderRadius: 999,
          boxShadow: '0 3px 16px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.9) inset',
          border: '1.5px solid rgba(255,160,180,0.6)',
          padding: '6px 14px 6px 10px',
        }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>❤️</span>
          <span style={{ fontFamily: 'Fredoka One, Nunito, sans-serif', fontSize: 15, color: '#C83060', letterSpacing: 0.3, fontWeight: 700 }}>5</span>
        </div>
      </div>

      {/* ── Hero area ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        paddingTop: 80, paddingBottom: 20,
        gap: 0, position: 'relative', zIndex: 1,
      }}>
        {/* Game title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 160, damping: 16 }}
          style={{ textAlign: 'center', marginBottom: 8, position: 'relative', zIndex: 1 }}
        >
          <div style={{
            fontFamily: 'Fredoka One, Nunito, sans-serif',
            fontSize: 58, lineHeight: 1,
            color: '#FFFFFF',
            textShadow: '0 4px 0 rgba(0,0,0,0.25), 0 8px 32px rgba(0,0,0,0.2)',
            letterSpacing: 2,
          }}>CatSort</div>
          <div style={{
            fontFamily: 'Caveat, cursive', fontSize: 20,
            color: 'rgba(255,255,255,0.85)', marginTop: 2,
            textShadow: '0 1px 4px rgba(0,0,0,0.2)',
          }}>Stack · Sort · Vanish!</div>
        </motion.div>

        {/* Horizontally dancing cat parade */}
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 28 }}>
          {(['ginger', 'white', 'calico', 'tabby', 'siamese', 'black'] as CoatId[]).map((c, i) => (
            <motion.div
              key={c}
              animate={{
                x: [0, i % 2 === 0 ? 6 : -6, 0],
                rotate: [0, i % 2 === 0 ? 12 : -12, 0],
                y: [0, -4, 0],
              }}
              transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.12, ease: 'easeInOut' }}
            >
              <CatImg coat={c} size={52} />
            </motion.div>
          ))}
        </div>

        {/* Level N play button — big, bottom of hero */}
        <motion.button
          whileTap={{ scale: 0.94 }}
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
          onClick={onPlay}
          style={{
            width: 'calc(100% - 48px)', maxWidth: 320,
            padding: '18px 24px',
            borderRadius: 999,
            background: `linear-gradient(135deg, #3DD68C 0%, #22C55E 50%, #16A34A 100%)`,
            color: '#fff',
            fontFamily: 'Fredoka One, Nunito, sans-serif',
            fontSize: 22,
            fontWeight: 700,
            border: 'none', cursor: 'pointer',
            boxShadow: '0 6px 0 #15803D, 0 10px 32px rgba(34,197,94,0.45)',
            letterSpacing: 0.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          <span>▶</span>
          <span>Level {nextLevel.id}</span>
          <span style={{ fontSize: 16, opacity: 0.85 }}>🐾</span>
        </motion.button>
      </div>

      {/* ── Footer tab bar ── */}
      <div style={{
        flexShrink: 0,
        background: 'rgba(255,255,255,0.15)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1.5px solid rgba(255,255,255,0.3)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
        position: 'relative', zIndex: 2,
        display: 'flex',
        paddingBottom: 'env(safe-area-inset-bottom, 8px)',
      }}>
        {FOOTER_TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <motion.button
              key={tab.id}
              whileTap={{ scale: 0.88 }}
              onClick={() => handleTabPress(tab.id)}
              style={{
                flex: 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 3,
                padding: '10px 4px 8px',
                background: 'none', border: 'none', cursor: 'pointer',
                position: 'relative',
              }}
            >
              {/* Active indicator dot */}
              {isActive && (
                <motion.div
                  layoutId="activeTabDot"
                  style={{
                    position: 'absolute', top: 6,
                    width: 28, height: 3, borderRadius: 999,
                    background: `linear-gradient(90deg, #FFD700, #FFA500)`,
                  }}
                />
              )}
              <span style={{ fontSize: 22, lineHeight: 1 }}>{tab.icon}</span>
              <span style={{
                fontFamily: 'Fredoka One, Nunito, sans-serif',
                fontSize: 11, fontWeight: 700,
                color: isActive ? '#FFD700' : 'rgba(255,255,255,0.65)',
                letterSpacing: 0.2,
              }}>{tab.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Game board ───────────────────────────────────────────────────────────────

function GameBoard({ state, onTap, onPause, onUndo, onAddMoves, undoAvailable, vanishHighlightIds, catItemRefs, onMute, muted }: {
  state: GameState;
  onTap: (containerId: string, e: React.MouseEvent, towerCenterX: number, towerCenterY: number) => void;
  onPause: () => void;
  onUndo: () => void;
  onAddMoves: () => void;
  undoAvailable: boolean;
  onMute: () => void;
  muted: boolean;
  vanishHighlightIds: Set<string>;
  catItemRefs: React.MutableRefObject<Map<string, HTMLElement>>;
}) {
  const cfg = state.levelConfig!;
  const isBoss = cfg.isBoss;
  const hasChunk = !!state.chunk;

  const bgStyle = isBoss
    ? { background: 'linear-gradient(180deg, #2A2848 0%, #1A1630 50%, #2A2040 100%)' }
    : { background: 'linear-gradient(180deg, #FFE4F4 0%, #FFF0E8 40%, #E8F4FF 100%)' };

  return (
    <div style={{
      height: '100dvh', maxWidth: 480, margin: '0 auto',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      ...bgStyle,
    }}>
      {/* Currency bar — always on very top */}
      <CurrencyBar isBoss={isBoss} />
      <HUD state={state} onPause={onPause} isBoss={isBoss} onMute={onMute} muted={muted} />

      {/* Big hypercasual MERGE N badge */}
      <div style={{
        display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4, flexShrink: 0,
      }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          style={{
            fontFamily: 'Fredoka One, Nunito, sans-serif',
            fontSize: 32,
            letterSpacing: 1,
            color: '#FFF',
            background: isBoss
              ? 'linear-gradient(180deg, #9B8BFF 0%, #6B5BEE 100%)'
              : 'linear-gradient(180deg, #FF9EBC 0%, #E8607A 100%)',
            borderRadius: 999,
            padding: '6px 28px',
            boxShadow: isBoss
              ? '0 5px 0 #3A30AA, 0 8px 20px rgba(107,91,238,0.4)'
              : '0 5px 0 #B83050, 0 8px 20px rgba(232,96,122,0.4)',
            border: '3px solid rgba(255,255,255,0.5)',
            textShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        >
          MERGE {cfg.mergeSizeK}
        </motion.div>
      </div>

      {/* Tower area — vertically centered */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '4px 8px 8px',
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
              catItemRefs={catItemRefs}
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

// ─── Sound Engine ────────────────────────────────────────────────────────────

function useSoundEngine() {
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);

  // Lazy-init AudioContext on first user gesture
  const getCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Start BGM once on mount
  useEffect(() => {
    const audio = new Audio('/assets/bgm_main.mp3');
    audio.loop = true;
    audio.volume = 0.35;
    bgmRef.current = audio;
    const play = () => { audio.play().catch(() => {}); };
    document.addEventListener('pointerdown', play, { once: true });
    return () => {
      document.removeEventListener('pointerdown', play);
      audio.pause();
    };
  }, []);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (bgmRef.current) bgmRef.current.volume = next ? 0 : 0.35;
  }, []);

  // Procedural purr: soft filtered noise burst
  const playPurr = useCallback(() => {
    if (mutedRef.current) return;
    try {
      const ctx = getCtx();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 280;
      filter.Q.value = 3.5;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.55, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      src.start();
    } catch {}
  }, []);

  // Procedural meow: FM synthesis sweep
  const playMeow = useCallback(() => {
    if (mutedRef.current) return;
    try {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(380, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.08);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.22);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.22);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.45, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.28);
    } catch {}
  }, []);

  // Win jingle from file
  const playWin = useCallback(() => {
    if (mutedRef.current) return;
    try {
      const a = new Audio('/assets/sfx_win.mp3');
      a.volume = 0.7;
      a.play().catch(() => {});
    } catch {}
  }, []);

  // Lose jingle from file
  const playLose = useCallback(() => {
    if (mutedRef.current) return;
    try {
      const a = new Audio('/assets/sfx_lose.mp3');
      a.volume = 0.7;
      a.play().catch(() => {});
    } catch {}
  }, []);

  return { playPurr, playMeow, playWin, playLose, toggleMute, muted };
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const { playPurr, playMeow, playWin, playLose, toggleMute, muted } = useSoundEngine();
  const [screen, setScreen] = useState<'title' | 'worldMap' | 'playing' | 'paused'>('title');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [completedLevels, setCompletedLevels] = useState<Record<number, number>>({});
  const [showChain, setShowChain] = useState(0);
  const [prevState, setPrevState] = useState<GameState | null>(null); // for undo
  // Staged vanish animation
  const [vanishHighlightIds, setVanishHighlightIds] = useState<Set<string>>(new Set());
  const [isAnimating, setIsAnimating] = useState(false);
  // Separate particles state so burst can fire independently of gameState updates (no React batching lag)
  const [burst, setBurst] = useState<Particle[]>([]);

  const chainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Map of item-id → DOM element for computing vanish midpoint
  const catItemRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Play lose sound when level fails
  useEffect(() => {
    if (gameState?.phase === 'levelFail') playLose();
  }, [gameState?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Auto-clear burst particles after animation completes
  useEffect(() => {
    if (burst.length) {
      const t = setTimeout(() => setBurst([]), 1200);
      return () => clearTimeout(t);
    }
  }, [burst]);

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

  /** Compute screen midpoint of a set of item IDs from their DOM nodes */
  const getVanishMidpoint = (ids: string[]): { x: number; y: number } => {
    const rects = ids
      .map(id => catItemRefs.current.get(id)?.getBoundingClientRect())
      .filter((r): r is DOMRect => !!r);
    if (!rects.length) return { x: 200, y: 350 };
    const avgX = rects.reduce((s, r) => s + r.left + r.width / 2, 0) / rects.length;
    const avgY = rects.reduce((s, r) => s + r.top + r.height / 2, 0) / rects.length;
    return { x: avgX, y: avgY };
  };

  const handleTap = useCallback((containerId: string, event: React.MouseEvent, towerCenterX = 200, towerCenterY = 350) => {
    if (!gameState || gameState.phase !== 'playing') return;
    if (isAnimating) return; // block input during vanish sequence

    if (!gameState.chunk) {
      // Grab phase
      const next = grabChunk(gameState, containerId);
      if (next.chunk) {
        playPurr();
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

      // ── Staged vanish sequence — hypercasual timing ─────────────────────────
      // Timing: 60ms settle → 250ms glow show → pop + burst → 220ms gap
      const SHOW_MS = 60;    // near-instant settle after placement
      const SHAKE_MS = 600;  // 0.6s glow (250 + 350ms) so player clearly sees the vanish
      const GAP_MS = 220;    // brief pause so chain cats are visible before next step
      const STEP_MS = SHOW_MS + SHAKE_MS + GAP_MS;

      setIsAnimating(true);

      steps.forEach((step, i) => {
        const stepStart = i * STEP_MS;

        // 1. Show pre-state (full stack including cats about to vanish)
        const t1 = setTimeout(() => {
          setGameState(step.preState);
          setVanishHighlightIds(new Set());
        }, stepStart);

        // 2. Highlight the vanishing cats (glow)
        const t2 = setTimeout(() => {
          setVanishHighlightIds(new Set(step.vanishingIds));
        }, stepStart + SHOW_MS);

        // 2b. Fire burst 50ms after glow starts
        const t2b = setTimeout(() => {
          playMeow();
          const mid = getVanishMidpoint(step.vanishingIds);
          const heartCount = 7 + step.vanishingIds.length * 2;
          setBurst(spawnParticles(mid.x, mid.y, heartCount));
        }, stepStart + SHOW_MS + 50);

        // 3. Pop: remove cats from state after glow
        const t3 = setTimeout(() => {
          setVanishHighlightIds(new Set());
          setGameState(prev => prev ? { ...step.postState, particles: [] } : step.postState);
          if (i >= 1) {
            setShowChain(i + 1);
            if (chainTimerRef.current) clearTimeout(chainTimerRef.current);
            chainTimerRef.current = setTimeout(() => setShowChain(0), 1200);
          }
          const bubble = makeBubble('purr ♥', (event.clientX ?? 160) - 20, (event.clientY ?? 300) - 60);
          setGameState(prev => prev ? { ...prev, speechBubbles: [bubble] } : prev);
        }, stepStart + SHOW_MS + SHAKE_MS);

        animTimersRef.current.push(t1, t2, t2b, t3);
      });

      // 4. After all steps, commit the final resolved state
      const finalT = setTimeout(() => {
        setGameState({ ...result.newState, particles: [] });
        setVanishHighlightIds(new Set());
        setIsAnimating(false);

        if (result.won && gameState.levelConfig) {
          playWin();
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
    return <TitleScreen onPlay={() => { const idx = Math.min(Object.keys(completedLevels).length, LEVELS.length - 1); startLevel(idx); setScreen('playing'); }} completedLevels={completedLevels} />;
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
        catItemRefs={catItemRefs}
        onMute={toggleMute}
        muted={muted}
      />

      <AnimatePresence>
        {gameState.chunk && <FloatingChunk chunk={gameState.chunk} />}
      </AnimatePresence>

      <SpeechBubbleLayer bubbles={gameState.speechBubbles} />
      <ParticleLayer particles={burst} />
      <GameMessage message={gameState.message} />
      <ChainBanner chain={showChain} isBoss={isBoss} />

      <AnimatePresence>
        {gameState.phase === 'levelComplete' && (
          <LevelCompleteOverlay
            state={gameState}
            onNext={() => startLevel(gameState.currentLevelIndex + 1)}
            onReplay={() => startLevel(gameState.currentLevelIndex)}
            onMenu={() => setScreen('title')}
          />
        )}
        {screen === 'playing' && gameState?.phase === 'levelFail' && (
          <LevelFailOverlay
            onReplay={() => startLevel(gameState.currentLevelIndex)}
            onMenu={() => setScreen('title')}
          />
        )}
        {screen === 'paused' && (
          <PauseOverlay
            onResume={() => setScreen('playing')}
            onMenu={() => setScreen('title')}
            isBoss={isBoss}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
