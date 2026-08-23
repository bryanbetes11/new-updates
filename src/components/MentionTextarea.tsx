import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { Avatar } from './Avatar';
import { CalendarDays } from 'lucide-react';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  gender: string | null;
  mentionHandle?: string;
  mentionLabel?: string;
  mentionDescription?: string;
  mentionType?: 'person' | 'everyone' | 'event';
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  rows?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  profiles?: Profile[];
  onFocus?: React.FocusEventHandler<HTMLTextAreaElement>;
  onPointerDown?: React.PointerEventHandler<HTMLTextAreaElement>;
  onScroll?: React.UIEventHandler<HTMLTextAreaElement>;
  onClick?: React.MouseEventHandler<HTMLTextAreaElement>;
}

export function MentionTextarea({
  value,
  onChange,
  placeholder,
  className = '',
  style,
  rows = 1,
  onKeyDown,
  textareaRef: externalRef,
  profiles: providedProfiles,
  onFocus,
  onPointerDown,
  onScroll,
  onClick,
}: MentionTextareaProps) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const ref = externalRef || internalRef;

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [dropdownRect, setDropdownRect] = useState<{ bottom: number; left: number; width: number; maxHeight: number } | null>(null);

  useEffect(() => {
    if (providedProfiles) {
      setProfiles(providedProfiles);
      return;
    }

    supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url, gender')
      .order('first_name')
      .then(({ data }) => setProfiles((data || []) as Profile[]));
  }, [providedProfiles]);

  // The controlled value is the source of truth while typing. Reading the
  // active token from it keeps filtering live on mobile browsers where a
  // selection update can arrive after React's change event.
  const selectionEnd = ref.current?.selectionStart ?? value.length;
  const liveMentionMatch = value.slice(0, selectionEnd).match(/@(\w*)$/) ?? value.match(/@(\w*)$/);
  const liveMentionQuery = liveMentionMatch ? liveMentionMatch[1] : query;
  const filtered = profiles.filter(p => {
    if (!liveMentionQuery) return true;
    const terms = [
      p.first_name,
      p.last_name,
      p.mentionHandle,
      p.mentionLabel,
    ].filter(Boolean)
      .flatMap(value => value!.toLowerCase().split(/[\s_]+/));
    return terms.some(term => term.startsWith(liveMentionQuery.toLowerCase()));
  }).slice(0, 6);

  const computeDropdownPosition = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportWidth = viewport?.width ?? window.innerWidth;
    const viewportOffsetLeft = viewport?.offsetLeft ?? 0;
    const viewportOffsetTop = viewport?.offsetTop ?? 0;
    const composerTop = rect.top - viewportOffsetTop;
    const isPhone = viewportWidth < 640;
    const width = Math.min(Math.max(rect.width + (isPhone ? 104 : 0), isPhone ? 320 : 260), viewportWidth - 16);
    const left = Math.min(Math.max(rect.left - viewportOffsetLeft - (isPhone ? 52 : 0), 8), viewportWidth - width - 8);
    // This portal is positioned in the layout viewport. Use the composer's
    // physical position so a mobile visualViewport resize cannot place the
    // picker below the software keyboard.
    const bottom = Math.max(8, window.innerHeight - rect.top + 8);
    const maxHeight = Math.min(isPhone ? 360 : 320, Math.max(isPhone ? 180 : 144, composerTop - 16));

    setDropdownRect({
      bottom,
      left,
      width,
      maxHeight,
    });
  }, [ref]);

  useEffect(() => {
    if (showDropdown) computeDropdownPosition();
  }, [showDropdown, query, computeDropdownPosition]);

  useEffect(() => {
    if (!showDropdown) return;
    window.addEventListener('resize', computeDropdownPosition);
    window.addEventListener('scroll', computeDropdownPosition, true);
    window.visualViewport?.addEventListener('resize', computeDropdownPosition);
    window.visualViewport?.addEventListener('scroll', computeDropdownPosition);
    return () => {
      window.removeEventListener('resize', computeDropdownPosition);
      window.removeEventListener('scroll', computeDropdownPosition, true);
      window.visualViewport?.removeEventListener('resize', computeDropdownPosition);
      window.visualViewport?.removeEventListener('scroll', computeDropdownPosition);
    };
  }, [showDropdown, computeDropdownPosition]);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const syncMentionState = (text: string, cursor: number) => {
    const atMatch = text.slice(0, cursor).match(/@(\w*)$/);
    if (atMatch) {
      setMentionStart(cursor - atMatch[0].length);
      setQuery(atMatch[1]);
      setShowDropdown(true);
      setActiveIndex(0);
      return;
    }
    setShowDropdown(false);
    setMentionStart(null);
    setQuery('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    autoResize(e.target);
    onChange(text);
    syncMentionState(text, e.target.selectionStart);
  };

  const insertMention = (profile: Profile) => {
    if (mentionStart === null) return;
    const cursor = ref.current?.selectionStart ?? value.length;
    const before = value.slice(0, mentionStart);
    const after = value.slice(cursor);
    const mentionHandle = profile.mentionHandle ?? `${profile.first_name} ${profile.last_name}`
      .trim()
      .replace(/\s+/g, '_');
    const mention = `@${mentionHandle}`;
    const newValue = `${before}${mention} ${after}`;
    onChange(newValue);
    setShowDropdown(false);
    setMentionStart(null);
    setQuery('');
    setTimeout(() => {
      const el = ref.current;
      if (el) {
        const pos = before.length + mention.length + 1;
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filtered[activeIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowDropdown(false);
        return;
      }
    }
    onKeyDown?.(e);
  };

  const getPrefix = (gender: string | null) => {
    if (gender === 'male') return 'Bro. ';
    if (gender === 'female') return 'Sis. ';
    return '';
  };

  return (
    <div className="relative min-w-0 flex-1 self-stretch">
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onInput={event => syncMentionState(event.currentTarget.value, event.currentTarget.selectionStart)}
        onClick={e => {
          if (showDropdown) computeDropdownPosition();
          onClick?.(e);
        }}
        onScroll={e => {
          if (showDropdown) computeDropdownPosition();
          onScroll?.(e);
        }}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        onPointerDown={onPointerDown}
        placeholder={placeholder}
        className={`block w-full min-w-0 ${className}`}
        style={style}
        rows={rows}
      />
      {showDropdown && filtered.length > 0 && dropdownRect &&
        createPortal(
          <div
            className="fixed z-[9999] touch-pan-y overflow-y-auto overscroll-contain rounded-2xl bg-white dark:bg-[#1c1b1e] ring-1 ring-black/[0.08] dark:ring-white/[0.1] shadow-2xl"
            style={{
              bottom: dropdownRect.bottom,
              left: dropdownRect.left,
              width: dropdownRect.width,
              maxHeight: dropdownRect.maxHeight,
            }}
          >
            {filtered.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onPointerDown={e => { e.preventDefault(); insertMention(p); }}
                className={`w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors ${
                  i === activeIndex
                    ? 'bg-brand-50 dark:bg-brand-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                }`}
              >
                {p.mentionType === 'everyone' ? (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[15px] font-black text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/10">
                    @
                  </span>
                ) : p.mentionType === 'event' ? (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600 ring-1 ring-violet-100 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/10">
                    <CalendarDays className="h-4 w-4" />
                  </span>
                ) : (
                  <Avatar src={p.avatar_url} firstName={p.first_name} lastName={p.last_name} size="sm" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {p.mentionLabel ?? `${getPrefix(p.gender)}${p.first_name} ${p.last_name}`}
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                    @{p.mentionHandle ?? `${p.first_name}_${p.last_name}`}
                  </p>
                  {p.mentionDescription && (
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{p.mentionDescription}</p>
                  )}
                </div>
              </button>
            ))}
          </div>,
          document.body
        )
      }
    </div>
  );
}
