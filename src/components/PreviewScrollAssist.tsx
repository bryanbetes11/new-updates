import { useEffect, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import { Link } from 'react-router-dom';

export function PreviewScrollAssist({ nextTo }: { nextTo?: string }) {
  const [canScroll, setCanScroll] = useState(false);
  const [atBottom, setAtBottom] = useState(false);

  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>('[data-launch-scroll]');
    if (!scroller) return;

    const update = () => {
      setCanScroll(scroller.scrollHeight > scroller.clientHeight + 8);
      setAtBottom(scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 8);
    };

    update();
    scroller.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    if (scroller.firstElementChild) observer.observe(scroller.firstElementChild);

    return () => {
      scroller.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, []);

  if (!canScroll) return null;

  const controlClass = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#1ed760] px-6 text-sm font-black text-black shadow-[0_8px_30px_rgba(0,0,0,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
      {atBottom && nextTo ? (
        <Link to={nextTo} className={`pointer-events-auto ${controlClass}`}>
          Next step <ArrowRight className="h-4 w-4" />
        </Link>
      ) : (
        <button
          type="button"
          className={`pointer-events-auto ${controlClass}`}
          onClick={() => {
            const scroller = document.querySelector<HTMLElement>('[data-launch-scroll]');
            if (!scroller) return;
            scroller.scrollBy({ top: atBottom ? -scroller.scrollHeight : scroller.clientHeight * 0.75, behavior: 'smooth' });
          }}
        >
          {atBottom ? <>Back to top <ArrowUp className="h-4 w-4" /></> : <>More below <ArrowDown className="h-4 w-4" /></>}
        </button>
      )}
    </div>
  );
}
