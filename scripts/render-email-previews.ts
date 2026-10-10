/**
 * Renders every notification template with its sample data to static files
 * (HTML light/dark preview + plain-text part) for visual review:
 *
 *   pnpm exec tsx --env-file=.env scripts/render-email-previews.ts <out-dir>
 *
 * Uses the built-in (TS) templates and the default brand; no DB access.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { forceDarkPreview } from "@/lib/notifications/layout";
import { DEFAULT_BRAND, renderNotification } from "@/lib/notifications/render";
import { listTemplates } from "@/lib/notifications/templates";

const outDir = path.resolve(process.argv[2] ?? "email-previews");
const ctx = { brand: DEFAULT_BRAND, baseUrl: "https://kleacore.com" };

async function main() {
  await mkdir(outDir, { recursive: true });
  const rows: string[] = [];
  for (const template of listTemplates()) {
    const rendered = renderNotification(template.key, template.sample, ctx, { logo: "inline" });
    await writeFile(path.join(outDir, `${template.key}.html`), rendered.html);
    await writeFile(path.join(outDir, `${template.key}.dark.html`), forceDarkPreview(rendered.html));
    await writeFile(path.join(outDir, `${template.key}.txt`), `Konu: ${rendered.subject}\nÖnizleme: ${rendered.preheader}\n\n${rendered.text}\n`);
    rows.push(`<li><a href="${template.key}.html">${template.key}</a> — ${template.label} (<a href="${template.key}.dark.html">koyu</a>, <a href="${template.key}.txt">metin</a>)</li>`);
  }
  await writeFile(path.join(outDir, "index.html"), `<!doctype html><meta charset="utf-8"><title>E-posta şablonları</title><ul>${rows.join("\n")}</ul>`);
  console.log(`${rows.length} templates → ${outDir}`);
}

void main();
