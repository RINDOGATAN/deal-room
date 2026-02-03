"use client";

import { useState, useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { Star, ArrowRight, Check } from "lucide-react";

// Sample clause options for the demo
const DEMO_OPTIONS = [
  {
    id: "opt-1",
    order: 1,
    label: "Party A Favored",
    description: "Strongly favors Party A's interests",
    biasPartyA: 0.8,
    biasPartyB: -0.6,
  },
  {
    id: "opt-2",
    order: 2,
    label: "Slightly A-Favored",
    description: "Moderately favors Party A",
    biasPartyA: 0.4,
    biasPartyB: -0.2,
  },
  {
    id: "opt-3",
    order: 3,
    label: "Balanced",
    description: "Neutral middle ground",
    biasPartyA: 0.0,
    biasPartyB: 0.0,
  },
  {
    id: "opt-4",
    order: 4,
    label: "Slightly B-Favored",
    description: "Moderately favors Party B",
    biasPartyA: -0.2,
    biasPartyB: 0.4,
  },
  {
    id: "opt-5",
    order: 5,
    label: "Party B Favored",
    description: "Strongly favors Party B's interests",
    biasPartyA: -0.6,
    biasPartyB: 0.8,
  },
];

// Stake calculation - matches engine.ts exactly
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

// Satisfaction calculation - matches engine.ts
function calculateSatisfaction(
  originalOptionOrder: number,
  suggestedOptionOrder: number,
  totalOptions: number,
  suggestedBias: number,
  partyIsA: boolean
): number {
  const maxDistance = totalOptions - 1;
  const distance = Math.abs(originalOptionOrder - suggestedOptionOrder);
  const distanceSatisfaction = maxDistance > 0 ? 1 - distance / maxDistance : 1;

  const relevantBias = partyIsA ? suggestedBias : -suggestedBias;
  const biasAdjustment = relevantBias * 0.15;

  const satisfaction = Math.max(
    0,
    Math.min(100, (distanceSatisfaction + biasAdjustment) * 100)
  );

  return Math.round(satisfaction);
}

interface PartyState {
  selectedOption: number;
  priority: number;
  flexibility: number;
}

export function CompromiseDemo() {
  const [partyA, setPartyA] = useState<PartyState>({
    selectedOption: 1, // opt-1 (Party A Favored)
    priority: 4,
    flexibility: 2,
  });

  const [partyB, setPartyB] = useState<PartyState>({
    selectedOption: 5, // opt-5 (Party B Favored)
    priority: 4,
    flexibility: 2,
  });

  // Calculate compromise
  const result = useMemo(() => {
    const optionA = DEMO_OPTIONS.find((o) => o.order === partyA.selectedOption)!;
    const optionB = DEMO_OPTIONS.find((o) => o.order === partyB.selectedOption)!;

    const stakeA = calculateStake(partyA.priority, partyA.flexibility, optionA.biasPartyA);
    const stakeB = calculateStake(partyB.priority, partyB.flexibility, optionB.biasPartyB);

    const stakeDifference = Math.abs(stakeA - stakeB);

    let suggestedOption: (typeof DEMO_OPTIONS)[0];
    let reasoning: string;

    if (stakeDifference < 0.1) {
      // Stakes are similar - suggest middle option
      const minOrder = Math.min(optionA.order, optionB.order);
      const maxOrder = Math.max(optionA.order, optionB.order);
      const middleOrder = Math.round((minOrder + maxOrder) / 2);
      suggestedOption = DEMO_OPTIONS.reduce((closest, opt) =>
        Math.abs(opt.order - middleOrder) < Math.abs(closest.order - middleOrder)
          ? opt
          : closest
      );
      reasoning =
        "Both parties have similar stakes. The algorithm suggests a balanced middle ground.";
    } else if (stakeA > stakeB) {
      if (partyB.flexibility >= 4) {
        suggestedOption = optionA;
        reasoning =
          "Party A has higher stake and Party B is flexible. Suggestion favors Party A.";
      } else {
        const targetOrder = optionA.order + (optionB.order - optionA.order) * 0.3;
        suggestedOption = DEMO_OPTIONS.reduce((closest, opt) =>
          Math.abs(opt.order - targetOrder) < Math.abs(closest.order - targetOrder)
            ? opt
            : closest
        );
        reasoning =
          "Party A has higher stake. Suggestion leans toward Party A while considering Party B.";
      }
    } else {
      if (partyA.flexibility >= 4) {
        suggestedOption = optionB;
        reasoning =
          "Party B has higher stake and Party A is flexible. Suggestion favors Party B.";
      } else {
        const targetOrder = optionB.order + (optionA.order - optionB.order) * 0.3;
        suggestedOption = DEMO_OPTIONS.reduce((closest, opt) =>
          Math.abs(opt.order - targetOrder) < Math.abs(closest.order - targetOrder)
            ? opt
            : closest
        );
        reasoning =
          "Party B has higher stake. Suggestion leans toward Party B while considering Party A.";
      }
    }

    const satisfactionA = calculateSatisfaction(
      optionA.order,
      suggestedOption.order,
      DEMO_OPTIONS.length,
      suggestedOption.biasPartyA,
      true
    );

    const satisfactionB = calculateSatisfaction(
      optionB.order,
      suggestedOption.order,
      DEMO_OPTIONS.length,
      suggestedOption.biasPartyB,
      false
    );

    return {
      stakeA,
      stakeB,
      suggestedOption,
      satisfactionA,
      satisfactionB,
      reasoning,
    };
  }, [partyA, partyB]);

  return (
    <div className="space-y-8">
      {/* Party Cards */}
      <div className="grid grid-cols-2 gap-6">
        {/* Party A */}
        <PartyCard
          label="Party A"
          sublabel="Initiator"
          state={partyA}
          stake={result.stakeA}
          satisfaction={result.satisfactionA}
          accentColor="text-blue-400"
          borderColor="border-blue-400"
          bgColor="bg-blue-400/10"
          options={DEMO_OPTIONS}
          onChange={setPartyA}
        />

        {/* Party B */}
        <PartyCard
          label="Party B"
          sublabel="Respondent"
          state={partyB}
          stake={result.stakeB}
          satisfaction={result.satisfactionB}
          accentColor="text-orange-400"
          borderColor="border-orange-400"
          bgColor="bg-orange-400/10"
          options={DEMO_OPTIONS}
          onChange={setPartyB}
        />
      </div>

      {/* Result Panel */}
      <div className="border-2 border-primary bg-primary/5 p-6">
        <div className="flex items-center gap-2 mb-4">
          <ArrowRight className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold text-primary">Algorithm Suggestion</h3>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Suggested Option */}
          <div className="col-span-2">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 border-2 border-primary bg-primary flex items-center justify-center">
                <Check className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <p className="font-bold text-lg">{result.suggestedOption.label}</p>
                <p className="text-sm text-muted-foreground">
                  {result.suggestedOption.description}
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-3">{result.reasoning}</p>
          </div>

          {/* Satisfaction Bars */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-blue-400">Party A Satisfaction</span>
                <span className="font-bold">{result.satisfactionA}%</span>
              </div>
              <div className="h-2 bg-card border border-border">
                <div
                  className="h-full bg-blue-400 transition-all duration-300"
                  style={{ width: `${result.satisfactionA}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-orange-400">Party B Satisfaction</span>
                <span className="font-bold">{result.satisfactionB}%</span>
              </div>
              <div className="h-2 bg-card border border-border">
                <div
                  className="h-full bg-orange-400 transition-all duration-300"
                  style={{ width: `${result.satisfactionB}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Option Visualization */}
      <div>
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Option Spectrum
        </p>
        <div className="flex items-center gap-1">
          {DEMO_OPTIONS.map((opt) => {
            const isPartyAChoice = partyA.selectedOption === opt.order;
            const isPartyBChoice = partyB.selectedOption === opt.order;
            const isSuggested = result.suggestedOption.id === opt.id;

            return (
              <div key={opt.id} className="flex-1 relative">
                <div
                  className={`
                    h-12 border-2 flex items-center justify-center text-xs font-medium
                    transition-colors
                    ${
                      isSuggested
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-border bg-card text-muted-foreground"
                    }
                  `}
                >
                  {opt.label}
                </div>
                {/* Party indicators */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-1">
                  {isPartyAChoice && (
                    <span className="w-5 h-5 bg-blue-400 text-[10px] font-bold flex items-center justify-center text-background">
                      A
                    </span>
                  )}
                  {isPartyBChoice && (
                    <span className="w-5 h-5 bg-orange-400 text-[10px] font-bold flex items-center justify-center text-background">
                      B
                    </span>
                  )}
                </div>
                {isSuggested && (
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
                    <span className="text-[10px] text-primary font-bold">
                      SUGGESTED
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Party Card Component
function PartyCard({
  label,
  sublabel,
  state,
  stake,
  satisfaction,
  accentColor,
  borderColor,
  bgColor,
  options,
  onChange,
}: {
  label: string;
  sublabel: string;
  state: PartyState;
  stake: number;
  satisfaction: number;
  accentColor: string;
  borderColor: string;
  bgColor: string;
  options: typeof DEMO_OPTIONS;
  onChange: (state: PartyState) => void;
}) {
  return (
    <div className={`border-2 ${borderColor} p-5`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className={`font-bold text-lg ${accentColor}`}>{label}</h4>
          <p className="text-xs text-muted-foreground">{sublabel}</p>
        </div>
        <div className={`px-3 py-1 ${bgColor} border ${borderColor}`}>
          <span className="text-xs text-muted-foreground">Stake: </span>
          <span className={`font-bold ${accentColor}`}>{(stake * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Option Selection */}
      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-2">Selected Option</p>
        <select
          value={state.selectedOption}
          onChange={(e) =>
            onChange({ ...state, selectedOption: parseInt(e.target.value) })
          }
          className="w-full bg-card border border-border px-3 py-2 text-sm"
        >
          {options.map((opt) => (
            <option key={opt.id} value={opt.order}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Priority */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground">Priority</p>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={`w-3 h-3 ${
                  n <= state.priority
                    ? `${accentColor} fill-current`
                    : "text-muted-foreground"
                }`}
              />
            ))}
          </div>
        </div>
        <Slider
          value={[state.priority]}
          onValueChange={([v]) => onChange({ ...state, priority: v })}
          min={1}
          max={5}
          step={1}
        />
      </div>

      {/* Flexibility */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground">Flexibility</p>
          <span className="text-xs font-medium">{state.flexibility}/5</span>
        </div>
        <Slider
          value={[state.flexibility]}
          onValueChange={([v]) => onChange({ ...state, flexibility: v })}
          min={1}
          max={5}
          step={1}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>Inflexible</span>
          <span>Very Flexible</span>
        </div>
      </div>
    </div>
  );
}
