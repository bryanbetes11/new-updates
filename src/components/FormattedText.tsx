import { Fragment, useMemo } from 'react';

interface FormattedTextProps {
  text: string;
  className?: string;
}

type TextNode = {
  type: 'text' | 'bold' | 'italic' | 'strikethrough' | 'code' | 'boldItalic' | 'mention';
  content: string;
};

function parseFormattedText(text: string): TextNode[] {
  const nodes: TextNode[] = [];
  const patterns = [
    { regex: /\*\*\*(.+?)\*\*\*/g, type: 'boldItalic' as const },
    { regex: /\*\*(.+?)\*\*/g, type: 'bold' as const },
    { regex: /\*(.+?)\*/g, type: 'italic' as const },
    { regex: /__(.+?)__/g, type: 'bold' as const },
    { regex: /_(.+?)_/g, type: 'italic' as const },
    { regex: /~~(.+?)~~/g, type: 'strikethrough' as const },
    { regex: /`(.+?)`/g, type: 'code' as const },
    { regex: /@(\w+_\w+)/g, type: 'mention' as const },
  ];

  interface Match {
    start: number;
    end: number;
    content: string;
    type: TextNode['type'];
  }

  const allMatches: Match[] = [];

  for (const { regex, type } of patterns) {
    const patternRegex = new RegExp(regex.source, 'g');
    let match;
    while ((match = patternRegex.exec(text)) !== null) {
      const overlaps = allMatches.some(
        m => (match!.index >= m.start && match!.index < m.end) ||
             (match!.index + match![0].length > m.start && match!.index + match![0].length <= m.end)
      );
      if (!overlaps) {
        allMatches.push({
          start: match.index,
          end: match.index + match[0].length,
          content: match[1],
          type,
        });
      }
    }
  }

  allMatches.sort((a, b) => a.start - b.start);

  let lastIndex = 0;
  for (const match of allMatches) {
    if (match.start > lastIndex) {
      nodes.push({ type: 'text', content: text.slice(lastIndex, match.start) });
    }
    nodes.push({ type: match.type, content: match.content });
    lastIndex = match.end;
  }

  if (lastIndex < text.length) {
    nodes.push({ type: 'text', content: text.slice(lastIndex) });
  }

  if (nodes.length === 0) {
    nodes.push({ type: 'text', content: text });
  }

  return nodes;
}

function renderNode(node: TextNode, index: number) {
  switch (node.type) {
    case 'bold':
      return <strong key={index} className="font-semibold">{node.content}</strong>;
    case 'italic':
      return <em key={index} className="italic">{node.content}</em>;
    case 'boldItalic':
      return <strong key={index} className="font-semibold italic">{node.content}</strong>;
    case 'strikethrough':
      return <del key={index} className="line-through">{node.content}</del>;
    case 'code':
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-mono text-[0.9em]"
        >
          {node.content}
        </code>
      );
    case 'mention': {
      const displayName = node.content.replace(/_/g, ' ');
      return (
        <span
          key={index}
          className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-brand-50 dark:bg-brand-900/25 text-brand-700 dark:text-brand-300 font-semibold text-[0.92em]"
        >
          @{displayName}
        </span>
      );
    }
    default:
      return <Fragment key={index}>{node.content}</Fragment>;
  }
}

export function FormattedText({ text, className = '' }: FormattedTextProps) {
  const lines = useMemo(() => text.split('\n'), [text]);

  return (
    <span className={className}>
      {lines.map((line, lineIndex) => (
        <Fragment key={lineIndex}>
          {lineIndex > 0 && <br />}
          {parseFormattedText(line).map((node, nodeIndex) => renderNode(node, nodeIndex))}
        </Fragment>
      ))}
    </span>
  );
}
