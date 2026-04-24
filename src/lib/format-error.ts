const TRANSIENT_DB_PATTERNS = [
  "Control plane request failed",
  "connection timed out",
  "Connection terminated unexpectedly",
  "connect ECONNREFUSED",
  "Can't reach database server",
  "the database system is starting up",
  "Too many connections",
  "neon:retryable",
];

const RAW_ORM_PATTERNS = [
  "PrismaClientKnownRequestError",
  "PrismaClientUnknownRequestError",
  "PrismaClientInitializationError",
  "Invalid `prisma.",
];

export const TRANSIENT_MESSAGE =
  "We're reconnecting to the service. Please try again in a moment.";

export function isTransientDbError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message ?? "";
  return TRANSIENT_DB_PATTERNS.some((p) => msg.includes(p));
}

export function formatUserError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const msg = err.message;
  if (!msg) return fallback;
  if (TRANSIENT_DB_PATTERNS.some((p) => msg.includes(p))) return TRANSIENT_MESSAGE;
  if (RAW_ORM_PATTERNS.some((p) => msg.includes(p))) return fallback;
  return msg;
}
