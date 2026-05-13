/**
 * CatSort — Main Game Page
 * Design: Kawaii Storybook Illustration
 * - Warm cream background with pastel watercolor wash
 * - Round cat blobs with expressive faces
 * - Spring-physics animations via framer-motion
 * - Floating hearts & sparkles on vanish
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  COLOR_MAP,
  COLOR_DARK,
  LEVELS,
  type ColorId,
  type Container,
  type GameState,
  type Particle,
  cancelGrab,
  grabChunk,
  initLevelState,
  placeChunk,
} from '@/lib/gameEngine';

// ─── Constants ────────────────────────────────────────────────────────────────

const BG_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663433221304/8d7memWqyMUwTMNHiWq6rm/catsort_bg-9e8RqsQhcD5WYb6ywXaZvR.webp';
const HERO_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663433221304/8d7memWqyMUwTMNHiWq6rm/catsort_hero-ZTtAEPf43wzdrSPznV6QZM.webp';
const WIN_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663433221304/8d7memWqyMUwTMNHiWq6rm/catsort_win-isNakYxMtNTemSvmYwKbGM.webp';

// ─── Cat face SVG ─────────────────────────────────────────────────────────────

function CatFace({ color, size = 44, isWild = false, isLocked = false, isBomb = false }: {
  color: ColorId; size?: number; isWild?: boolean; isLocked?: boolean; isBomb?: boolean;
}) {
  const fill = COLOR_MAP[color];
  const dark = COLOR_DARK[color];
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <ellipse cx="22" cy="24" rx="18" ry="16" fill={fill} stroke={dark} strokeWidth="1.5" />
      {/* Ears */}
      <polygon points="6,14 10,4 16,14" fill={fill} stroke={dark} strokeWidth="1.5" strokeLinejoin="round" />
      <polygon points="28,14 34,4 38,14" fill={fill} stroke={dark} strokeWidth="1.5" strokeLinejoin="round" />
      {/* Inner ears */}
      <polygon points="8,13 11,6 15,13" fill={dark} opacity="0.3" />
      <polygon points="29,13 33,6 37,13" fill={dark} opacity="0.3" />
      {/* Eyes */}
      <ellipse cx="16" cy="22" rx="3" ry="3.5" fill="#2D2D2D" />
      <ellipse cx="28" cy="22" rx="3" ry="3.5" fill="#2D2D2D" />
      <circle cx="17" cy="21" r="1" fill="white" />
      <circle cx="29" cy="21" r="1" fill="white" />
      {/* Nose */}
      <ellipse cx="22" cy="28" rx="2" ry="1.5" fill={dark} opacity="0.6" />
      {/* Mouth */}
      <path d="M19 30 Q22 33 25 30" stroke={dark} strokeWidth="1.2" fill="none" strokeLinecap="round" />
      {/* Whiskers */}
      <line x1="4" y1="26" x2="14" y2="27" stroke={dark} strokeWidth="0.8" opacity="0.5" />
      <line x1="4" y1="29" x2="14" y2="29" stroke={dark} strokeWidth="0.8" opacity="0.5" />
      <line x1="30" y1="27" x2="40" y2="26" stroke={dark} strokeWidth="0.8" opacity="0.5" />
      <line x1="30" y1="29" x2="40" y2="29" stroke={dark} strokeWidth="0.8" opacity="0.5" />
      {/* Overlays */}
      {isWild && <text x="22" y="18" textAnchor="middle" fontSize="10" fill="#FFD700">★</text>}
      {isLocked && <text x="22" y="18" textAnchor="middle" fontSize="10" fill="#888">🔒</text>}
      {isBomb && <text x="22" y="18" textAnchor="middle" fontSize="10">💣</text>}
    </svg>
  );
}

// ─── Tower / Container component ──────────────────────────────────────────────

