import type {
  DeliveryProgress,
  DeliveryRequirement,
  RequirementTypeCode,
} from "@/lib/types";

type ProgressSource = Pick<
  DeliveryRequirement,
  "applicable" | "required" | "status" | "label"
> & {
  type_code?: RequirementTypeCode;
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
  const complete = applicable.filter((item) => hasActiveEvidence(item)).length;
  const pendingRequiredItems = applicable.filter(
    (item) => item.required && !hasActiveEvidence(item),
  );

  return {
    complete,
    total: applicable.length,
    pendingRequired: pendingRequiredItems.length,
    pendingCriticalLabels: pendingRequiredItems.map((item) => item.label),
  };
}

export function isReadyBlocked(progress: DeliveryProgress): boolean {
  return progress.pendingRequired > 0;
}

export function nextPendingRequirement<
  T extends {
    applicable: boolean;
    required: boolean;
    status: string;
    evidences?: Array<{ voided_at: string | null; review_status?: string | null }>;
  },
>(requirements: T[]): T | null {
  const pending = (item: T) => item.applicable && !hasActiveEvidence(item);
  return (
    requirements.find((item) => item.required && pending(item)) ??
    requirements.find(pending) ??
    null
  );
}
