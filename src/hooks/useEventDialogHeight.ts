import { useLayoutEffect, useRef } from 'react';

// Keep the dialog steady across tabs, using the tallest panel at the current width.
export function useEventDialogHeight(enabled: boolean) {
  const contentRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!enabled || !content) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const dialog = content.closest<HTMLElement>('[role="dialog"]');
      const page = content.querySelector<HTMLElement>('.event-detail-theme');
      if (!dialog || !page) return;
      if (window.innerWidth < 640) { dialog.style.removeProperty('height'); return; }
      const panels = Array.from(page.querySelectorAll<HTMLElement>('[role="tabpanel"][id^="event-panel-"]'));
      const active = panels.find(panel => !panel.hidden);
      if (!active) { dialog.style.removeProperty('height'); return; }
      const activeHeight = active.offsetHeight;
      const panelWidth = active.getBoundingClientRect().width;
      let tallest = activeHeight;
      for (const panel of panels) {
        if (!panel.hidden) continue;
        const previousStyle = panel.getAttribute('style');
        // Hidden panels stay hidden to users and assistive technology while measured.
        Object.assign(panel.style, {
          display: 'block', position: 'absolute', visibility: 'hidden',
          pointerEvents: 'none', width: `${panelWidth}px`, top: '0', left: '0',
        });
        tallest = Math.max(tallest, panel.offsetHeight);
        if (previousStyle === null) panel.removeAttribute('style');
        else panel.setAttribute('style', previousStyle);
      }
      const border = dialog.offsetHeight - dialog.clientHeight;
      const height = Math.ceil(page.offsetHeight - activeHeight + tallest + border);
      const nextHeight = `${height}px`;
      if (dialog.style.height !== nextHeight) dialog.style.height = nextHeight;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const sizes = new ResizeObserver(schedule);
    sizes.observe(content);
    const changes = new MutationObserver(schedule);
    changes.observe(content, { subtree: true, childList: true, characterData: true });
    window.addEventListener('resize', schedule);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      sizes.disconnect(); changes.disconnect();
      window.removeEventListener('resize', schedule);
      content.closest<HTMLElement>('[role="dialog"]')?.style.removeProperty('height');
    };
  }, [enabled]);
  return contentRef;
}
