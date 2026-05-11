import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { Avatar } from './Avatar';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  gender: string | null;
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
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const getCaretRect = useCallback((el: HTMLTextAreaElement, position: number) => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const mirror = document.createElement('div');
    const marker = document.createElement('span');
    const properties = [
      'boxSizing',
      'width',
      'height',
      'overflowX',
      'overflowY',
      'borderTopWidth',
      'borderRightWidth',
      'borderBottomWidth',
      'borderLeftWidth',
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
      'fontStyle',
      'fontVariant',
      'fontWeight',
      'fontStretch',
      'fontSize',
      'lineHeight',
      'fontFamily',
      'textAlign',
      'textTransform',
      'textIndent',
      'textDecoration',
      'letterSpacing',
      'wordSpacing',
      'tabSize',
      'MozTabSize',
    ] as const;

    mirror.style.position = 'fixed';
    mirror.style.top = `${rect.top}px`;
    mirror.style.left = `${rect.left}px`;
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.overflowWrap = 'break-word';
    mirror.style.wordBreak = 'break-word';

    properties.forEach(property => {
      (mirror.style as unknown as Record<string, string>)[property] =
        (style as unknown as Record<string, string>)[property] || '';
    });

    mirror.textContent = el.value.slice(0, position);
    marker.textContent = el.value.slice(position, position + 1) || '\u200b';
    mirror.appendChild(marker);
    document.body.appendChild(mirror);

    const markerRect = marker.getBoundingClientRect();
    document.body.removeChild(mirror);

    return {
      top: markerRect.top - el.scrollTop,
      left: markerRect.left - el.scrollLeft,
      bottom: markerRect.bottom - el.scrollTop,
    };
  }, []);

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

  const filtered = profiles.filter(p => {
    if (!query) return true;
    const full = `${p.first_name} ${p.last_name}`.toLowerCase();
    return full.includes(query.toLowerCase());
  }).slice(0, 6);

  const computeDropdownPosition = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const caret = getCaretRect(el, el.selectionStart ?? value.length);
    const DROPDOWN_HEIGHT = Math.min(filtered.length, 6) * 52 + 8;
    const DROPDOWN_WIDTH = Math.min(Math.max(rect.width, 260), window.innerWidth - 16);
    const spaceAbove = caret.top;
    const spaceBelow = window.innerHeight - caret.bottom;

    let top: number;
    if (spaceAbove >= DROPDOWN_HEIGHT || spaceAbove > spaceBelow) {
      top = caret.top - DROPDOWN_HEIGHT - 6;
    } else {
      top = caret.bottom + 6;
    }

    const left = Math.min(
      Math.max(caret.left, 8),
      window.innerWidth - DROPDOWN_WIDTH - 8
    );

    setDropdownRect({
      top,
      left,
      width: DROPDOWN_WIDTH,
    });
  }, [ref, filtered.length, getCaretRect, value.length]);

  useEffect(() => {
    if (showDropdown) computeDropdownPosition();
  }, [showDropdown, query, computeDropdownPosition]);

  useEffect(() => {
    if (!showDropdown) return;
    window.addEventListener('resize', computeDropdownPosition);
    window.addEventListener('scroll', computeDropdownPosition, true);
    return () => {
      window.removeEventListener('resize', computeDropdownPosition);
      window.removeEventListener('scroll', computeDropdownPosition, true);
    };
  }, [showDropdown, computeDropdownPosition]);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    autoResize(e.target);
    onChange(text);

    const cursor = e.target.selectionStart;
    const textBefore = text.slice(0, cursor);
    const atMatch = textBefore.match(/@(\w*)$/);

    if (atMatch) {
      setMentionStart(cursor - atMatch[0].length);
      setQuery(atMatch[1]);
      setShowDropdown(true);
      setActiveIndex(0);
    } else {
      setShowDropdown(false);
      setMentionStart(null);
      setQuery('');
    }
  };

  const insertMention = (profile: Profile) => {
    if (mentionStart === null) return;
    const cursor = ref.current?.selectionStart ?? value.length;
    const before = value.slice(0, mentionStart);
    const after = value.slice(cursor);
    const mentionHandle = `${profile.first_name} ${profile.last_name}`
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
            className="fixed z-[9999] rounded-xl bg-white dark:bg-[#1c1b1e] ring-1 ring-black/[0.08] dark:ring-white/[0.1] shadow-2xl overflow-hidden"
            style={{
              top: dropdownRect.top,
              left: dropdownRect.left,
              width: dropdownRect.width,
            }}
          >
            {filtered.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onPointerDown={e => { e.preventDefault(); insertMention(p); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                  i === activeIndex
                    ? 'bg-brand-50 dark:bg-brand-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                }`}
              >
                <Avatar src={p.avatar_url} firstName={p.first_name} lastName={p.last_name} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {getPrefix(p.gender)}{p.first_name} {p.last_name}
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">@{p.first_name}_{p.last_name}</p>
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
