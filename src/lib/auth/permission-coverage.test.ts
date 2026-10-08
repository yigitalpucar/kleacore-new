/**
 * Static guard coverage (3.6): fails when an admin server action, an admin
 * page, an inline "use server" function or an admin route handler has no
 * permission check. New code written with `requireAdmin()` passes (ADMIN-only);
 * code with no check at all does not.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { PERMISSIONS, routePermissions, type Permission } from "./permissions";

const ROOT = path.resolve(__dirname, "../../..");
const GUARDS = ["requirePermission", "requireAnyPermission", "requireAdmin"] as const;
const PAGE_GUARDS = [...GUARDS, "requireStaff"] as const;

function walk(dir: string, match: (file: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, match));
    else if (match(full)) out.push(full);
  }
  return out;
}

function parse(file: string) {
  return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
}

type GuardCall = { name: string; permissions: string[] };

/** Every guard call inside `node` (by callee name), with string-literal arguments. */
function guardCalls(node: ts.Node, names: readonly string[]): GuardCall[] {
  const calls: GuardCall[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && names.includes(n.expression.text)) {
      calls.push({
        name: n.expression.text,
        permissions: n.arguments.filter(ts.isStringLiteralLike).map((a) => a.text),
      });
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return calls;
}

function isExported(node: ts.Node) {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function isDefaultExport(node: ts.Node) {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
}

/** Top-level functions: name → body node; plus the exported names. */
function topLevelFunctions(sf: ts.SourceFile) {
  const bodies = new Map<string, ts.Node>();
  const exported = new Set<string>();
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name && stmt.body) {
      bodies.set(stmt.name.text, stmt.body);
      if (isExported(stmt)) exported.add(stmt.name.text);
    } else if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
        if (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) {
          bodies.set(decl.name.text, decl.initializer.body);
          if (isExported(stmt)) exported.add(decl.name.text);
        }
      }
    } else if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause) && !stmt.moduleSpecifier) {
      for (const el of stmt.exportClause.elements) exported.add((el.propertyName ?? el.name).text);
    }
  }
  return { bodies, exported };
}

function invalidPermissions(calls: GuardCall[]) {
  return calls.flatMap((c) => c.permissions).filter((p) => !(PERMISSIONS as readonly string[]).includes(p));
}

const rel = (file: string) => path.relative(ROOT, file);

describe("admin server actions", () => {
  const files = walk(path.join(ROOT, "src/lib/actions/admin"), (f) => f.endsWith(".ts") && !/\.test\.ts$/.test(f));

  it("finds the action files", () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it("every exported action checks a permission", () => {
    const missing: string[] = [];
    const invalid: string[] = [];
    for (const file of files) {
      const { bodies, exported } = topLevelFunctions(parse(file));
      for (const name of exported) {
        const body = bodies.get(name);
        if (!body) continue; // types / constants
        const calls = guardCalls(body, GUARDS);
        if (calls.length === 0) missing.push(`${rel(file)} → ${name}`);
        invalid.push(...invalidPermissions(calls).map((p) => `${rel(file)} → ${name}: "${p}"`));
      }
    }
    expect(missing, "exported admin actions without requirePermission/requireAdmin").toEqual([]);
    expect(invalid, "unknown permission names").toEqual([]);
  });
});

describe("admin pages", () => {
  const pages = walk(path.join(ROOT, "src/app/yonetim"), (f) => path.basename(f) === "page.tsx");

  function routeOf(file: string) {
    const dir = path.relative(path.join(ROOT, "src/app"), path.dirname(file)).split(path.sep).join("/");
    return `/${dir}`.replace(/\[[^\]]+\]/g, "x");
  }

  it("every page checks the permission its route requires", () => {
    const problems: string[] = [];
    for (const file of pages) {
      const sf = parse(file);
      const fn = sf.statements.find((s) => ts.isFunctionDeclaration(s) && isDefaultExport(s)) as ts.FunctionDeclaration | undefined;
      if (!fn?.body) {
        problems.push(`${rel(file)}: no default export function`);
        continue;
      }
      const calls = guardCalls(fn.body, PAGE_GUARDS);
      const route = routeOf(file);
      const required = routePermissions(route);
      if (calls.length === 0) {
        problems.push(`${rel(file)}: no permission check`);
        continue;
      }
      if (calls.some((c) => c.name === "requireAdmin")) continue; // strictest
      if (required === undefined) {
        problems.push(`${rel(file)}: route ${route} is not in ADMIN_ROUTE_PERMISSIONS (use requireAdmin or map it)`);
        continue;
      }
      if (required === null) continue; // any staff
      const used = calls.flatMap((c) => c.permissions) as Permission[];
      if (used.length === 0 || used.some((p) => !required.includes(p))) {
        problems.push(`${rel(file)}: checks [${used.join(", ")}], route ${route} requires one of [${required.join(", ")}]`);
      }
    }
    expect(problems).toEqual([]);
  });
});

describe("inline server actions and admin route handlers", () => {
  it("every inline \"use server\" function under src/app checks a permission", () => {
    const files = walk(path.join(ROOT, "src/app"), (f) => /\.tsx?$/.test(f) && readFileSync(f, "utf8").includes("use server"));
    const missing: string[] = [];
    for (const file of files) {
      const sf = parse(file);
      const visit = (n: ts.Node) => {
        if ((ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n)) && n.body && ts.isBlock(n.body)) {
          const first = n.body.statements[0];
          if (first && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) && first.expression.text === "use server") {
            if (guardCalls(n.body, GUARDS).length === 0) {
              const name = ts.isFunctionDeclaration(n) && n.name ? n.name.text : "<anonymous>";
              missing.push(`${rel(file)} → ${name}`);
            }
          }
        }
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
    expect(missing).toEqual([]);
  });

  it("every /api/admin route handler checks a permission", () => {
    const files = walk(path.join(ROOT, "src/app/api/admin"), (f) => path.basename(f) === "route.ts");
    expect(files.length).toBeGreaterThan(0);
    const missing: string[] = [];
    for (const file of files) {
      const { bodies, exported } = topLevelFunctions(parse(file));
      for (const name of exported) {
        if (!/^(GET|POST|PUT|PATCH|DELETE)$/.test(name)) continue;
        const body = bodies.get(name);
        if (!body || guardCalls(body, [...GUARDS, "checkApiPermission"]).length === 0) missing.push(`${rel(file)} → ${name}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("no ADMIN-only fallbacks left", () => {
  // Every admin action/page/route is mapped to a specific permission
  // (requireAdmin would lock SUPPORT/BILLING out of things silently).
  it("admin actions, pages and /api/admin routes do not use requireAdmin()", () => {
    const files = [
      ...walk(path.join(ROOT, "src/lib/actions/admin"), (f) => f.endsWith(".ts") && !/\.test\.ts$/.test(f)),
      ...walk(path.join(ROOT, "src/app/yonetim"), (f) => /\.tsx?$/.test(f)),
      ...walk(path.join(ROOT, "src/app/api/admin"), (f) => path.basename(f) === "route.ts"),
    ];
    const offenders = files.filter((file) => guardCalls(parse(file), ["requireAdmin"]).length > 0).map(rel);
    expect(offenders).toEqual([]);
  });
});

