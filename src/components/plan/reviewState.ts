import type { z } from "zod";
import type { PlanStepSchema } from "@/lib/contract";
import { isUnrecognised, type Tolerated } from "@/lib/api/tolerant";

export type PlanStep = Tolerated<z.infer<typeof PlanStepSchema>>;

export type Approvability =
  { ok: true } | { ok: false; why: "ungrounded" | "blocked" };

/**
 * Whether a step MAY be approved. The server decides `blocked` and the
 * binding; the client only reads them (the contract: "Set by the SERVER -
 * the client does not infer it"). An ungrounded step cannot be approved,
 * and neither can a blocked one - both are shown, in place, with their
 * reason (Phase B 1.3), never dropped.
 */
export function approvability(step: PlanStep): Approvability {
  if (step.blocked !== null) return { ok: false, why: "blocked" };
  if (step.binding.type === "ungrounded")
    return { ok: false, why: "ungrounded" };
  return { ok: true };
}

/**
 * Does the step change state in the tested application? SAFETY (contract):
 * an unknown class MUST be treated as `write`, so the only way to be
 * called read-only is to be exactly `read`.
 */
export function isWrite(step: PlanStep): boolean {
  return isUnrecognised(step.action_class) || step.action_class !== "read";
}

/**
 * The person's edits, held in the client until the single approval write:
 * an order (the whole list, so non-approvable steps keep their place on
 * screen) and the set of steps they chose to leave out. The plan itself
 * is never modified - it is immutable.
 */
export interface Review {
  order: string[];
  leftOut: ReadonlySet<string>;
}

export function initialReview(steps: PlanStep[]): Review {
  return { order: steps.map((s) => s.id), leftOut: new Set() };
}

export function move(review: Review, id: string, direction: -1 | 1): Review {
  const i = review.order.indexOf(id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= review.order.length) return review;
  const order = [...review.order];
  [order[i], order[j]] = [order[j]!, order[i]!];
  return { ...review, order };
}

export function toggleLeftOut(review: Review, step: PlanStep): Review {
  if (!approvability(step).ok) return review;
  const leftOut = new Set(review.leftOut);
  if (leftOut.has(step.id)) leftOut.delete(step.id);
  else leftOut.add(step.id);
  return { ...review, leftOut };
}

/** The ordered ids that will be sent - and nothing else can be. */
export function selectedStepIds(review: Review, steps: PlanStep[]): string[] {
  const byId = new Map(steps.map((s) => [s.id, s]));
  return review.order.filter((id) => {
    const step = byId.get(id);
    return step && approvability(step).ok && !review.leftOut.has(id);
  });
}

/** Every exclusion, counted so the screen can state it (Phase B 1.3). */
export function reviewSummary(review: Review, steps: PlanStep[]) {
  const selected = selectedStepIds(review, steps);
  const notApprovable = steps.filter((s) => !approvability(s).ok).length;
  const leftOutByYou = steps.filter(
    (s) => approvability(s).ok && review.leftOut.has(s.id),
  ).length;
  return {
    total: steps.length,
    selected: selected.length,
    notApprovable,
    leftOutByYou,
    writes: steps.filter((s) => selected.includes(s.id) && isWrite(s)).length,
  };
}

/** `ambiguous_element` -> "ambiguous element". A code from the server, shown as text. */
export function humanise(code: string | { raw: string }): string {
  const text = typeof code === "string" ? code : code.raw;
  return text.replace(/_/g, " ");
}

export type ExclusionReason = "removed_by_user" | "ungrounded" | "blocked";

/**
 * Why a step is NOT in an approval, and WHO excluded it - a different fact
 * for the person's choice than for the system's refusal, kept apart
 * everywhere it is shown. Same precedence the server uses for the proof
 * (docs/API_CONTRACT.md, "Plan runs"): ungrounded, else blocked, else absent
 * from the approval = the person left it out.
 */
export function exclusionReason(
  step: PlanStep,
  approvedIds: string[],
): ExclusionReason | null {
  if (approvedIds.includes(step.id)) return null;
  if (step.binding.type === "ungrounded") return "ungrounded";
  if (step.blocked !== null) return "blocked";
  return "removed_by_user";
}

/** Distinct inventory elements the proposed steps touch (page-level and ungrounded steps touch none). */
export function elementsTouched(steps: PlanStep[]): number {
  return new Set(
    steps.flatMap((s) =>
      s.binding.type === "element" ? [s.binding.element_id] : [],
    ),
  ).size;
}
