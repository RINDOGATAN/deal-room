/**
 * AI posture gate truth table + rate limit + audit helpers (Dealroom's
 * install-level singleton variant of dpocentral's per-org posture tests).
 *
 * requireAi is THE gate every AI feature procedure runs before building any
 * prompt: no AiSettings singleton row or posture "off" must throw
 * PRECONDITION_FAILED "ai_off" (zero AI calls by default); posture on
 * without an engine must throw "ai_not_configured". Mocked Prisma, stubbed
 * env — no DB, no network.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import {
  requireAi,
  assertAiRateLimit,
  recordGeneration,
  markAccepted,
  AI_RATE_LIMIT_PER_HOUR,
  AI_SETTINGS_SINGLETON_ID,
} from "../posture";

const prismaMock = {
  aiSettings: { findUnique: vi.fn() },
  aiGeneration: { count: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
};
// The helpers accept the narrow PrismaLike slice; the mock provides exactly
// the methods that slice uses.
const prisma = prismaMock as unknown as Parameters<typeof requireAi>[0];

const AI_ENV_KEYS = [
  "LLM_GATEWAY_URL",
  "LLM_GATEWAY_KEY",
  "LLM_MODEL_ALIAS",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  // Posture-routed lane triples (suffixed variables)
  "LLM_GATEWAY_URL_LOCAL",
  "LLM_GATEWAY_KEY_LOCAL",
  "LLM_MODEL_ALIAS_LOCAL",
  "LLM_GATEWAY_URL_EU",
  "LLM_GATEWAY_KEY_EU",
  "LLM_MODEL_ALIAS_EU",
  "LLM_GATEWAY_URL_US",
  "LLM_GATEWAY_KEY_US",
  "LLM_MODEL_ALIAS_US",
] as const;

function configureEngine() {
  vi.stubEnv("LLM_GATEWAY_URL", "http://ollama:11434");
  vi.stubEnv("LLM_MODEL_ALIAS", "qwen2.5:7b-instruct");
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of AI_ENV_KEYS) vi.stubEnv(key, "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requireAi truth table (install-level singleton)", () => {
  it("reads the singleton row by its fixed id", async () => {
    configureEngine();
    prismaMock.aiSettings.findUnique.mockResolvedValue({
      id: AI_SETTINGS_SINGLETON_ID,
      posture: "local_gateway",
    });

    await requireAi(prisma);

    expect(prismaMock.aiSettings.findUnique).toHaveBeenCalledWith({
      where: { id: AI_SETTINGS_SINGLETON_ID },
    });
  });

  it("no settings row -> ai_off (even with an engine configured)", async () => {
    configureEngine();
    prismaMock.aiSettings.findUnique.mockResolvedValue(null);

    await expect(requireAi(prisma)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "ai_off",
    });
  });

  it("posture off -> ai_off (even with an engine configured)", async () => {
    configureEngine();
    prismaMock.aiSettings.findUnique.mockResolvedValue({
      id: AI_SETTINGS_SINGLETON_ID,
      posture: "off",
    });

    await expect(requireAi(prisma)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "ai_off",
    });
  });

  it("posture on + no engine -> ai_not_configured", async () => {
    prismaMock.aiSettings.findUnique.mockResolvedValue({
      id: AI_SETTINGS_SINGLETON_ID,
      posture: "local_gateway",
    });

    await expect(requireAi(prisma)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "ai_not_configured",
    });
  });

  it("posture on + engine configured -> returns the settings row", async () => {
    configureEngine();
    const row = { id: AI_SETTINGS_SINGLETON_ID, posture: "local_gateway" };
    prismaMock.aiSettings.findUnique.mockResolvedValue(row);

    await expect(requireAi(prisma)).resolves.toBe(row);
  });

  it.each(["local_gateway", "cloud_eu", "cloud_us"] as const)(
    "posture %s passes when configured",
    async (posture) => {
      configureEngine();
      prismaMock.aiSettings.findUnique.mockResolvedValue({
        id: AI_SETTINGS_SINGLETON_ID,
        posture,
      });
      await expect(requireAi(prisma)).resolves.toMatchObject({ posture });
    }
  );

  it("is lane-aware: a lane-only triple satisfies ITS posture, not the others", async () => {
    // Only the EU lane has an engine; no base triple at all.
    vi.stubEnv("LLM_GATEWAY_URL_EU", "https://eu-gateway.example");
    vi.stubEnv("LLM_MODEL_ALIAS_EU", "mistral-eu");

    prismaMock.aiSettings.findUnique.mockResolvedValue({
      id: AI_SETTINGS_SINGLETON_ID,
      posture: "cloud_eu",
    });
    await expect(requireAi(prisma)).resolves.toMatchObject({ posture: "cloud_eu" });

    prismaMock.aiSettings.findUnique.mockResolvedValue({
      id: AI_SETTINGS_SINGLETON_ID,
      posture: "cloud_us",
    });
    await expect(requireAi(prisma)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "ai_not_configured",
    });
  });
});

describe("assertAiRateLimit (install-wide)", () => {
  it("allows generation below the hourly cap", async () => {
    prismaMock.aiGeneration.count.mockResolvedValue(AI_RATE_LIMIT_PER_HOUR - 1);
    await expect(assertAiRateLimit(prisma)).resolves.toBeUndefined();

    // Scoped to the last hour, install-wide (no per-entity filter)
    const where = prismaMock.aiGeneration.count.mock.calls[0][0].where;
    expect(where.createdAt.gte).toBeInstanceOf(Date);
    expect(Object.keys(where)).toEqual(["createdAt"]);
  });

  it("rejects with TOO_MANY_REQUESTS at the cap", async () => {
    prismaMock.aiGeneration.count.mockResolvedValue(AI_RATE_LIMIT_PER_HOUR);
    await expect(assertAiRateLimit(prisma)).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: "ai_rate_limited",
    });
  });
});

describe("recordGeneration / markAccepted (metadata only)", () => {
  it("never receives prompt/output text — only metadata fields", async () => {
    prismaMock.aiGeneration.create.mockResolvedValue({ id: "gen-1" });

    await recordGeneration(prisma, {
      dealRoomId: "deal-1",
      userId: "user-1",
      feature: "compromise_reasoning",
      entityType: "CompromiseSuggestion",
      entityId: "cs-1",
      model: "qwen2.5:7b-instruct",
      posture: "local_gateway",
      promptTokens: 100,
      completionTokens: 200,
      totalTokens: 300,
      durationMs: 1234,
      status: "ok",
      acceptedAt: new Date(),
    });

    const data = prismaMock.aiGeneration.create.mock.calls[0][0].data;
    expect(Object.keys(data).sort()).toEqual(
      [
        "dealRoomId",
        "userId",
        "feature",
        "entityType",
        "entityId",
        "model",
        "posture",
        "promptTokens",
        "completionTokens",
        "totalTokens",
        "durationMs",
        "status",
        "acceptedAt",
      ].sort()
    );
    // No free-text content fields, ever
    expect(data).not.toHaveProperty("content");
    expect(data).not.toHaveProperty("prompt");
    expect(data).not.toHaveProperty("output");
  });

  it("markAccepted stamps acceptedAt user-scoped and reports a miss", async () => {
    prismaMock.aiGeneration.updateMany.mockResolvedValue({ count: 1 });
    await expect(markAccepted(prisma, "user-1", "gen-1")).resolves.toBe(true);
    expect(prismaMock.aiGeneration.updateMany).toHaveBeenCalledWith({
      where: { id: "gen-1", userId: "user-1" },
      data: { acceptedAt: expect.any(Date) },
    });

    prismaMock.aiGeneration.updateMany.mockResolvedValue({ count: 0 });
    await expect(markAccepted(prisma, "other-user", "gen-1")).resolves.toBe(false);
  });
});
