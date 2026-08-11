const MINOR_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "from",
  "in",
  "into",
  "nor",
  "of",
  "on",
  "or",
  "per",
  "the",
  "to",
  "via",
  "vs",
]);

const WORD_PATTERN = /[A-Za-z][A-Za-z'’.-]*/g;

function hasIntentionalCasing(word: string) {
  const letters = word.replace(/[^A-Za-z]/g, "");
  if (!letters) return true;
  return letters === letters.toUpperCase() || /[A-Z]/.test(letters.slice(1));
}

function titleCaseWord(word: string, firstWord: boolean) {
  const lower = word.toLowerCase();
  if (!firstWord && MINOR_WORDS.has(lower)) return lower;
  if (hasIntentionalCasing(word)) return word;
  return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
}

export function toInteractiveTitleCase(label: string) {
  let wordIndex = 0;
  return label.replace(WORD_PATTERN, (word) => {
    const formatted = titleCaseWord(word, wordIndex === 0);
    wordIndex += 1;
    return formatted;
  });
}

function visibleTextNodes(element: HTMLElement) {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest("svg, [data-preserve-label-case]")) {
        return NodeFilter.FILTER_REJECT;
      }
      return node.textContent?.trim()
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP;
    },
  });

  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes;
}

export function formatInteractiveElementLabel(element: HTMLElement) {
  const nodes = visibleTextNodes(element);
  const primaryLabel = nodes[0];
  if (!primaryLabel) return;

  const current = primaryLabel.textContent || "";
  const formatted = toInteractiveTitleCase(current);
  if (formatted !== current) primaryLabel.textContent = formatted;
}
