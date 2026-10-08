/**
 * Minimal structured logger: one JSON object per line on stdout/stderr so
 * Dokploy/Docker logs stay greppable (`docker logs app | grep '"level":"error"'`).
 */
type Level = "info" | "warn" | "error";
type Context = Record<string, unknown>;

function serializeError(err: unknown) {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { message: String(err) };
}

function write(level: Level, scope: string, message: string, context?: Context) {
  const entry: Record<string, unknown> = {
    time: new Date().toISOString(),
    level,
    scope,
    message,
  };
  if (context) {
    for (const [key, value] of Object.entries(context)) {
      entry[key] = key === "error" || key === "err" ? serializeError(value) : value;
    }
  }

  let line: string;
  try {
    line = JSON.stringify(entry);
  } catch {
    line = JSON.stringify({ time: entry.time, level, scope, message });
  }

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function createLogger(scope: string) {
  return {
    info: (message: string, context?: Context) => write("info", scope, message, context),
    warn: (message: string, context?: Context) => write("warn", scope, message, context),
    error: (message: string, context?: Context) => write("error", scope, message, context),
  };
}

export type Logger = ReturnType<typeof createLogger>;