function TowerContainer({
  container,
  isSelected,
  hasChunk,
  onTap,
  mergeSizeK,
}: {
  container: Container;
  isSelected: boolean;
  hasChunk: boolean;
  onTap: (e: React.MouseEvent) => void;
  mergeSizeK: number;
}) {
  const isFull = container.stack.length >= container.capacity;
  const isEmpty = container.stack.length === 0;
  const canGrab = !hasChunk && container.stack.length >= container.grabNumber;
  const canPlace = hasChunk && !container.oneWayOut;

  const borderColor = isSelected
    ? '#F4A0A0'
    : container.colorLocked
    ? COLOR_MAP[container.colorLocked]
    : container.frozen
    ? '#A0C8F4'
    : '#D4C4A8';

  const bgColor = container.frozen
    ? 'rgba(160,200,244,0.15)'
    : container.colorLocked
    ? `${COLOR_MAP[container.colorLocked]}22`
    : 'rgba(255,248,240,0.85)';

  return (
    <motion.div
      onClick={onTap}
      whileTap={{ scale: 0.96 }}
      animate={isSelected ? { y: [-2, 2, -2], transition: { repeat: Infinity, duration: 0.6 } } : { y: 0 }}
      className="relative flex flex-col items-center cursor-pointer select-none"
      style={{ minWidth: 64 }}
    >
      {/* Tower label: grab number N */}
      <div
        className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center z-10"
        style={{ background: borderColor, color: '#2D2D2D', border: `1.5px solid ${borderColor}` }}
      >
        {container.grabNumber}
      </div>

      {/* Special badges */}
      {container.colorLocked && (
        <div className="absolute -top-1 right-0 text-xs z-10" title={`Only ${container.colorLocked} cats`}>
          🔒
        </div>
      )}
      {container.frozen && (
        <div className="absolute -top-1 left-0 text-xs z-10" title="Frozen">❄️</div>
      )}
      {container.doubleVanish && (
        <div className="absolute -top-1 right-0 text-xs z-10" title="Double score">×2</div>
      )}
      {container.oneWayOut && (
        <div className="absolute -top-1 left-0 text-xs z-10" title="One-way out">↑</div>
      )}
      {container.oneWayIn && (
        <div className="absolute -top-1 left-0 text-xs z-10" title="One-way in">↓</div>
      )}

      {/* Tower body */}
      <motion.div
        animate={
          isSelected
            ? { boxShadow: `0 0 0 3px ${borderColor}, 0 4px 16px rgba(0,0,0,0.15)` }
            : canPlace
            ? { boxShadow: `0 0 0 2px ${borderColor}88, 0 2px 8px rgba(0,0,0,0.1)` }
            : { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }
        }
        className="relative rounded-2xl overflow-hidden"
        style={{
          width: 64,
          minHeight: 200,
          background: bgColor,
          border: `2px solid ${borderColor}`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '6px 6px 8px',
          gap: 3,
        }}
      >
        {/* Capacity indicator dots */}
        <div className="absolute top-2 left-0 right-0 flex justify-center gap-0.5">
          {Array.from({ length: container.capacity }).map((_, i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: 4,
                height: 4,
                background: i < container.stack.length ? '#C4A882' : '#E8DCC8',
              }}
            />
          ))}
        </div>

        {/* Cat stack */}
        <div className="flex flex-col-reverse gap-1 mt-6">
          <AnimatePresence>
            {container.stack.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ scale: 0.5, opacity: 0, y: -20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.3, opacity: 0, y: -30 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: idx * 0.03 }}
                className="flex justify-center"
              >
                <CatFace
                  color={item.color}
                  size={46}
                  isWild={item.isWild}
                  isLocked={item.isLocked}
                  isBomb={item.isBomb}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Empty state */}
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center opacity-30">
            <span className="text-2xl">🐾</span>
          </div>
        )}

        {/* Full indicator */}
        {isFull && (
          <div className="absolute top-1 right-1 text-xs opacity-60">🔴</div>
        )}
      </motion.div>

      {/* Grab indicator */}
      {canGrab && !hasChunk && (
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.2 }}
          className="mt-1 text-xs text-center"
          style={{ color: '#C4A882' }}
        >
          tap
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Floating chunk indicator ─────────────────────────────────────────────────

