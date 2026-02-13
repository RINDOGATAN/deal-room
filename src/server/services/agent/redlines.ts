/**
 * Red Line Conflict Detection
 *
 * Checks for irreconcilable conflicts between two playbooks.
 * A conflict exists when both parties mark a clause as a red line
 * and there is no overlap in their acceptable options.
 */

import type { PlaybookEntry } from "@prisma/client";

export interface RedLineConflict {
  clauseId: string;
  reason: string;
  initiatorPreferred: string;
  respondentPreferred: string;
  initiatorAcceptable: string[];
  respondentAcceptable: string[];
}

export interface RedLineCheckResult {
  passed: boolean;
  conflicts: RedLineConflict[];
}

/**
 * Check for irreconcilable red line conflicts between two sets of playbook entries.
 *
 * A conflict occurs when:
 * - Both parties mark the same clause as isRedLine
 * - The intersection of their acceptable options is empty
 *
 * If acceptableOptions is empty, it means "only the preferred option is acceptable."
 */
export function checkRedLines(
  initiatorEntries: PlaybookEntry[],
  respondentEntries: PlaybookEntry[]
): RedLineCheckResult {
  const conflicts: RedLineConflict[] = [];

  // Index respondent entries by clauseId
  const respondentMap = new Map<string, PlaybookEntry>();
  for (const entry of respondentEntries) {
    respondentMap.set(entry.clauseId, entry);
  }

  for (const initEntry of initiatorEntries) {
    const respEntry = respondentMap.get(initEntry.clauseId);
    if (!respEntry) continue;

    // Only check if both sides have red lines on this clause
    if (!initEntry.isRedLine || !respEntry.isRedLine) continue;

    // Determine acceptable options for each side
    // If acceptableOptions is empty, only the preferred option is acceptable
    const initAcceptable =
      initEntry.acceptableOptions.length > 0
        ? initEntry.acceptableOptions
        : [initEntry.preferredOptionId];

    const respAcceptable =
      respEntry.acceptableOptions.length > 0
        ? respEntry.acceptableOptions
        : [respEntry.preferredOptionId];

    // Check if there is any overlap
    const overlap = initAcceptable.filter((opt) =>
      respAcceptable.includes(opt)
    );

    if (overlap.length === 0) {
      conflicts.push({
        clauseId: initEntry.clauseId,
        reason: `Both parties have irreconcilable red lines on this clause. No common acceptable option exists.`,
        initiatorPreferred: initEntry.preferredOptionId,
        respondentPreferred: respEntry.preferredOptionId,
        initiatorAcceptable: initAcceptable,
        respondentAcceptable: respAcceptable,
      });
    }
  }

  return {
    passed: conflicts.length === 0,
    conflicts,
  };
}

/**
 * Validate that a suggested option respects both parties' red lines.
 * Returns the suggested option if valid, or the best alternative from
 * the intersection of acceptable options.
 */
export function validateSuggestionAgainstRedLines(
  suggestedOptionId: string,
  initiatorEntry: PlaybookEntry | undefined,
  respondentEntry: PlaybookEntry | undefined,
  allOptionIds: string[]
): string {
  // If neither party has red lines on this clause, suggestion is fine
  if (!initiatorEntry?.isRedLine && !respondentEntry?.isRedLine) {
    return suggestedOptionId;
  }

  const initAcceptable = getAcceptableSet(initiatorEntry);
  const respAcceptable = getAcceptableSet(respondentEntry);

  // Check if the suggestion is acceptable to both
  const initOk = !initAcceptable || initAcceptable.has(suggestedOptionId);
  const respOk = !respAcceptable || respAcceptable.has(suggestedOptionId);

  if (initOk && respOk) {
    return suggestedOptionId;
  }

  // Find the intersection of acceptable options
  const intersection = allOptionIds.filter((optId) => {
    const okForInit = !initAcceptable || initAcceptable.has(optId);
    const okForResp = !respAcceptable || respAcceptable.has(optId);
    return okForInit && okForResp;
  });

  if (intersection.length > 0) {
    // Return the first acceptable option (closest to original suggestion preference)
    return intersection[0];
  }

  // Should not happen if red line check passed, but return original as fallback
  return suggestedOptionId;
}

function getAcceptableSet(
  entry: PlaybookEntry | undefined
): Set<string> | null {
  if (!entry?.isRedLine) return null;

  if (entry.acceptableOptions.length > 0) {
    return new Set(entry.acceptableOptions);
  }
  return new Set([entry.preferredOptionId]);
}
