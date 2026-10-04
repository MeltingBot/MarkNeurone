// ─── Evaluation of information ───────────────────────────────
//
// Mirror of ZN's evaluation models (zeroneurone/src/utils/evaluation.ts),
// which the plugin API does not expose. Each dossier picks its model: a
// confidence level (0-100) or a two-axis grading (Europol, Admiralty).

export type EvaluationModel = 'zeroneurone' | 'europol' | 'admiralty';
export type EvaluationScale = Exclude<EvaluationModel, 'zeroneurone'>;

export interface Evaluation {
  scale: EvaluationScale;
  /** Source reliability code, null when not graded. */
  source: string | null;
  /** Information accuracy code, null when not graded. */
  info: string | null;
}

/** Codes from the strongest to the weakest, as in ZN. */
export const EVALUATION_GRIDS: Record<EvaluationScale, { sources: readonly string[]; infos: readonly string[] }> = {
  europol: { sources: ['A', 'B', 'C', 'X'], infos: ['1', '2', '3', '4'] },
  admiralty: { sources: ['A', 'B', 'C', 'D', 'E', 'F'], infos: ['1', '2', '3', '4', '5', '6'] },
};

/** Model of a dossier; 'zeroneurone' when unset or unknown (ZN before 2.59). */
export function evaluationModelOf(dossier: { evaluationModel?: unknown } | null | undefined): EvaluationModel {
  const model = dossier?.evaluationModel;
  return model === 'europol' || model === 'admiralty' ? model : 'zeroneurone';
}

/** "B2", "B-" or "-2"; empty string without grading. */
export function formatEvaluation(evaluation: Evaluation | null | undefined): string {
  if (!evaluation || (evaluation.source === null && evaluation.info === null)) return '';
  return `${evaluation.source ?? '-'}${evaluation.info ?? '-'}`;
}

/**
 * Grading after picking a code on one axis ('' clears the axis). A grading
 * made in another scale is replaced; a grading with neither axis is null.
 */
export function withAxis(
  current: Evaluation | null | undefined,
  scale: EvaluationScale,
  axis: 'source' | 'info',
  code: string,
): Evaluation | null {
  const kept = current?.scale === scale ? current : null;
  const next: Evaluation = { scale, source: kept?.source ?? null, info: kept?.info ?? null, [axis]: code || null };
  return next.source === null && next.info === null ? null : next;
}
