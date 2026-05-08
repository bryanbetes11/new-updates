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
  rows?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
}

export function MentionTextarea({
  value,
  onChange,
  placeholder,
  className = '',
  rows = 1,
  onKeyDown,
  textareaRef: externalRef,
}: MentionTextareaProps) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const ref = externalRef || internalRef;

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url, gender')
      .order('first_name')
      .then(({ data }) => setProfiles((data || []) as Profile[]));
  }, []);

  const filtered = profiles.filter(p => {
    if (!query) return true;
    const full = `${p.first_name} ${p.last_name}`.toLowerCase();
    return full.includes(query.toLowerCase());
  }).slice(0, 6);

  const computeDropdownPosition = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const DROPDOWN_HEIGHT = Math.min(filtered.length, 6) * 52 + 8;
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;

    let top: number;
    if (spaceAbove >= DROPDOWN_HEIGHT || spaceAbove > spaceBelow) {
      top = rect.top - DROPDOWN_HEIGHT - 4;
    } else {
      top = rect.bottom + 4;
    }

    setDropdownRect({
      top,
      left: rect.left,
      width: Math.max(rect.width, 260),
    });
  }, [ref, filtered.length]);

  useEffect(() => {
    if (showDropdown) computeDropdownPosition();
  }, [showDropdown, query, computeDropdownPosition]);

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
    const mention = `@${profile.first_name}_${profile.last_name}`;
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
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
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
