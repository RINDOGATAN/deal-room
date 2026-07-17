// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The LLM Door — PORTED COPY.
 *
 * Canonical copy: dpocentral-todo/src/server/services/ai/llm-door.ts
 * (authored in DPO Central). The suite's single point of contact with any
 * LLM, ported byte-identically apart from this header and the logger shim
 * below — the same porting doctrine as license-crypto. Do NOT evolve it
 * here: change the canonical copy first, then re-port.
 *
 * Provider selection (all env values are trimmed; blank = unset):
 *   1. LLM_GATEWAY_URL + LLM_MODEL_ALIAS  -> any OpenAI-compatible gateway
 *      (LiteLLM, LQ.AI, Ollama, Groq/Scaleway OpenAI endpoints, ...);
 *      LLM_GATEWAY_KEY optional (local Ollama needs none).
 *   2. OPENAI_API_KEY                     -> api.openai.com
 *   3. ANTHROPIC_API_KEY                  -> api.anthropic.com
 *   4. nothing configured                 -> graceful null, zero network.
 *
 * HARD RULE: this module is the ONLY file in the codebase allowed to make
 * an outbound AI call (`fetch`). Callers must gate on the install-level
 * posture (services/ai/posture.ts requireAi) BEFORE building prompts or
 * calling chatComplete. No additional packages; native fetch only.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { createLogger } from "@/lib/logger";

// PORT SHIM (the only body-affecting deviation from the canonical copy):
// this repo's logger is createLogger(scope) with (message, meta), while the
// canonical copy calls logger.error(message, error, context). Adapt the call
// shape here so everything below stays byte-identical with the canonical file.
const doorLog = createLogger("ai:llm-door");
const logger = {
  error: (message: string, _error?: unknown, context?: Record<string, unknown>) =>
    doorLog.error(message, context),
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AiProvider = "gateway" | "openai" | "anthropic";

export interface ChatUsage {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}

export interface ChatResult {
  /** Assistant text with any <think>/<thinking> reasoning blocks stripped. */
  content: string;
  /** Model that actually answered (as reported by the provider when available). */
  model: string;
  usage: ChatUsage | null;
  durationMs: number;
}

export interface ChatParams {
  system: string;
  user: string;
  /** Clamped to 4096. Default 1500. */
  maxTokens?: number;
  /** Default 0.3. */
  temperature?: number;
}

const MAX_TOKENS_CEILING = 4096;
const DEFAULT_MAX_TOKENS = 1500;
const DEFAULT_TEMPERATURE = 0.3;

// ---------------------------------------------------------------------------
// Configuration (read at call time so posture changes and tests see fresh env)
// ---------------------------------------------------------------------------

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/** Which provider would answer, or null when nothing is configured. */
export function getProvider(): AiProvider | null {
  if (env("LLM_GATEWAY_URL") && env("LLM_MODEL_ALIAS")) return "gateway";
  if (env("OPENAI_API_KEY")) return "openai";
  if (env("ANTHROPIC_API_KEY")) return "anthropic";
  return null;
}

/** True when an AI engine is configured (posture is checked elsewhere). */
export function isAIConfigured(): boolean {
  return getProvider() !== null;
}

/** Human-readable provider name for display in UI. */
export function getAIProviderName(): string | null {
  const provider = getProvider();
  if (provider === "gateway") return `LLM gateway (${env("LLM_MODEL_ALIAS")})`;
  if (provider === "openai") return "OpenAI";
  if (provider === "anthropic") return "Anthropic";
  return null;
}

// ---------------------------------------------------------------------------
// Reasoning-block stripping (deepseek-r1 and friends emit <think>…</think>)
// ---------------------------------------------------------------------------

/**
 * Remove chain-of-thought blocks a reasoning model may prepend to its
 * answer. Handles closed <think>/<thinking> blocks anywhere in the text and
 * an unclosed block that opens at the start (truncated reasoning).
 */
export function stripReasoning(text: string): string {
  let out = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  out = out.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
  // Unclosed reasoning block at the start: nothing useful survived it.
  out = out.replace(/^\s*<think(?:ing)?>[\s\S]*$/gi, "");
  return out.trim();
}

// ---------------------------------------------------------------------------
// Provider calls (OpenAI-compatible + Anthropic) — the only fetch sites
// ---------------------------------------------------------------------------

interface OpenAIChatResponse {
  model?: string;
  choices?: { message?: { content?: string } }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

async function callOpenAICompatible(
  url: string,
  apiKey: string | undefined,
  model: string,
  params: Required<ChatParams>,
  label: string
): Promise<{ content: string; model: string; usage: ChatUsage | null } | null> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
      max_tokens: params.maxTokens,
      temperature: params.temperature,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    logger.error(`${label} call failed`, undefined, {
      status: response.status,
      error: errorText.slice(0, 500),
    });
    return null;
  }

  const data = (await response.json()) as OpenAIChatResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  return {
    content,
    model: data.model || model,
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens ?? null,
          completionTokens: data.usage.completion_tokens ?? null,
          totalTokens: data.usage.total_tokens ?? null,
        }
      : null,
  };
}

