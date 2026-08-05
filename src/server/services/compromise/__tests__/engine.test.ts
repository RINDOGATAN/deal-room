// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Compromise engine unit tests.
 *
 * The bias sign convention is load-bearing: skill data ships antisymmetric
 * pairs (biasPartyB = -biasPartyA), positive meaning "this option favors that
 * party". Satisfaction must move WITH each party's own-frame bias — a
 * regression here silently reports the respondent as happier the more the
 * outcome tilts toward the initiator (the pre-2026-08 bug).
 */
import { describe, it, expect } from "vitest";
import {
  calculateStake,
  calculateCompromise,
  globalFairnessPass,
  type CompromiseInput,
  type OptionInput,
} from "@/server/services/compromise/engine";

/** Three-option scale: order 1 favors A (+0.5), order 2 neutral, order 3 favors B. */
const options: OptionInput[] = [
  { id: "opt-a", order: 1, label: "Favors A", biasPartyA: 0.5, biasPartyB: -0.5 },
  { id: "opt-mid", order: 2, label: "Neutral", biasPartyA: 0, biasPartyB: 0 },
  { id: "opt-b", order: 3, label: "Favors B", biasPartyA: -0.5, biasPartyB: 0.5 },
];

function inputWith(
  overrides: Partial<CompromiseInput> = {}
): CompromiseInput {
  return {
    partyASelection: {
      optionId: "opt-a",
      priority: 3,
      flexibility: 3,
      biasPartyA: 0.5,
      biasPartyB: -0.5,
    },
    partyBSelection: {
      optionId: "opt-b",
      priority: 3,
      flexibility: 3,
      biasPartyA: -0.5,
      biasPartyB: 0.5,
    },
    options,
    clauseTitle: "Test clause",
    ...overrides,
  };
}

describe("calculateStake", () => {
  it("implements stake = ((5-flexibility)/5 × 0.6) + (|bias| × 0.4)", () => {
    expect(calculateStake(3, 5, 0)).toBeCloseTo(0);
    expect(calculateStake(3, 1, 0)).toBeCloseTo(0.48);
    expect(calculateStake(3, 5, 1)).toBeCloseTo(0.4);
    expect(calculateStake(3, 2, -0.5)).toBeCloseTo((3 / 5) * 0.6 + 0.5 * 0.4);
  });

  it("uses the magnitude of bias — a strongly adverse pick raises stake too", () => {
    expect(calculateStake(3, 3, -0.8)).toBeCloseTo(calculateStake(3, 3, 0.8));
  });
});

describe("calculateCompromise — satisfaction bias direction", () => {
  it("suggests the middle option for symmetric positions and reports equal satisfaction", () => {
    const result = calculateCompromise(inputWith());
    expect(result.suggestedOptionId).toBe("opt-mid");
    expect(result.satisfactionPartyA).toBe(result.satisfactionPartyB);
  });

  it("an outcome tilted toward A raises A's satisfaction and lowers B's", () => {
    // B fully flexible + A's |bias| stake → engine lands on A's own option.
    const result = calculateCompromise(
      inputWith({
        partyASelection: {
          optionId: "opt-a",
          priority: 5,
          flexibility: 1,
          biasPartyA: 0.5,
          biasPartyB: -0.5,
        },
        partyBSelection: {
          optionId: "opt-b",
          priority: 1,
          flexibility: 5,
          biasPartyA: -0.5,
          biasPartyB: 0.5,
        },
      })
    );
    expect(result.suggestedOptionId).toBe("opt-a");
    // A got their pick, boosted by the option's pro-A bias → ceiling.
    expect(result.satisfactionPartyA).toBe(100);
    // B is two steps away AND the option tilts against them: distance
    // satisfaction alone would be 0; the anti-B bias must NOT lift it.
    expect(result.satisfactionPartyB).toBe(0);
  });

  it("a pro-B suggested option boosts B above pure distance, not A", () => {
    // Both parties picked B's option — zero distance for B, max for A.
    const result = calculateCompromise(
      inputWith({
        partyASelection: {
          optionId: "opt-b",
          priority: 3,
          flexibility: 3,
          biasPartyA: -0.5,
          biasPartyB: 0.5,
        },
      })
    );
    expect(result.suggestedOptionId).toBe("opt-b");
    // B: distance 0 (=100) stays capped at 100 with their +0.5 bias.
    expect(result.satisfactionPartyB).toBe(100);
    // A: distance 0 (=100) minus the anti-A tilt (-0.5 × 15%) → 93, not 100.
    expect(result.satisfactionPartyA).toBe(93);
  });
});

describe("globalFairnessPass", () => {
  it("returns suggestions unchanged when satisfaction is balanced", () => {
    const balanced = [
      {
        clauseId: "c1",
        result: {
          suggestedOptionId: "opt-mid",
          satisfactionPartyA: 80,
          satisfactionPartyB: 78,
          reasoning: "r",
        },
        options,
        partyAOptionOrder: 1,
        partyBOptionOrder: 3,
      },
    ];
    const out = globalFairnessPass(balanced);
    expect(out[0].result).toBe(balanced[0].result);
  });

  it("shifts toward the disadvantaged party past the 15% imbalance threshold", () => {
    // The 0.9/0.1 nudge only changes the pick when the parties' orders are
    // ≥5 steps apart, so this scale needs six options.
    const wideScale: OptionInput[] = [
      { id: "f1", order: 1, label: "Strongly A", biasPartyA: 0.5, biasPartyB: -0.5 },
      { id: "f2", order: 2, label: "Leans B", biasPartyA: -0.5, biasPartyB: 0.5 },
      { id: "f3", order: 3, label: "n", biasPartyA: 0, biasPartyB: 0 },
      { id: "f4", order: 4, label: "n", biasPartyA: 0, biasPartyB: 0 },
      { id: "f5", order: 5, label: "n", biasPartyA: 0, biasPartyB: 0 },
      { id: "f6", order: 6, label: "Strongly B", biasPartyA: -0.5, biasPartyB: 0.5 },
    ];
    const skewed = [
      {
        clauseId: "c1",
        result: {
          suggestedOptionId: "f1",
          satisfactionPartyA: 100,
          satisfactionPartyB: 20,
          reasoning: "r",
        },
        options: wideScale,
        partyAOptionOrder: 1,
        partyBOptionOrder: 6,
      },
    ];
    const out = globalFairnessPass(skewed);
    // Disadvantaged B: the pick moves one step toward B's end, and both
    // satisfactions are recalculated in each party's own bias frame — B's
    // rises WITH the new option's pro-B bias (27, not 12 as under the old
    // inverted sign), A's falls to 73.
    expect(out[0].result.suggestedOptionId).toBe("f2");
    expect(out[0].result.reasoning).toContain("Adjusted for overall fairness");
    expect(out[0].result.satisfactionPartyB).toBe(27);
    expect(out[0].result.satisfactionPartyA).toBe(73);
  });
});
