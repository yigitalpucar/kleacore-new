"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { Activity, KeyRound, PackagePlus, ShieldCheck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TerminalStep {
  id: string;
  title: string;
  description: string;
  icon: "ssh" | "install" | "monitor" | "firewall";
  command: string;
  output: string[];
}

const icons: Record<TerminalStep["icon"], LucideIcon> = {
  ssh: KeyRound,
  install: PackagePlus,
  monitor: Activity,
  firewall: ShieldCheck,
};

/**
 * Root-access showcase (adapted from Aceternity "feature section with
 * terminal"): a list of steps on one side, a typing terminal on the other.
 * Monochrome, silent, and fully rendered when reduced motion is preferred.
 * The terminal content is illustrative, not a live session.
 */
export function RootTerminal({ steps, host = "vds" }: { steps: TerminalStep[]; host?: string }) {
  const [active, setActive] = useState(steps[0]?.id);
  const step = steps.find((s) => s.id === active) ?? steps[0];
  const baseId = useId();

  if (!step) return null;

  return (
    <div className="grid overflow-hidden rounded-2xl border bg-muted/40 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] dark:bg-muted/20">
      <div className="p-3 sm:p-4 md:p-6" role="tablist" aria-label="Root erişimi örnekleri" aria-orientation="vertical">
        <ul className="space-y-2">
          {steps.map((s) => {
            const Icon = icons[s.icon];
            const selected = s.id === step.id;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  role="tab"
                  id={`${baseId}-tab-${s.id}`}
                  aria-selected={selected}
                  aria-controls={`${baseId}-panel`}
                  onClick={() => setActive(s.id)}
                  className={cn(
                    "w-full rounded-xl p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "bg-background shadow-[0_6px_10px_-6px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
                      : "hover:bg-background/60"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-md border",
                        selected ? "bg-foreground text-background" : "bg-background text-foreground/80"
                      )}
                    >
                      <Icon aria-hidden className="size-4" />
                    </span>
                    <span className="font-medium">{s.title}</span>
                  </span>
                  <AnimatePresence initial={false}>
                    {selected ? (
                      <motion.span
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                        className="block overflow-hidden"
                      >
                        <span className="block pl-11 pt-2 text-sm leading-relaxed text-muted-foreground">
                          {s.description}
                        </span>
                      </motion.span>
                    ) : null}
                  </AnimatePresence>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${step.id}`}
        className="relative flex items-center border-t p-3 sm:p-4 md:p-6 lg:border-l lg:border-t-0"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid mask-radial-center opacity-70" />
        <Terminal key={step.id} step={step} host={host} />
      </div>
    </div>
  );
}

function Terminal({ step, host }: { step: TerminalStep; host: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const reduce = useReducedMotion();
  const [typedRaw, setTyped] = useState(0);
  const [shownRaw, setShown] = useState(0);
  const typed = reduce ? step.command.length : typedRaw;
  const shown = reduce ? step.output.length : shownRaw;

  useEffect(() => {
    if (reduce || !inView) return;
    if (typed < step.command.length) {
      const t = setTimeout(() => setTyped((n) => n + 1), 32 + Math.random() * 28);
      return () => clearTimeout(t);
    }
    if (shown < step.output.length) {
      const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 380 : 170);
      return () => clearTimeout(t);
    }
  }, [reduce, inView, typed, shown, step]);

  const typing = typed < step.command.length;
  const done = !typing && shown >= step.output.length;

  return (
    <div
      ref={ref}
      className="dark relative z-10 w-full overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 text-neutral-200 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.45)]"
    >
      <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3">
        <span aria-hidden className="flex gap-1.5">
          <span className="size-2.5 rounded-full border border-neutral-700 bg-neutral-800" />
          <span className="size-2.5 rounded-full border border-neutral-700 bg-neutral-800" />
          <span className="size-2.5 rounded-full border border-neutral-700 bg-neutral-800" />
        </span>
        <span className="ml-2 truncate font-mono text-xs text-neutral-500">root@{host}: ~</span>
      </div>
      <div className="h-64 overflow-hidden p-4 font-mono text-[12px] leading-relaxed sm:h-72 sm:text-[13px]">
        <p className="sr-only">
          Örnek komut: {step.command}. Örnek çıktı: {step.output.join(" ")}
        </p>
        <div aria-hidden>
          <div className="whitespace-pre-wrap [overflow-wrap:anywhere]">
            <Prompt host={host} />
            <Highlighted text={step.command.slice(0, typed)} />
            {typing ? <Caret /> : null}
          </div>
          {step.output.slice(0, shown).map((line, i) => (
            <div key={i} className="whitespace-pre-wrap [overflow-wrap:anywhere] text-neutral-400">
              {line || " "}
            </div>
          ))}
          {done ? (
            <div>
              <Prompt host={host} />
              <Caret blink />
            </div>
          ) : null}
        </div>
      </div>
      <p className="border-t border-neutral-800 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
        Temsili örnek · gerçek oturum değildir
      </p>
    </div>
  );
}

function Prompt({ host }: { host: string }) {
  return (
    <span className="text-neutral-500">
      <span className="text-neutral-300">root@{host}</span>:~#{" "}
    </span>
  );
}

function Caret({ blink = false }: { blink?: boolean }) {
  return (
    <span
      className={cn(
        "ml-0.5 inline-block h-4 w-2 translate-y-0.5 bg-neutral-300",
        blink && "motion-safe:animate-pulse"
      )}
    />
  );
}

/** Minimal shell highlighting in greys (monochrome kit). */
function Highlighted({ text }: { text: string }) {
  const parts = text.split(/(\s+)/);
  let first = true;
  return (
    <>
      {parts.map((word, i) => {
        if (/^\s+$/.test(word) || word === "") return <span key={i}>{word}</span>;
        let cls = "text-neutral-300";
        if (first || /^(&&|\|)$/.test(word)) {
          cls = "font-semibold text-white";
          first = /^(&&|\|)$/.test(word);
        } else if (word.startsWith("-")) cls = "text-neutral-400";
        else if (word.startsWith("#")) cls = "text-neutral-500";
        return (
          <span key={i} className={cls}>
            {word}
          </span>
        );
      })}
    </>
  );
}