interface AnthropicResponse {
  model?: string;
  content?: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

const ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-4-20250514";

async function callAnthropic(
  apiKey: string,
  params: Required<ChatParams>
): Promise<{ content: string; model: string; usage: ChatUsage | null } | null> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_DEFAULT_MODEL,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
      system: params.system,
      messages: [{ role: "user", content: params.user }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    logger.error("Anthropic API call failed", undefined, {
      status: response.status,
      error: errorText.slice(0, 500),
    });
    return null;
  }

  const data = (await response.json()) as AnthropicResponse;
  const textBlock = data.content?.find((b) => b.type === "text");
  if (!textBlock?.text) return null;

  const input = data.usage?.input_tokens ?? null;
  const output = data.usage?.output_tokens ?? null;
  return {
    content: textBlock.text,
    model: data.model || ANTHROPIC_DEFAULT_MODEL,
    usage:
      input !== null || output !== null
        ? {
            promptTokens: input,
            completionTokens: output,
            totalTokens: input !== null && output !== null ? input + output : null,
          }
        : null,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * One chat completion through the configured engine.
 *
 * Returns null when no engine is configured, the call fails, or the answer
 * is empty — callers must always treat AI as optional. Never throws for
 * provider errors (they are logged without prompt/output text).
 */
export async function chatComplete(params: ChatParams): Promise<ChatResult | null> {
  const provider = getProvider();
  if (!provider) return null;

  const resolved: Required<ChatParams> = {
    system: params.system,
    user: params.user,
    maxTokens: Math.min(Math.max(1, params.maxTokens ?? DEFAULT_MAX_TOKENS), MAX_TOKENS_CEILING),
    temperature: params.temperature ?? DEFAULT_TEMPERATURE,
  };

  const startedAt = Date.now();
  try {
    let raw: { content: string; model: string; usage: ChatUsage | null } | null = null;

    if (provider === "gateway") {
      const base = env("LLM_GATEWAY_URL")!.replace(/\/+$/, "");
      raw = await callOpenAICompatible(
        `${base}/v1/chat/completions`,
        env("LLM_GATEWAY_KEY"),
        env("LLM_MODEL_ALIAS")!,
        resolved,
        "LLM gateway"
      );
    } else if (provider === "openai") {
      raw = await callOpenAICompatible(
        "https://api.openai.com/v1/chat/completions",
        env("OPENAI_API_KEY")!,
        "gpt-4o",
        resolved,
        "OpenAI API"
      );
    } else {
      raw = await callAnthropic(env("ANTHROPIC_API_KEY")!, resolved);
    }

    if (!raw) return null;

    const content = stripReasoning(raw.content);
    if (!content) return null;

    return {
      content,
      model: raw.model,
      usage: raw.usage,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    logger.error("LLM call threw", undefined, {
      provider,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
