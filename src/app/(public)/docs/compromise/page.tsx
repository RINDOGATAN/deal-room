import { Scale, Calculator, BarChart3, RefreshCw } from "lucide-react";
import { CompromiseDemo } from "../components/CompromiseDemo";

export default function CompromisePage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-4">Compromise Algorithm</h1>
        <p className="text-lg text-muted-foreground">
          Dealroom uses a weighted stake-based algorithm to suggest fair compromises
          when parties select different options. The algorithm considers priorities,
          flexibility, and option bias to find solutions that satisfy both parties.
        </p>
      </div>

      {/* The Problem */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">The Problem</h2>
        <p className="text-muted-foreground">
          In contract negotiation, parties often want different things. Traditional
          approaches either:
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 border border-amber-500/30 bg-amber-500/5">
            <p className="font-medium text-amber-400">Power Imbalance</p>
            <p className="text-sm text-muted-foreground mt-1">
              The party with more leverage wins, regardless of actual needs
            </p>
          </div>
          <div className="p-4 border border-amber-500/30 bg-amber-500/5">
            <p className="font-medium text-amber-400">Endless Cycles</p>
            <p className="text-sm text-muted-foreground mt-1">
              Back-and-forth negotiation with no clear resolution path
            </p>
          </div>
          <div className="p-4 border border-amber-500/30 bg-amber-500/5">
            <p className="font-medium text-amber-400">Arbitrary Splits</p>
            <p className="text-sm text-muted-foreground mt-1">
              "Meet in the middle" ignores how much each party actually cares
            </p>
          </div>
        </div>
      </div>

      {/* The Solution */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">The Solution: Weighted Stake</h2>
        <p className="text-muted-foreground">
          Dealroom's algorithm calculates a "stake" score for each party on each
          clause. The party with higher stake—who cares more and is less
          flexible—gets preference. When stakes are similar, a balanced middle ground
          is suggested.
        </p>

        <div className="grid grid-cols-2 gap-6">
          <div className="p-5 border border-primary/30 bg-primary/5">
            <div className="flex items-center gap-3 mb-3">
              <Calculator className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-primary">What Stake Measures</h3>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">40%</span>
                <span className="text-muted-foreground">
                  <strong className="text-foreground">Priority</strong> — How
                  important is this clause to the party?
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">30%</span>
                <span className="text-muted-foreground">
                  <strong className="text-foreground">Inflexibility</strong> — How
                  unwilling are they to compromise?
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">30%</span>
                <span className="text-muted-foreground">
                  <strong className="text-foreground">Option Bias</strong> — How
                  much does their chosen option favor them?
                </span>
              </li>
            </ul>
          </div>

          <div className="p-5 border border-border">
            <div className="flex items-center gap-3 mb-3">
              <Scale className="w-5 h-5" />
              <h3 className="font-bold">Fair Outcomes</h3>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                • Parties who care more about a clause get more weight on that clause
              </li>
              <li>• Flexible parties enable others to get what they need</li>
              <li>• Overall satisfaction is balanced across all clauses</li>
              <li>• No single party dominates the entire negotiation</li>
            </ul>
          </div>
        </div>
      </div>

      {/* The Formula */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">The Stake Formula</h2>
        <div className="p-6 border-2 border-primary bg-card">
          <code className="text-lg text-primary font-mono">
            stake = (priority/5 × 0.4) + ((5-flexibility)/5 × 0.3) + (|bias| × 0.3)
          </code>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="p-4 border border-border">
            <p className="font-mono text-primary mb-2">priority/5 × 0.4</p>
            <p className="text-muted-foreground">
              Priority from 1-5 normalized to 0-1, weighted at 40%
            </p>
          </div>
          <div className="p-4 border border-border">
            <p className="font-mono text-primary mb-2">(5-flexibility)/5 × 0.3</p>
            <p className="text-muted-foreground">
              Inflexibility (inverse of flexibility) normalized, weighted at 30%
            </p>
          </div>
          <div className="p-4 border border-border">
            <p className="font-mono text-primary mb-2">|bias| × 0.3</p>
            <p className="text-muted-foreground">
              Absolute value of option bias (-1 to 1), weighted at 30%
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          The result is a stake score from 0 to 1, where higher values indicate the
          party has more at stake in this clause.
        </p>
      </div>

      {/* Decision Logic */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Decision Logic</h2>
        <p className="text-muted-foreground">
          Once stakes are calculated, the algorithm decides which option to suggest:
        </p>

        <div className="space-y-3">
          <div className="p-5 border border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-6 h-6 border border-muted-foreground flex items-center justify-center text-xs font-bold">
                1
              </div>
              <h3 className="font-bold">Similar Stakes (difference &lt; 10%)</h3>
            </div>
            <p className="text-sm text-muted-foreground ml-9">
              Suggest the middle option between both parties' choices. This represents
              a balanced compromise when neither party has significantly more at stake.
            </p>
          </div>

          <div className="p-5 border border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-6 h-6 border border-muted-foreground flex items-center justify-center text-xs font-bold">
                2
              </div>
              <h3 className="font-bold">One Party Has Higher Stake</h3>
            </div>
            <p className="text-sm text-muted-foreground ml-9 mb-3">
              The algorithm favors the higher-stake party, but considers the other
              party's flexibility:
            </p>
            <div className="ml-9 grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted/30 border border-border">
                <p className="text-sm font-medium">If other party is flexible (≥4)</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Suggest the higher-stake party's exact choice
                </p>
              </div>
              <div className="p-3 bg-muted/30 border border-border">
                <p className="text-sm font-medium">If other party is less flexible</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Suggest an option 70% toward higher-stake party's choice
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Global Fairness */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Global Fairness Pass</h2>
        <p className="text-muted-foreground">
          After individual clause suggestions, the algorithm performs a global
          fairness check across all clauses:
        </p>

        <div className="p-5 border border-border">
          <div className="flex items-center gap-3 mb-4">
            <RefreshCw className="w-5 h-5 text-primary" />
            <h3 className="font-bold">Rebalancing Process</h3>
          </div>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 border border-muted-foreground flex items-center justify-center text-xs flex-shrink-0">
                1
              </span>
              <span className="text-muted-foreground">
                Calculate average satisfaction for Party A and Party B across all
                clauses
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 border border-muted-foreground flex items-center justify-center text-xs flex-shrink-0">
                2
              </span>
              <span className="text-muted-foreground">
                If imbalance exceeds 15%, identify the disadvantaged party
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 border border-muted-foreground flex items-center justify-center text-xs flex-shrink-0">
                3
              </span>
              <span className="text-muted-foreground">
                Shift some suggestions slightly toward the disadvantaged party
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 border border-primary bg-primary flex items-center justify-center text-xs flex-shrink-0 text-primary-foreground">
                4
              </span>
              <span className="text-muted-foreground">
                Result: No single party consistently loses across all clauses
              </span>
            </li>
          </ol>
        </div>
      </div>

      {/* Satisfaction Calculation */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Satisfaction Scores</h2>
        <p className="text-muted-foreground">
          After suggesting an option, the algorithm calculates how satisfied each
          party would be:
        </p>

        <div className="grid grid-cols-2 gap-6">
          <div className="p-5 border border-border">
            <div className="flex items-center gap-3 mb-3">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h3 className="font-bold">Distance Factor</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              How far is the suggestion from the party's original choice? Closer
              options mean higher base satisfaction.
            </p>
            <code className="block mt-3 text-xs bg-card p-2 border border-border">
              1 - (distance / maxDistance)
            </code>
          </div>
          <div className="p-5 border border-border">
            <div className="flex items-center gap-3 mb-3">
              <Scale className="w-5 h-5 text-primary" />
              <h3 className="font-bold">Bias Adjustment</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Options that favor a party add up to 15% satisfaction bonus. Options
              that disfavor subtract up to 15%.
            </p>
            <code className="block mt-3 text-xs bg-card p-2 border border-border">
              ±(bias × 0.15)
            </code>
          </div>
        </div>
      </div>

      {/* Interactive Demo */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Try It Yourself</h2>
        <p className="text-muted-foreground">
          Adjust the sliders below to see how the compromise algorithm responds to
          different inputs. This demo uses the exact same calculation logic as the
          production system.
        </p>

        <div className="border-2 border-border p-6 bg-card">
          <CompromiseDemo />
        </div>
      </div>

      {/* Technical Reference */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Technical Reference</h2>
        <div className="p-5 border border-border bg-muted/30">
          <p className="text-sm text-muted-foreground mb-3">
            The compromise algorithm is implemented in:
          </p>
          <code className="block text-xs bg-card p-3 border border-border">
            src/server/services/compromise/engine.ts
          </code>
          <p className="text-sm text-muted-foreground mt-3">
            Key exports: <code className="text-primary">calculateCompromise()</code>,{" "}
            <code className="text-primary">globalFairnessPass()</code>
          </p>
        </div>
      </div>
    </div>
  );
}
