"use client";

import { useActionState, useState, useTransition } from "react";
import {
  claimDeliveryAction,
  reassignDeliveryAction,
  releaseDeliveryAction,
  type ActionState,
} from "@/lib/actions/deliveries";
import type { DeliveryDetail, Profile, UserRole } from "@/lib/types";
import {
  canClaimDelivery,
  canReassignDelivery,
  canReleaseDelivery,
} from "@/lib/deliveries/permissions";

export function AssignmentActions({
  detail,
  role,
  userId,
  pickers = [],
}: {
  detail: DeliveryDetail;
  role: UserRole;
  userId: string;
  pickers?: Profile[];
}) {
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [reassignState, reassignAction, reassignPending] = useActionState(
    reassignDeliveryAction,
    {} as ActionState,
  );

  const canClaim = canClaimDelivery(role, detail.status, detail.assignee_id, userId);
  const canRelease = canReleaseDelivery(role, detail.status, detail.assignee_id, userId);
  const canReassign = canReassignDelivery(role, detail.status);
  if (!canClaim && !canRelease && !canReassign) return null;

  const alert = reassignState.error || reassignState.success || feedback;

  return (
    <div className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Responsable</h2>
      </div>
      <div className="space-y-3 p-4">
        <p className="text-base font-medium">{detail.assignee?.full_name ?? "Sin asignar"}</p>
        <div className="flex flex-wrap gap-2">
          {canClaim ? (
            <button
              type="button"
              disabled={pending}
              className="btn btn-primary"
              onClick={() =>
                start(async () => {
                  const result = await claimDeliveryAction(detail.id);
                  setFeedback(result.error || result.success || null);
                })
              }
            >
              {pending ? "Tomando…" : "La tomo yo"}
            </button>
          ) : null}
          {canRelease ? (
            <button
              type="button"
              disabled={pending}
              className="btn btn-ghost"
              onClick={() =>
                start(async () => {
                  const result = await releaseDeliveryAction(detail.id);
                  setFeedback(result.error || result.success || null);
                })
              }
            >
              Soltar
            </button>
          ) : null}
        </div>
        {canReassign ? (
          <form action={reassignAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="deliveryId" value={detail.id} />
            <label className="min-w-48 flex-1">
              <span className="label">Pasársela a</span>
              <select name="assigneeId" defaultValue={detail.assignee_id ?? ""} className="field">
                <option value="">Sin asignar</option>
                {pickers.map((picker) => (
                  <option key={picker.id} value={picker.id}>
                    {picker.full_name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={reassignPending} className="btn btn-ghost">
              {reassignPending ? "…" : "Asignar"}
            </button>
          </form>
        ) : null}
        {alert ? (
          <p className={reassignState.error || feedback?.startsWith("No") ? "banner banner-danger" : "banner banner-ok"}>
            {alert}
          </p>
        ) : null}
      </div>
    </div>
  );
}
