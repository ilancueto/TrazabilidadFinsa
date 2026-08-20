import type {
  DeliveryProgress,
  DeliveryRequirement,
  RequirementTypeCode,
} from "@/lib/types";
import { requirementStage, type RequirementStage } from "@/lib/deliveries/stages";

type ProgressSource = Pick<
  DeliveryRequirement,
  "applicable" | "required" | "status" | "label"
> & {
  type_code?: RequirementTypeCode;
  stage?: RequirementStage | string | null;
  evidences?: Array<{ voided_at: string | null; review_status?: string | null }>;
};

export function hasActiveEvidence(item: {
  status: string;
  evidences?: Array<{ voided_at: string | null; review_status?: string | null }>;
}): boolean {
  if (item.evidences) {
    return item.evidences.some(
      (evidence) => !evidence.voided_at && evidence.review_status !== "REJECTED",
    );
  }
  return item.status === "COMPLETE";
}

export function computeProgress(requirements: ProgressSource[]): DeliveryProgress {
  const applicable = requirements.filter((item) => item.applicable);
  const floor = applicable.filter((item) => requirementStage(item) === "FLOOR");
  const dispatch = applicable.filter((item) => requirementStage(item) === "DISPATCH");
  const pendingFloor = floor.filter((item) => item.required && !hasActiveEvidence(item));
  const pendingDispatch = dispatch.filter((item) => item.required && !hasActiveEvidence(item));

  return {
    complete: floor.filter((item) => hasActiveEvidence(item)).length,
    total: floor.length,
    pendingRequired: pendingFloor.length,
    pendingCriticalLabels: pendingFloor.map((item) => item.label),
    pendingDispatch: pendingDispatch.length,
    pendingDispatchLabels: pendingDispatch.map((item) => item.label),
    dispatchComplete: dispatch.filter((item) => hasActiveEvidence(item)).length,
    dispatchTotal: dispatch.length,
  };
}

export function isReadyBlocked(progress: DeliveryProgress): boolean {
  return progress.pendingRequired > 0;
}

export function isCloseBlocked(progress: DeliveryProgress): boolean {
  return progress.pendingRequired > 0 || progress.pendingDispatch > 0;
}

export function nextPendingRequirement<
  T extends {
    applicable: boolean;
    required: boolean;
    status: string;
    type_code?: string;
    stage?: string | null;
    evidences?: Array<{ voided_at: string | null; review_status?: string | null }>;
  },
>(requirements: T[], stage: RequirementStage = "FLOOR"): T | null {
  const scoped = requirements.filter((item) => requirementStage(item) === stage);
  const pending = (item: T) => item.applicable && !hasActiveEvidence(item);
  return scoped.find((item) => item.required && pending(item)) ?? scoped.find(pending) ?? null;
}
