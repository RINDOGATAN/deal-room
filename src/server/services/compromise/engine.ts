/**
 * Compromise Algorithm Engine
 *
 * This engine calculates optimal compromise suggestions for contract negotiations
 * based on each party's selections, priorities, and flexibility scores.
 */

export interface SelectionInput {
  optionId: string;
  priority: number; // 1-5, how important this clause is
  flexibility: number; // 1-5, how flexible the party is on this clause
  biasPartyA: number; // -1 to 1
  biasPartyB: number; // -1 to 1
}

export interface OptionInput {
  id: string;
  order: number;
  label: string;
  biasPartyA: number; // -1 to 1
  biasPartyB: number; // -1 to 1
}

export interface CompromiseInput {
  partyASelection: SelectionInput;
  partyBSelection: SelectionInput;
  options: OptionInput[];
  clauseTitle: string;
}

export interface CompromiseResult {
  suggestedOptionId: string;
  satisfactionPartyA: number; // 0-100
  satisfactionPartyB: number; // 0-100
  reasoning: string;
}

/**
 * Calculate stake score for a party
 * Higher stake = party cares more about this clause / less willing to compromise
 *
 * Formula: stake = (priority/5 × 0.4) + ((5-flexibility)/5 × 0.3) + (|bias| × 0.3)
 */
function calculateStake(
  priority: number,
  flexibility: number,
  bias: number
): number {
  const priorityWeight = 0.4;
  const flexibilityWeight = 0.3;
  const biasWeight = 0.3;

  const priorityScore = priority / 5;
  const inflexibilityScore = (5 - flexibility) / 5;
  const biasScore = Math.abs(bias);

  return (
    priorityScore * priorityWeight +
    inflexibilityScore * flexibilityWeight +
    biasScore * biasWeight
  );
}

/**
 * Calculate satisfaction score for a party given the suggested option
 * vs their original selection
 */
function calculateSatisfaction(
  originalOptionOrder: number,
  suggestedOptionOrder: number,
  totalOptions: number,
  suggestedBias: number,
  partyIsA: boolean
): number {
  // Base satisfaction from option distance
  const maxDistance = totalOptions - 1;
  const distance = Math.abs(originalOptionOrder - suggestedOptionOrder);
  const distanceSatisfaction = maxDistance > 0 ? 1 - distance / maxDistance : 1;

  // Bias adjustment - positive bias for this party increases satisfaction
  const relevantBias = partyIsA ? suggestedBias : -suggestedBias;
  const biasAdjustment = relevantBias * 0.15; // ±15% based on bias

  // Calculate final satisfaction (0-100)
  const satisfaction = Math.max(
    0,
    Math.min(100, (distanceSatisfaction + biasAdjustment) * 100)
  );

  return Math.round(satisfaction);
}

/**
 * Find the middle option between two selected options
 */
function findMiddleOption(
  optionAOrder: number,
  optionBOrder: number,
  options: OptionInput[]
): OptionInput {
  const minOrder = Math.min(optionAOrder, optionBOrder);
  const maxOrder = Math.max(optionAOrder, optionBOrder);
  const middleOrder = Math.round((minOrder + maxOrder) / 2);

  return options.reduce((closest, opt) =>
    Math.abs(opt.order - middleOrder) < Math.abs(closest.order - middleOrder)
      ? opt
      : closest
  );
}

/**
 * Main compromise calculation function
 */
