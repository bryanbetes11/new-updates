import { motion } from 'framer-motion';
import type { MouseEvent } from 'react';

export const REACTION_OPTIONS = [
  { emoji: '👍', label: 'Like', surface: 'from-sky-400/30 to-blue-500/10' },
  { emoji: '❤️', label: 'Love', surface: 'from-rose-400/30 to-red-500/10' },
  { emoji: '😂', label: 'Haha', surface: 'from-amber-300/30 to-yellow-500/10' },
  { emoji: '😊', label: 'Yay', surface: 'from-emerald-300/30 to-green-500/10' },
  { emoji: '😮', label: 'Wow', surface: 'from-violet-300/30 to-purple-500/10' },
  { emoji: '😢', label: 'Sad', surface: 'from-cyan-300/30 to-sky-500/10' },
  { emoji: '😠', label: 'Angry', surface: 'from-orange-400/30 to-red-500/10' },
] as const;

export type ReactionEmoji = (typeof REACTION_OPTIONS)[number]['emoji'];

export function EmojiReactionPicker({
  onPick,
  className = '',
  animateEntrance = false,
}: {
  onPick: (emoji: ReactionEmoji, event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  animateEntrance?: boolean;
}) {
  return (
    <div
      className={`grid w-[min(22rem,calc(100vw-3rem))] grid-cols-7 gap-1 rounded-2xl border border-gray-200/80 bg-white p-2 shadow-2xl dark:border-white/[0.09] dark:bg-[#242426] ${className}`}
      role="menu"
      aria-label="Choose a reaction"
    >
      {REACTION_OPTIONS.map((option, index) => (
        <motion.button
          key={option.emoji}
          type="button"
          initial={animateEntrance ? { opacity: 0, y: -8, scale: 0.82 } : false}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={animateEntrance
            ? { delay: index * 0.025, duration: 0.18, ease: [0.16, 1, 0.3, 1] }
            : undefined}
          whileHover={{ y: -2, scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          onClick={event => onPick(option.emoji, event)}
          className="group flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 text-center transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.07]"
          aria-label={`React with ${option.label}`}
          role="menuitem"
        >
          <span className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br text-[17px] ${option.surface}`}>
            {option.emoji}
          </span>
          <span className="max-w-full truncate text-[8px] font-semibold leading-none text-gray-500 dark:text-white/45">
            {option.label}
          </span>
        </motion.button>
      ))}
    </div>
  );
}
