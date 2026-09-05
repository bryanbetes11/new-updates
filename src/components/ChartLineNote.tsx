import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, CornerDownRight } from 'lucide-react';

export function ChartLineNote({ text, scope, fontSize, onEdit }: {
  text: string;
  scope: 'self' | 'team';
  fontSize: number;
  onEdit: () => void;
}) {
  const noteRef = useRef<HTMLDivElement>(null);
  const [inline, setInline] = useState(false);

  useLayoutEffect(() => {
    const note = noteRef.current;
    const row = note?.parentElement?.parentElement;
    const chart = row?.firstElementChild;
    if (!note || !row || !chart) return;
    const measure = () => {
      const noteBox = note.getBoundingClientRect();
      const chartBox = chart.getBoundingClientRect();
      setInline(noteBox.left >= chartBox.right - 1 && noteBox.top < chartBox.bottom);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    observer.observe(chart);
    observer.observe(note);
    return () => observer.disconnect();
  }, [text, fontSize]);

  const Arrow = inline ? ArrowRight : CornerDownRight;
  return (
    <div ref={noteRef} className={`flex max-w-full items-center gap-1.5 ${scope === 'self' ? 'text-cyan-600 dark:text-cyan-300' : 'text-amber-600 dark:text-amber-300'}`}>
      <Arrow aria-hidden="true" className="h-5 w-5 shrink-0 stroke-[1.75]" />
      <button type="button" onClick={onEdit}
        className={`w-fit max-w-[calc(100%-1.625rem)] rounded-sm border px-1.5 py-0.5 text-left font-medium leading-snug shadow-none transition ${scope === 'self'
          ? 'border-cyan-300 bg-cyan-100 text-cyan-950 hover:bg-cyan-200 dark:border-cyan-300 dark:bg-cyan-200 dark:text-cyan-950 dark:hover:bg-cyan-100'
          : 'border-amber-300 bg-amber-100 text-amber-950 hover:bg-amber-200 dark:border-amber-300 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100'}`}
        style={{ fontFamily: '"Comic Sans MS", "Bradley Hand", cursive', fontSize }}>
        <span className="whitespace-pre-wrap">{text}</span>
      </button>
    </div>
  );
}
