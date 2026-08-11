import { useEffect } from "react";
import { formatInteractiveElementLabel } from "../lib/interactiveLabelCase";

const INTERACTIVE_SELECTOR = "button:not([data-preserve-label-case]), [role='button']:not([data-preserve-label-case])";

function formatNode(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const interactive = node.parentElement?.closest<HTMLElement>(INTERACTIVE_SELECTOR);
    if (interactive) formatInteractiveElementLabel(interactive);
    return;
  }

  if (!(node instanceof HTMLElement)) return;
  if (node.matches(INTERACTIVE_SELECTOR)) formatInteractiveElementLabel(node);
  node.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR).forEach(formatInteractiveElementLabel);
}

export function InteractiveLabelCase() {
  useEffect(() => {
    formatNode(document.body);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") formatNode(mutation.target);
        mutation.addedNodes.forEach(formatNode);
      }
    });

    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}

