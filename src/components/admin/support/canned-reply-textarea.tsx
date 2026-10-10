"use client";

import * as React from "react";
import { MessageSquareText } from "lucide-react";
import { filterCannedReplies, findSlashQuery, replaceSlashQuery } from "@/lib/support/slash-command";
import { cn } from "@/lib/utils";

export interface CannedReplyOption {
  id: string;
  title: string;
  body: string;
}

/**
 * Reply textarea with a "/" canned reply picker: typing "/" at the start of
 * a line or after a space opens a searchable list (↑ ↓ to move, Enter or
 * Tab to insert, Esc to close). The chosen reply replaces the "/query".
 * Textarea + listbox follow the ARIA combobox pattern.
 */
export function CannedReplyTextarea({
  id,
  value,
  onChange,
  replies,
  render,
  onInserted,
  placeholder,
  rows = 6,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  replies: CannedReplyOption[];
  /** Body with variables filled in. */
  render: (reply: CannedReplyOption) => string;
  onInserted?: (reply: CannedReplyOption) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const [token, setToken] = React.useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = React.useState(0);
  const [dismissedAt, setDismissedAt] = React.useState<number | null>(null);
  const listId = `${id}-canned-list`;

  const matches = React.useMemo(() => (token ? filterCannedReplies(replies, token.query) : []), [token, replies]);
  const open = Boolean(token) && replies.length > 0;

  const sync = (el: HTMLTextAreaElement) => {
    const caret = el.selectionStart ?? el.value.length;
    const found = el.selectionStart === el.selectionEnd ? findSlashQuery(el.value, caret) : null;
    if (!found) {
      setDismissedAt(null);
      setToken(null);
      return;
    }
    // Esc closes the list until a new "/" is typed.
    if (dismissedAt === found.start) {
      setToken(null);
      return;
    }
    if (!token || token.query !== found.query) setActive(0);
    setToken(found);
  };

  const insert = (reply: CannedReplyOption) => {
    const el = ref.current;
    if (!el || !token) return;
    const caret = el.selectionStart ?? value.length;
    const next = replaceSlashQuery(value, token.start, caret, render(reply));
    onChange(next.text);
    setToken(null);
    setDismissedAt(null);
    onInserted?.(reply);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown" && matches.length) {
      e.preventDefault();
      setActive((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp" && matches.length) {
      e.preventDefault();
      setActive((i) => (i - 1 + matches.length) % matches.length);
    } else if ((e.key === "Enter" || e.key === "Tab") && matches[active] && !e.shiftKey) {
      e.preventDefault();
      insert(matches[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setDismissedAt(token?.start ?? null);
      setToken(null);
    }
  };

  const activeId = open && matches[active] ? `${listId}-${matches[active].id}` : undefined;

  return (
    <div className="relative">
      <textarea
        ref={ref}
        id={id}
        value={value}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={activeId}
        aria-describedby={`${id}-hint`}
        onChange={(e) => {
          onChange(e.target.value);
          sync(e.target);
        }}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) sync(e.currentTarget);
        }}
        onClick={(e) => sync(e.currentTarget)}
        onBlur={() => setToken(null)}
        className="flex min-h-[60px] w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
      />
      <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted-foreground">
        {replies.length ? (
          <>
            Hazır yanıt eklemek için <kbd className="rounded border bg-muted px-1 font-mono text-[11px]">/</kbd> yazın.
          </>
        ) : (
          "Bu departman için hazır yanıt yok."
        )}
      </p>

      {open ? (
        <div className="absolute inset-x-0 top-full z-20 -mt-5 rounded-md border bg-popover text-popover-foreground shadow-lg md:left-3 md:right-auto md:w-96">
          <p className="flex items-center gap-2 border-b px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            <MessageSquareText aria-hidden className="size-3.5" />
            Hazır yanıtlar{token?.query ? ` · “${token.query}”` : ""}
          </p>
          {matches.length ? (
            <ul id={listId} role="listbox" aria-label="Hazır yanıtlar" className="max-h-64 overflow-y-auto p-1">
              {matches.map((reply, i) => (
                <li
                  key={reply.id}
                  id={`${listId}-${reply.id}`}
                  role="option"
                  aria-selected={i === active}
                  // mousedown keeps the textarea focused (no blur before the click).
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insert(reply);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn("cursor-pointer rounded px-2.5 py-2", i === active ? "bg-muted" : "hover:bg-muted/60")}
                >
                  <p className="truncate text-sm font-medium">{reply.title}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{reply.body.replace(/\s+/g, " ")}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p id={listId} role="listbox" aria-label="Hazır yanıtlar" className="px-3 py-3 text-sm text-muted-foreground">
              Eşleşen hazır yanıt yok.
            </p>
          )}
          <p className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">↑ ↓ seç · Enter ekle · Esc kapat</p>
        </div>
      ) : null}
    </div>
  );
}
