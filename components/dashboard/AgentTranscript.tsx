"use client";

import React from "react";

/**
 * Minimal markdown renderer for agent transcripts.
 *
 * The pricing agents return markdown containing headings, bullets, tables and
 * LaTeX. Pulling in react-markdown + katex for a side panel is not worth the
 * bundle, so this handles the structural cases and preserves everything else
 * verbatim rather than mangling it.
 */

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  // Split on **bold** while keeping the delimiters' content.
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={`${keyPrefix}-b${i}`} className="font-semibold text-slate-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={`${keyPrefix}-t${i}`}>{part}</React.Fragment>;
  });
}

export default function AgentTranscript({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  // Consecutive table rows get grouped into one horizontally scrollable block.
  let tableBuffer: string[] = [];

  const flushTable = (key: string) => {
    if (tableBuffer.length === 0) return;
    const content = tableBuffer.join("\n");
    tableBuffer = [];
    blocks.push(
      <div key={key} className="my-2 overflow-x-auto">
        <pre className="text-[10px] leading-relaxed text-slate-300 font-mono whitespace-pre">
          {content}
        </pre>
      </div>
    );
  };

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const key = `l${i}`;

    if (line.trim().startsWith("|")) {
      tableBuffer.push(line);
      return;
    }
    flushTable(`${key}-tbl`);

    if (!line.trim()) return;

    if (line.startsWith("---")) {
      blocks.push(<hr key={key} className="my-2.5 border-slate-800" />);
      return;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const depth = heading[1].length;
      blocks.push(
        <div
          key={key}
          className={
            depth <= 2
              ? "mt-3 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-300"
              : "mt-2.5 mb-1 text-[11px] font-semibold text-slate-200"
          }
        >
          {renderInline(heading[2], key)}
        </div>
      );
      return;
    }

    const bullet = line.match(/^(\s*)[*-]\s+(.*)$/);
    if (bullet) {
      const indent = Math.min(Math.floor(bullet[1].length / 2), 3);
      blocks.push(
        <div
          key={key}
          className="flex gap-1.5 text-[11px] leading-relaxed text-slate-300"
          style={{ paddingLeft: `${indent * 12}px` }}
        >
          <span className="text-slate-600 select-none">•</span>
          <span>{renderInline(bullet[2], key)}</span>
        </div>
      );
      return;
    }

    blocks.push(
      <p key={key} className="text-[11px] leading-relaxed text-slate-300 my-1">
        {renderInline(line, key)}
      </p>
    );
  });

  flushTable("tbl-final");

  return <div className="font-sans">{blocks}</div>;
}