function ChunkIndicator({ chunk }: { chunk: NonNullable<GameState['chunk']> }) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-1 pointer-events-none"
    >
      <div
        className="rounded-2xl px-3 py-2 flex flex-col items-center gap-1"
        style={{ background: 'rgba(255,248,240,0.95)', border: '2px solid #F4A0A0', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
      >
        <div className="text-xs font-semibold" style={{ color: '#C05050' }}>Carrying {chunk.items.length} cats</div>
        <div className="flex gap-1">
          {chunk.items.map((item, i) => (
            <CatFace key={i} color={item.color} size={36} />
          ))}
        </div>
        <div className="text-xs" style={{ color: '#C4A882' }}>tap a tower to place</div>
      </div>
    </motion.div>
  );
}

// ─── Particle system ──────────────────────────────────────────────────────────

function ParticleLayer({ particles }: { particles: Particle[] }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-40">
      <AnimatePresence>
        {particles.map(p => (
          <motion.div
            key={p.id}
            initial={{ x: p.x, y: p.y, scale: 1, opacity: 1 }}
            animate={{ x: p.x + p.vx * 80, y: p.y + p.vy * 80, scale: 0, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="absolute text-lg"
            style={{ fontSize: p.size }}
          >
            {p.type === 'heart' ? '💗' : p.type === 'star' ? '✨' : '⭐'}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function spawnParticles(x: number, y: number, count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${Date.now()}${i}`,
    x,
    y,
    color: '#F4A0A0',
    type: (['heart', 'star', 'sparkle'] as const)[i % 3],
    vx: (Math.random() - 0.5) * 3,
    vy: -(Math.random() * 2 + 1),
    life: 1,
    size: 16 + Math.random() * 12,
  }));
}

// ─── HUD ──────────────────────────────────────────────────────────────────────

function HUD({ state, onPause }: { state: GameState; onPause: () => void }) {
  const cfg = state.levelConfig!;
  const goalEntries = Object.entries(state.goalProgress) as [ColorId, { cleared: number; total: number }][];

  return (
    <div
      className="w-full flex items-center justify-between px-4 py-2 rounded-b-2xl"
      style={{ background: 'rgba(255,248,240,0.95)', borderBottom: '2px solid #E8DCC8', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
    >
      {/* Level + score */}
      <div className="flex flex-col">
        <div className="text-xs font-semibold" style={{ color: '#C4A882' }}>
          {cfg.isBoss ? '⚡ ' : ''}Lv {cfg.id}
        </div>
        <div className="text-lg font-bold" style={{ color: '#2D2D2D', fontFamily: 'Nunito, sans-serif' }}>
          {state.score.toLocaleString()}
        </div>
      </div>

      {/* Goal progress */}
      <div className="flex gap-2">
        {goalEntries.map(([color, prog]) => (
          <div key={color} className="flex flex-col items-center">
            <CatFace color={color} size={28} />
            <div className="text-xs font-bold" style={{ color: COLOR_DARK[color] }}>
              {prog.cleared}/{prog.total}
            </div>
          </div>
        ))}
      </div>

      {/* Budget */}
      <div className="flex flex-col items-end">
        <div className="text-xs font-semibold" style={{ color: '#C4A882' }}>moves</div>
        <div
          className="text-lg font-bold"
          style={{
            color: state.budget.movesLeft <= 5 ? '#E05050' : '#2D2D2D',
            fontFamily: 'Nunito, sans-serif',
          }}
        >
          {state.budget.movesLeft}
        </div>
      </div>

      {/* Pause */}
      <button
        onClick={onPause}
        className="ml-2 w-8 h-8 rounded-full flex items-center justify-center text-lg"
        style={{ background: '#F4E8D8', border: '1.5px solid #D4C4A8' }}
      >
        ⏸
      </button>
    </div>
  );
}

// ─── Level select screen ──────────────────────────────────────────────────────

function LevelSelect({ onSelect, completedLevels }: {
  onSelect: (idx: number) => void;
  completedLevels: Record<number, number>;
}) {
  return (
    <div
      className="min-h-screen flex flex-col items-center"
      style={{ background: '#FFF8F0', backgroundImage: `url(${BG_URL})`, backgroundSize: 'cover', backgroundPosition: 'center', overflowY: 'auto' }}
    >
      <div className="w-full max-w-sm px-4 pt-8 pb-10 flex flex-col items-center gap-6">
        <img src={HERO_URL} alt="CatSort" className="w-64 rounded-3xl shadow-lg" />
        <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 32, color: '#2D2D2D', textShadow: '0 2px 8px rgba(255,200,180,0.5)' }}>
          🐱 CatSort
        </div>
        <div className="text-sm text-center" style={{ color: '#8A7A6A', fontFamily: 'Nunito, sans-serif' }}>
          Grab cats, stack them, make them vanish!
        </div>

        {/* How to play */}
        <div
          className="w-full rounded-2xl px-4 py-3 text-sm"
          style={{ background: 'rgba(255,248,240,0.9)', border: '2px solid #E8DCC8' }}
        >
          <div className="font-bold mb-1" style={{ color: '#2D2D2D', fontFamily: 'Nunito, sans-serif' }}>How to Play</div>
          <div style={{ color: '#8A7A6A', fontFamily: 'Nunito, sans-serif', lineHeight: 1.6 }}>
            1. Tap a tower to grab its top N cats.<br />
            2. Tap another tower to place them.<br />
            3. K or more same-color cats in a row vanish!<br />
            4. Clear all goal-color cats to win. 🐾
          </div>
        </div>

        <div className="w-full flex flex-col gap-3">
          {LEVELS.map((level, idx) => {
            const stars = completedLevels[level.id] ?? 0;
            const locked = idx > 0 && !(completedLevels[LEVELS[idx - 1].id] >= 1);
            return (
              <motion.button
                key={level.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => !locked && onSelect(idx)}
                className="w-full rounded-2xl px-4 py-3 flex items-center justify-between"
                style={{
                  background: locked ? 'rgba(200,190,180,0.5)' : level.isBoss ? 'rgba(244,160,160,0.25)' : 'rgba(255,248,240,0.9)',
                  border: `2px solid ${level.isBoss ? '#F4A0A0' : '#E8DCC8'}`,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  cursor: locked ? 'not-allowed' : 'pointer',
                  opacity: locked ? 0.6 : 1,
                }}
              >
                <div className="flex flex-col items-start">
                  <div className="font-bold text-sm" style={{ color: '#2D2D2D', fontFamily: 'Nunito, sans-serif' }}>
                    {locked ? '🔒 ' : ''}{level.name}
                  </div>
                  <div className="text-xs" style={{ color: '#8A7A6A' }}>
                    K={level.mergeSizeK} · {level.budget.maxMoves} moves · {level.goalColors.join(', ')} cats
                  </div>
                </div>
                <div className="flex gap-0.5 text-lg">
                  {[1, 2, 3].map(s => (
                    <span key={s} style={{ opacity: stars >= s ? 1 : 0.25 }}>⭐</span>
                  ))}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Win / Fail overlays ──────────────────────────────────────────────────────

function LevelCompleteOverlay({ state, onNext, onReplay, onMenu }: {
  state: GameState;
  onNext: () => void;
  onReplay: () => void;
  onMenu: () => void;
}) {
  const hasNext = state.currentLevelIndex < LEVELS.length - 1;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(255,240,230,0.85)', backdropFilter: 'blur(4px)' }}
    >
      <motion.div
        initial={{ scale: 0.8, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        className="w-72 rounded-3xl p-6 flex flex-col items-center gap-4"
        style={{ background: '#FFF8F0', border: '2px solid #F4A0A0', boxShadow: '0 8px 32px rgba(244,160,160,0.3)' }}
      >
        <img src={WIN_URL} alt="Win" className="w-48 rounded-2xl" />
        <div className="text-2xl font-bold" style={{ fontFamily: 'Nunito, sans-serif', color: '#2D2D2D' }}>
          Purrfect! 🎉
        </div>
        <div className="flex gap-1 text-3xl">
          {[1, 2, 3].map(s => (
            <motion.span
              key={s}
              initial={{ scale: 0 }}
              animate={{ scale: state.stars >= s ? 1.2 : 0.8 }}
              transition={{ delay: s * 0.15, type: 'spring' }}
              style={{ opacity: state.stars >= s ? 1 : 0.25 }}
            >
              ⭐
            </motion.span>
          ))}
        </div>
        <div className="text-lg font-bold" style={{ color: '#C4A882', fontFamily: 'Nunito, sans-serif' }}>
          Score: {state.score.toLocaleString()}
        </div>
        <div className="flex flex-col gap-2 w-full">
          {hasNext && (
            <button
              onClick={onNext}
              className="w-full py-3 rounded-2xl font-bold text-white text-lg"
              style={{ background: 'linear-gradient(135deg, #F4A0A0, #C8A0F4)', fontFamily: 'Nunito, sans-serif' }}
            >
              Next Level →
            </button>
          )}
          <button
            onClick={onReplay}
            className="w-full py-2 rounded-2xl font-semibold text-sm"
            style={{ background: '#F4E8D8', color: '#8A7A6A', fontFamily: 'Nunito, sans-serif' }}
          >
            Replay
          </button>
          <button
            onClick={onMenu}
            className="w-full py-2 rounded-2xl font-semibold text-sm"
            style={{ background: '#F4E8D8', color: '#8A7A6A', fontFamily: 'Nunito, sans-serif' }}
          >
            Level Select
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function LevelFailOverlay({ state, onReplay, onMenu }: {
  state: GameState;
  onReplay: () => void;
  onMenu: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(200,160,160,0.7)', backdropFilter: 'blur(4px)' }}
    >
      <motion.div
        initial={{ scale: 0.8, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        className="w-72 rounded-3xl p-6 flex flex-col items-center gap-4"
        style={{ background: '#FFF8F0', border: '2px solid #F4A0A0', boxShadow: '0 8px 32px rgba(200,100,100,0.2)' }}
      >
        <div className="text-6xl">😿</div>
        <div className="text-2xl font-bold" style={{ fontFamily: 'Nunito, sans-serif', color: '#2D2D2D' }}>
          Out of moves!
        </div>
        <div className="text-sm text-center" style={{ color: '#8A7A6A', fontFamily: 'Nunito, sans-serif' }}>
          The cats are still mixed up... try again!
        </div>
        <div className="flex flex-col gap-2 w-full">
          <button
            onClick={onReplay}
            className="w-full py-3 rounded-2xl font-bold text-white text-lg"
            style={{ background: 'linear-gradient(135deg, #F4A0A0, #C8A0F4)', fontFamily: 'Nunito, sans-serif' }}
          >
            Try Again
          </button>
          <button
            onClick={onMenu}
            className="w-full py-2 rounded-2xl font-semibold text-sm"
            style={{ background: '#F4E8D8', color: '#8A7A6A', fontFamily: 'Nunito, sans-serif' }}
          >
            Level Select
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Pause overlay ────────────────────────────────────────────────────────────

function PauseOverlay({ onResume, onMenu }: { onResume: () => void; onMenu: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(255,240,230,0.8)', backdropFilter: 'blur(4px)' }}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="w-64 rounded-3xl p-6 flex flex-col items-center gap-4"
        style={{ background: '#FFF8F0', border: '2px solid #E8DCC8', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
      >
        <div className="text-4xl">⏸</div>
        <div className="text-xl font-bold" style={{ fontFamily: 'Nunito, sans-serif', color: '#2D2D2D' }}>Paused</div>
        <button
          onClick={onResume}
          className="w-full py-3 rounded-2xl font-bold text-white text-lg"
          style={{ background: 'linear-gradient(135deg, #F4A0A0, #C8A0F4)', fontFamily: 'Nunito, sans-serif' }}
        >
          Resume
        </button>
        <button
          onClick={onMenu}
          className="w-full py-2 rounded-2xl font-semibold text-sm"
          style={{ background: '#F4E8D8', color: '#8A7A6A', fontFamily: 'Nunito, sans-serif' }}
        >
          Level Select
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Toast message ────────────────────────────────────────────────────────────

function GameMessage({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key={message}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl text-sm font-semibold pointer-events-none"
          style={{ background: 'rgba(244,160,160,0.95)', color: '#2D2D2D', boxShadow: '0 2px 12px rgba(0,0,0,0.1)', fontFamily: 'Nunito, sans-serif' }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Chain combo banner ───────────────────────────────────────────────────────

function ChainBanner({ chain }: { chain: number }) {
  if (chain < 2) return null;
  return (
    <AnimatePresence>
      <motion.div
        key={chain}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1.1, opacity: 1 }}
        exit={{ scale: 1.5, opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none text-center"
      >
        <div className="text-4xl font-black" style={{ fontFamily: 'Nunito, sans-serif', color: '#F4A0A0', textShadow: '0 2px 8px rgba(244,160,160,0.6)' }}>
          {chain}× Combo!
        </div>
        <div className="text-2xl">{'💗'.repeat(Math.min(chain, 5))}</div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Main game board ──────────────────────────────────────────────────────────

function GameBoard({ state, onTap, onPause }: {
  state: GameState;
  onTap: (containerId: string, event: React.MouseEvent) => void;
  onPause: () => void;
}) {
  const cfg = state.levelConfig!;
  const hasChunk = !!state.chunk;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: '#FFF8F0',
        backgroundImage: `url(${BG_URL})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      {/* HUD */}
      <HUD state={state} onPause={onPause} />

      {/* Level name */}
      <div className="text-center py-2 text-sm font-bold" style={{ color: '#8A7A6A', fontFamily: 'Nunito, sans-serif' }}>
        {cfg.name}
        {cfg.isBoss && <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ background: '#F4A0A0', color: '#2D2D2D' }}>BOSS</span>}
      </div>

      {/* Towers */}
      <div className="flex-1 flex items-end justify-center pb-6 px-3">
        <div
          className="flex flex-wrap justify-center gap-2 w-full"
          style={{ maxWidth: 440 }}
        >
          {state.containers.map(container => (
            <TowerContainer
              key={container.id}
              container={container}
              isSelected={state.selectedContainerId === container.id}
              hasChunk={hasChunk}
              onTap={(e: React.MouseEvent) => onTap(container.id, e)}
              mergeSizeK={cfg.mergeSizeK}
            />
          ))}
        </div>
      </div>

      {/* Bottom info bar */}
      <div
        className="w-full px-4 py-3 flex items-center justify-between rounded-t-2xl"
        style={{ background: 'rgba(255,248,240,0.95)', borderTop: '2px solid #E8DCC8' }}
      >
        <div className="text-xs" style={{ color: '#8A7A6A', fontFamily: 'Nunito, sans-serif' }}>
          Merge {cfg.mergeSizeK} or more same-color cats to vanish them!
        </div>
        {hasChunk && (
          <button
            onClick={() => onTap('__cancel__', {} as React.MouseEvent)}
            className="text-xs px-3 py-1 rounded-full font-semibold"
            style={{ background: '#F4E8D8', color: '#8A7A6A', border: '1.5px solid #D4C4A8' }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function Home() {
  const [phase, setPhase] = useState<'title' | 'levelSelect' | 'playing' | 'paused'>('title');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [completedLevels, setCompletedLevels] = useState<Record<number, number>>({});
  const [showChain, setShowChain] = useState(0);
  const chainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-clear message
  useEffect(() => {
    if (gameState?.message) {
      if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
      msgTimerRef.current = setTimeout(() => {
        setGameState(prev => prev ? { ...prev, message: null } : prev);
      }, 1800);
    }
  }, [gameState?.message]);

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
    setPhase('playing');
  }, []);

  const handleTap = useCallback((containerId: string, event: React.MouseEvent) => {
    if (!gameState || gameState.phase !== 'playing') return;

    // Cancel grab
    if (containerId === '__cancel__') {
      setGameState(cancelGrab(gameState));
      return;
    }

    if (!gameState.chunk) {
      // Phase 1: grab
      const next = grabChunk(gameState, containerId);
      setGameState(next);
    } else {
      // Phase 2: place
      const result = placeChunk(gameState, containerId);
      if (!result.success) {
        setGameState({ ...gameState, message: result.error ?? 'Cannot place here!' });
        return;
      }

      // Spawn particles at click location
      const particles = result.vanishResults.length > 0
        ? spawnParticles(event.clientX ?? 200, event.clientY ?? 400, result.vanishResults.length * 6)
        : [];

      // Chain banner
      const chain = result.vanishResults.length;
      if (chain >= 2) {
        setShowChain(chain);
        if (chainTimerRef.current) clearTimeout(chainTimerRef.current);
        chainTimerRef.current = setTimeout(() => setShowChain(0), 1200);
      }

      setGameState({ ...result.newState, particles });

      // Record completion
      if (result.won && gameState.levelConfig) {
        const levelId = gameState.levelConfig.id;
        setCompletedLevels(prev => ({
          ...prev,
          [levelId]: Math.max(prev[levelId] ?? 0, result.newState.stars),
        }));
      }
    }
  }, [gameState]);

  // ── Title screen ──
  if (phase === 'title') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center"
        style={{ background: '#FFF8F0', backgroundImage: `url(${BG_URL})`, backgroundSize: 'cover' }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 150, damping: 15 }}
          className="flex flex-col items-center gap-6 px-8"
        >
          <img src={HERO_URL} alt="CatSort" className="w-72 rounded-3xl shadow-xl" />
          <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 40, color: '#2D2D2D', textShadow: '0 2px 12px rgba(244,160,160,0.4)' }}>
            🐱 CatSort
          </div>
          <div className="text-center text-sm" style={{ color: '#8A7A6A', fontFamily: 'Nunito, sans-serif', maxWidth: 260 }}>
            Stack cats, grab chunks, make them vanish in a cascade of hearts!
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setPhase('levelSelect')}
            className="px-10 py-4 rounded-3xl font-black text-xl text-white"
            style={{ background: 'linear-gradient(135deg, #F4A0A0, #C8A0F4)', boxShadow: '0 4px 20px rgba(244,160,160,0.5)', fontFamily: 'Nunito, sans-serif' }}
          >
            Play Now! 🐾
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // ── Level select ──
  if (phase === 'levelSelect') {
    return <LevelSelect onSelect={startLevel} completedLevels={completedLevels} />;
  }

  // ── Playing ──
  if (!gameState) return null;

  return (
    <>
      <GameBoard
        state={gameState}
        onTap={handleTap}
        onPause={() => setPhase('paused')}
      />

      {/* Floating chunk */}
      <AnimatePresence>
        {gameState.chunk && <ChunkIndicator chunk={gameState.chunk} />}
      </AnimatePresence>

      {/* Particles */}
      <ParticleLayer particles={gameState.particles} />

      {/* Messages */}
      <GameMessage message={gameState.message} />

      {/* Chain banner */}
      <ChainBanner chain={showChain} />

      {/* Overlays */}
      <AnimatePresence>
        {gameState.phase === 'levelComplete' && (
          <LevelCompleteOverlay
            state={gameState}
            onNext={() => startLevel(gameState.currentLevelIndex + 1)}
            onReplay={() => startLevel(gameState.currentLevelIndex)}
            onMenu={() => setPhase('levelSelect')}
          />
        )}
        {gameState.phase === 'levelFail' && (
          <LevelFailOverlay
            state={gameState}
            onReplay={() => startLevel(gameState.currentLevelIndex)}
            onMenu={() => setPhase('levelSelect')}
          />
        )}
        {phase === 'paused' && (
          <PauseOverlay
            onResume={() => setPhase('playing')}
            onMenu={() => setPhase('levelSelect')}
          />
        )}
      </AnimatePresence>
    </>
  );
}