export function calculateCompromise(input: CompromiseInput): CompromiseResult {
  const { partyASelection, partyBSelection, options, clauseTitle } = input;

  // Find the option objects
  const optionA = options.find((o) => o.id === partyASelection.optionId);
  const optionB = options.find((o) => o.id === partyBSelection.optionId);

  if (!optionA || !optionB) {
    throw new Error("Invalid option IDs");
  }

  // Calculate stakes
  const stakeA = calculateStake(
    partyASelection.priority,
    partyASelection.flexibility,
    partyASelection.biasPartyA
  );
  const stakeB = calculateStake(
    partyBSelection.priority,
    partyBSelection.flexibility,
    partyBSelection.biasPartyB
  );

  const stakeDifference = Math.abs(stakeA - stakeB);

  let suggestedOption: OptionInput;
  let reasoning: string;

  // Decision logic
  if (stakeDifference < 0.1) {
    // Stakes are similar - suggest middle option
    suggestedOption = findMiddleOption(optionA.order, optionB.order, options);
    reasoning = `For "${clauseTitle}", both parties have similar levels of investment in this clause. The suggested option represents a balanced middle ground that aims to satisfy both parties equally.`;
  } else if (stakeA > stakeB) {
    // Party A has higher stake
    if (partyBSelection.flexibility >= 4) {
      // Party B is flexible - suggest closer to A's choice
      suggestedOption = optionA;
      reasoning = `For "${clauseTitle}", Party A (initiator) has indicated this clause is highly important to them, and Party B has shown flexibility. The suggestion reflects Party A's preference while acknowledging Party B's willingness to accommodate.`;
    } else {
      // Party B is less flexible - suggest compromise closer to A
      const targetOrder = optionA.order + (optionB.order - optionA.order) * 0.3;
      suggestedOption = options.reduce((closest, opt) =>
        Math.abs(opt.order - targetOrder) < Math.abs(closest.order - targetOrder)
          ? opt
          : closest
      );
      reasoning = `For "${clauseTitle}", Party A (initiator) has a higher stake in this clause. The suggestion leans toward Party A's preference while still considering Party B's position.`;
    }
  } else {
    // Party B has higher stake
    if (partyASelection.flexibility >= 4) {
      // Party A is flexible - suggest closer to B's choice
      suggestedOption = optionB;
      reasoning = `For "${clauseTitle}", Party B (respondent) has indicated this clause is highly important to them, and Party A has shown flexibility. The suggestion reflects Party B's preference while acknowledging Party A's willingness to accommodate.`;
    } else {
      // Party A is less flexible - suggest compromise closer to B
      const targetOrder = optionB.order + (optionA.order - optionB.order) * 0.3;
      suggestedOption = options.reduce((closest, opt) =>
        Math.abs(opt.order - targetOrder) < Math.abs(closest.order - targetOrder)
          ? opt
          : closest
      );
      reasoning = `For "${clauseTitle}", Party B (respondent) has a higher stake in this clause. The suggestion leans toward Party B's preference while still considering Party A's position.`;
    }
  }

  // Calculate satisfaction scores
  const satisfactionPartyA = calculateSatisfaction(
    optionA.order,
    suggestedOption.order,
    options.length,
    suggestedOption.biasPartyA,
    true
  );

  const satisfactionPartyB = calculateSatisfaction(
    optionB.order,
    suggestedOption.order,
    options.length,
    suggestedOption.biasPartyB,
    false
  );

  return {
    suggestedOptionId: suggestedOption.id,
    satisfactionPartyA,
    satisfactionPartyB,
    reasoning,
  };
}

/**
 * Global fairness pass - rebalance if overall satisfaction is too skewed
 */
export function globalFairnessPass(
  suggestions: Array<{
    clauseId: string;
    result: CompromiseResult;
    options: OptionInput[];
    partyAOptionOrder: number;
    partyBOptionOrder: number;
  }>
): Array<{ clauseId: string; result: CompromiseResult }> {
  // Calculate overall satisfaction
  const totalA = suggestions.reduce(
    (sum, s) => sum + s.result.satisfactionPartyA,
    0
  );
  const totalB = suggestions.reduce(
    (sum, s) => sum + s.result.satisfactionPartyB,
    0
  );
  const avgA = totalA / suggestions.length;
  const avgB = totalB / suggestions.length;

  const imbalance = Math.abs(avgA - avgB);
  const imbalanceThreshold = 15; // 15% threshold

  if (imbalance <= imbalanceThreshold) {
    // No rebalancing needed
    return suggestions.map((s) => ({
      clauseId: s.clauseId,
      result: s.result,
    }));
  }

  // Rebalance - shift some suggestions toward the disadvantaged party
  const disadvantagedIsA = avgA < avgB;

  return suggestions.map((s) => {
    // Only adjust if there's room to improve
    const currentSuggestion = s.options.find(
      (o) => o.id === s.result.suggestedOptionId
    );
    if (!currentSuggestion) return { clauseId: s.clauseId, result: s.result };

    const targetOrder = disadvantagedIsA
      ? Math.round(currentSuggestion.order * 0.9 + s.partyAOptionOrder * 0.1)
      : Math.round(currentSuggestion.order * 0.9 + s.partyBOptionOrder * 0.1);

    const adjustedOption = s.options.reduce((closest, opt) =>
      Math.abs(opt.order - targetOrder) < Math.abs(closest.order - targetOrder)
        ? opt
        : closest
    );

    if (adjustedOption.id === s.result.suggestedOptionId) {
      return { clauseId: s.clauseId, result: s.result };
    }

    // Recalculate satisfaction
    const newSatisfactionA = calculateSatisfaction(
      s.partyAOptionOrder,
      adjustedOption.order,
      s.options.length,
      adjustedOption.biasPartyA,
      true
    );

    const newSatisfactionB = calculateSatisfaction(
      s.partyBOptionOrder,
      adjustedOption.order,
      s.options.length,
      adjustedOption.biasPartyB,
      false
    );

    return {
      clauseId: s.clauseId,
      result: {
        suggestedOptionId: adjustedOption.id,
        satisfactionPartyA: newSatisfactionA,
        satisfactionPartyB: newSatisfactionB,
        reasoning:
          s.result.reasoning +
          " (Adjusted for overall fairness between parties.)",
      },
    };
  });
}
