/**
 * Minimal structured logger — dependency-free and isomorphic (safe to import
 * from server modules and "use client" components alike).
 *
 * Server output: one JSON line per event ({"ts","level","scope","msg",...meta})
 * so logs stay grep-able and machine-parseable. Browser output: readable
 * "[scope] msg" plus the meta object. `debug` is gated behind DEBUG or
 * LOG_LEVEL=debug; info/warn/error are always on.
 *
 * Secret discipline: NEVER log tokens, secrets, license keys, email bodies,
 * or personal data. Log identifiers (ids, counts, statuses), not payloads.
 */

type Level = "debug" | "info" | "warn" | "error";

type LogFn = (message: string, meta?: Record<string, unknown>) => void;

export interface Logger {
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
}

const isBrowser = typeof window !== "undefined";

function debugEnabled(): boolean {
  // Guard `process` for browser bundles that don't shim it.
  if (typeof process === "undefined" || !process.env) return false;
  return Boolean(process.env.DEBUG) || process.env.LOG_LEVEL === "debug";
}

// The logger is the single sanctioned console gateway for src/**.
const sinks: Record<Level, (...args: unknown[]) => void> = {
  debug: console.debug,
  info: console.log,
  warn: console.warn,
  error: console.error,
};

function emit(
  scope: string,
  level: Level,
  message: string,
  meta?: Record<string, unknown>,
): void {
  if (level === "debug" && !debugEnabled()) return;
  const sink = sinks[level];

  if (isBrowser) {
    if (meta === undefined) sink(`[${scope}] ${message}`);
    else sink(`[${scope}] ${message}`, meta);
    return;
  }

  let line: string;
  try {
    line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      scope,
      msg: message,
      ...meta,
    });
  } catch {
    // Meta contained something non-serializable (circular ref, BigInt).
    line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      scope,
      msg: message,
      meta: String(meta),
    });
  }
  sink(line);
}

export function createLogger(scope: string): Logger {
  return {
    debug: (message, meta) => emit(scope, "debug", message, meta),
    info: (message, meta) => emit(scope, "info", message, meta),
    warn: (message, meta) => emit(scope, "warn", message, meta),
    error: (message, meta) => emit(scope, "error", message, meta),
  };
}
