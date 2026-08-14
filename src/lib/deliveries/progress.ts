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
};

export function computeProgress(requirements: ProgressSource[]): DeliveryProgress {
  const applicable = requirements.filter((item) => item.applicable);
  const complete = applicable.filter((item) => item.status === "COMPLETE").length;
  const pendingRequiredItems = applicable.filter(
    (item) => item.required && item.status !== "COMPLETE",
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
