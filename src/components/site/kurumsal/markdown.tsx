import { Fragment } from "react";
import Link from "next/link";
import type { TocItem } from "./toc";

/**
 * Minimal, dependency-free Markdown renderer for DB-authored articles
 * (blog posts, knowledge-base articles). Supports ## / ### headings (with
 * ids for the table of contents), paragraphs, - / * and 1. lists, ``` code
 * fences, > quotes, | tables |, **bold**, `code` and [links](url).
 * Raw HTML is never interpreted.
 */

type Block =
  | { type: "h2" | "h3"; text: string; id: string }
  | { type: "p"; text: string }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "code"; text: string; lang?: string }
  | { type: "quote"; text: string }
  | { type: "table"; head: string[]; rows: string[][] };

const trMap: Record<string, string> = {
  ç: "c", ğ: "g", ı: "i", İ: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", Ö: "o", Ş: "s", Ü: "u",
};

export function slugifyHeading(text: string) {
  return (
    text
      .replace(/[çğıİöşüÇĞÖŞÜ]/g, (c) => trMap[c] ?? c)
      .toLowerCase()
      .replace(/[*`_[\]()]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "bolum"
  );
}

function splitRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function parseMarkdown(content: string): { blocks: Block[]; toc: TocItem[] } {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  const toc: TocItem[] = [];
  const used = new Map<string, number>();
  let paragraph: string[] = [];

  const uniqueId = (text: string) => {
    const base = slugifyHeading(text);
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    return n === 0 ? base : `${base}-${n + 1}`;
  };
  const flush = () => {
    if (paragraph.length) blocks.push({ type: "p", text: paragraph.join(" ") });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      flush();
      continue;
    }

    if (trimmed.startsWith("```")) {
      flush();
      const lang = trimmed.slice(3).trim() || undefined;
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        code.push(lines[i]);
        i++;
      }
      blocks.push({ type: "code", text: code.join("\n"), lang });
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flush();
      const text = heading[2].replace(/\*\*/g, "").trim();
      // # and ## map to h2 (the page already has the h1); ###+ to h3.
      const type = heading[1].length <= 2 ? "h2" : "h3";
      const id = uniqueId(text);
      blocks.push({ type, text, id });
      toc.push({ id, title: text, level: type === "h2" ? 2 : 3 });
      continue;
    }

    if (/^[-*]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) {
      flush();
      const ordered = /^\d+[.)]\s+/.test(trimmed);
      const pattern = ordered ? /^\d+[.)]\s+/ : /^[-*]\s+/;
      const items: string[] = [];
      while (i < lines.length && pattern.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(pattern, ""));
        i++;
      }
      i--;
      blocks.push({ type: ordered ? "ol" : "ul", items });
      continue;
    }

    if (trimmed.startsWith("|")) {
      flush();
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const row = splitRow(lines[i]);
        if (!row.every((cell) => /^:?-{2,}:?$/.test(cell))) rows.push(row);
        i++;
      }
      i--;
      if (rows.length) blocks.push({ type: "table", head: rows[0], rows: rows.slice(1) });
      continue;
    }

    if (trimmed.startsWith(">")) {
      flush();
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quote.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      i--;
      blocks.push({ type: "quote", text: quote.join(" ") });
      continue;
    }

    paragraph.push(trimmed);
  }
  flush();

  return { blocks, toc };
}

/** Inline formatting: **bold**, `code`, [label](url). */
function Inline({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      parts.push(<code key={key++}>{token.slice(1, -1)}</code>);
    } else {
      const m = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      const href = m?.[2] ?? "#";
      const label = m?.[1] ?? token;
      if (href.startsWith("/")) {
        parts.push(
          <Link key={key++} href={href}>
            {label}
          </Link>
        );
      } else if (/^https?:\/\//.test(href) || href.startsWith("mailto:")) {
        parts.push(
          <a key={key++} href={href} rel="noopener noreferrer" target={href.startsWith("http") ? "_blank" : undefined}>
            {label}
          </a>
        );
      } else {
        parts.push(label);
      }
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

export function MarkdownBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        switch (block.type) {
          case "h2":
            return (
              <h2 key={index} id={block.id}>
                {block.text}
              </h2>
            );
          case "h3":
            return (
              <h3 key={index} id={block.id}>
                {block.text}
              </h3>
            );
          case "p":
            return (
              <p key={index}>
                <Inline text={block.text} />
              </p>
            );
          case "ul":
          case "ol": {
            const List = block.type;
            return (
              <List key={index}>
                {block.items.map((item, j) => (
                  <li key={j}>
                    <Inline text={item} />
                  </li>
                ))}
              </List>
            );
          }
          case "code":
            return (
              <pre
                key={index}
                className="not-prose my-6 overflow-x-auto rounded-lg border bg-muted/50 p-4 font-mono text-[13px] leading-relaxed text-foreground"
              >
                <code>{block.text}</code>
              </pre>
            );
          case "quote":
            return (
              <blockquote
                key={index}
                className="not-prose my-6 border-l-2 border-foreground/60 pl-5 text-base italic leading-relaxed text-foreground/80"
              >
                <Inline text={block.text} />
              </blockquote>
            );
          case "table":
            return (
              <div key={index} className="not-prose my-6 overflow-hidden rounded-lg border">
                {/* Desktop table */}
                <table className="hidden w-full text-left text-sm sm:table">
                  <thead className="bg-muted/50">
                    <tr>
                      {block.head.map((cell, j) => (
                        <th key={j} scope="col" className="px-4 py-3 font-medium text-foreground">
                          <Inline text={cell} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {block.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, j) => (
                          <td key={j} className="px-4 py-3 align-top text-muted-foreground">
                            <Inline text={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Phone cards */}
                <dl className="divide-y sm:hidden">
                  {block.rows.map((row, r) => (
                    <div key={r} className="space-y-1.5 p-4 text-sm">
                      {row.map((cell, j) => (
                        <Fragment key={j}>
                          <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                            {block.head[j] ?? ""}
                          </dt>
                          <dd className={j === 0 ? "font-medium text-foreground" : "text-foreground/80"}>
                            <Inline text={cell} />
                          </dd>
                        </Fragment>
                      ))}
                    </div>
                  ))}
                </dl>
              </div>
            );
          default:
            return null;
        }
      })}
    </>
  );
}

/** Rough reading time in minutes (200 wpm). */
export function readingMinutes(content: string) {
  return Math.max(1, Math.ceil(content.split(/\s+/).filter(Boolean).length / 200));
}
