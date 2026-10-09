import type { ReactNode } from 'react';

const TOKEN =
  /(\/\/[^\n]*|<!--[\s\S]*?-->)|('[^'\n]*'|"[^"\n]*"|`[^`]*`)|\b(import|from|const|export|function|return|new|await)\b|(<\/?[A-Za-z][\w.-]*|\/?>)/g;
const CLASSES = ['tok-comment', 'tok-string', 'tok-keyword', 'tok-tag'];

/** A small highlighter: enough for the handful of snippets on this page. */
export function Code({ children, label }: { children: string; label: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of children.matchAll(TOKEN)) {
    const index = match.index;
    if (index > last) parts.push(children.slice(last, index));
    const group = match.slice(1).findIndex((value) => value !== undefined);
    parts.push(
      <span key={index} className={CLASSES[group]}>
        {match[0]}
      </span>,
    );
    last = index + match[0].length;
  }
  parts.push(children.slice(last));

  return (
    <pre className="code" tabIndex={0} aria-label={label}>
      <code>{parts}</code>
    </pre>
  );
}
