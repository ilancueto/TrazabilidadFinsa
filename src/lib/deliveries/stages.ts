import type { RequirementDraft } from "@/lib/types";

export const REQUIREMENT_STAGES = ["FLOOR", "DISPATCH"] as const;
export type RequirementStage = (typeof REQUIREMENT_STAGES)[number];

export const DISPATCH_TYPE_CODES = new Set([
  "ETIQUETAS",
  "ETIQUETAS_ANDREANI",
  "ETIQUETA_ANDREANI",
  "ETIQUETAS_TECPETROL",
  "ETIQUETAS_PLUSPETROL",
]);

const CLIENT_LABELS: Array<{ match: RegExp; code: string }> = [
  { match: /tecpetrol/i, code: "ETIQUETAS_TECPETROL" },
  { match: /pluspetrol/i, code: "ETIQUETAS_PLUSPETROL" },
];

export function requirementStage(item: {
  stage?: string | null;
  type_code?: string | null;
  typeCode?: string | null;
}): RequirementStage {
  if (item.stage === "DISPATCH" || item.stage === "FLOOR") return item.stage;
  const code = item.type_code ?? item.typeCode ?? "";
  return DISPATCH_TYPE_CODES.has(code) ? "DISPATCH" : "FLOOR";
}

export function dispatchCodesForClient(clientName: string | null | undefined): string[] {
  if (!clientName) return [];
  return CLIENT_LABELS.filter((row) => row.match.test(clientName)).map((row) => row.code);
}

export function applyClientLabelRequirements(
  drafts: RequirementDraft[],
  clientName: string | null | undefined,
): RequirementDraft[] {
  const want = new Set(dispatchCodesForClient(clientName));
  return drafts.map((draft) => {
    if (draft.typeCode !== "ETIQUETAS_TECPETROL" && draft.typeCode !== "ETIQUETAS_PLUSPETROL") {
      return draft;
    }
    const on = want.has(draft.typeCode);
    return { ...draft, applicable: on, required: on };
  });
}

export type ReviewMarkupBox = { x: number; y: number; w: number; h: number };
export type ReviewMarkup = { boxes: ReviewMarkupBox[] };

export function parseReviewMarkup(raw: unknown): ReviewMarkup | null {
  if (!raw || typeof raw !== "object") return null;
  const boxes = (raw as { boxes?: unknown }).boxes;
  if (!Array.isArray(boxes)) return null;
  const clean = boxes
    .map((box) => {
      if (!box || typeof box !== "object") return null;
      const { x, y, w, h } = box as Record<string, unknown>;
      if ([x, y, w, h].some((value) => typeof value !== "number" || Number.isNaN(value))) return null;
      return {
        x: clamp01(x as number),
        y: clamp01(y as number),
        w: clamp01(w as number),
        h: clamp01(h as number),
      };
    })
    .filter((box): box is ReviewMarkupBox => box !== null && box.w > 0.02 && box.h > 0.02);
  return clean.length ? { boxes: clean } : null;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
