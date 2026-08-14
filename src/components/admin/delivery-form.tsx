"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveDeliveryAction, type ActionState } from "@/lib/actions/deliveries";
import { MODALITY_LABEL, PRIORITY_LABEL } from "@/lib/constants";
import { buildRequirementDrafts } from "@/lib/deliveries/templates";
import type {
  DeliveryDetail,
  DeliveryModality,
  DeliveryPriority,
  Profile,
  RequirementDraft,
  RequirementType,
} from "@/lib/types";

function draftsFromDetail(detail: DeliveryDetail): RequirementDraft[] {
  return detail.requirements.map((req) => ({
    typeCode: req.type_code,
    typeId: req.requirement_type_id,
    label: req.label,
    required: req.required,
    applicable: req.applicable,
    displayOrder: req.display_order,
  }));
}

export function DeliveryForm({
  types,
  pickers,
  detail,
  pickingStarted,
}: {
  types: RequirementType[];
  pickers: Profile[];
  detail?: DeliveryDetail;
  pickingStarted?: boolean;
}) {
  const router = useRouter();
  const typeIds = useMemo(
    () => Object.fromEntries(types.map((type) => [type.code, type.id])) as Record<
      RequirementType["code"],
      string
    >,
    [types],
  );
  const labels = useMemo(
    () => Object.fromEntries(types.map((type) => [type.code, type.label])) as Record<
      RequirementType["code"],
      string
    >,
    [types],
  );

  const [modality, setModality] = useState<DeliveryModality>(detail?.modality ?? "ANDREANI");
  const [requirements, setRequirements] = useState<RequirementDraft[]>(
    detail ? draftsFromDetail(detail) : buildRequirementDrafts("ANDREANI", typeIds, labels),
  );
  const [state, action, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await saveDeliveryAction(prev, formData);
      if (result.deliveryId && !result.error) {
        router.push(`/admin/deliveries/${result.deliveryId}`);
      }
      return result;
    },
    {} as ActionState,
  );

  function changeModality(next: DeliveryModality) {
    setModality(next);
    setRequirements(buildRequirementDrafts(next, typeIds, labels));
  }

  function updateReq(index: number, patch: Partial<RequirementDraft>) {
    setRequirements((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  return (
    <form action={action} className="space-y-6">
      {detail ? <input type="hidden" name="id" value={detail.id} /> : null}
      <input type="hidden" name="requirements" value={JSON.stringify(requirements)} />
      <input type="hidden" name="modality" value={modality} />

      {pickingStarted ? (
        <p className="rounded-md border border-cat bg-cat/20 px-3 py-2 text-sm">
          Picking ya inició o hay evidencias. Los cambios quedan auditados.
        </p>
      ) : null}

      <section className="grid gap-4 rounded-md border border-line bg-white p-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Número de entrega
          </span>
          <input
            name="number"
            required
            defaultValue={detail?.number}
            placeholder="806042590"
            className="w-full rounded-md border border-line px-3 py-2.5 font-mono"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Modalidad
          </span>
          <select
            value={modality}
            onChange={(event) => changeModality(event.target.value as DeliveryModality)}
            className="w-full rounded-md border border-line px-3 py-2.5"
          >
            {(Object.keys(MODALITY_LABEL) as DeliveryModality[]).map((key) => (
              <option key={key} value={key}>
                {MODALITY_LABEL[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="block md:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Destino / cliente
          </span>
          <input
            name="destination"
            required
            defaultValue={detail?.destination}
            placeholder="Cliente demo — no usar datos reales"
            className="w-full rounded-md border border-line px-3 py-2.5"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Bultos
          </span>
          <input
            name="packages"
            type="number"
            min={1}
            required
            defaultValue={detail?.packages ?? 1}
            className="w-full rounded-md border border-line px-3 py-2.5"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Prioridad
          </span>
          <select
            name="priority"
            defaultValue={detail?.priority ?? "NORMAL"}
            className="w-full rounded-md border border-line px-3 py-2.5"
          >
            {(Object.keys(PRIORITY_LABEL) as DeliveryPriority[]).map((key) => (
              <option key={key} value={key}>
                {PRIORITY_LABEL[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="block md:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Responsable Picking
          </span>
          <select
            name="assigneeId"
            defaultValue={detail?.assignee_id ?? ""}
            className="w-full rounded-md border border-line px-3 py-2.5"
          >
            <option value="">Sin asignar</option>
            {pickers.map((picker) => (
              <option key={picker.id} value={picker.id}>
                {picker.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="block md:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Observaciones
          </span>
          <textarea
            name="observations"
            rows={3}
            defaultValue={detail?.observations ?? ""}
            className="w-full rounded-md border border-line px-3 py-2.5"
          />
        </label>
      </section>

      <section className="rounded-md border border-line bg-white p-4">
        <h2 className="text-sm font-semibold">Requisitos de la plantilla</h2>
        <p className="mb-3 text-xs text-muted">
          Picking no podrá cambiar aplica / no aplica. Ajustalo antes de publicar.
        </p>
        <ul className="divide-y divide-line">
          {requirements.map((req, index) => (
            <li key={req.typeCode} className="flex flex-wrap items-center gap-3 py-3">
              <span className="min-w-40 flex-1 font-medium">{req.label}</span>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={req.applicable}
                  onChange={(event) => updateReq(index, { applicable: event.target.checked })}
                />
                Aplica
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={req.required}
                  disabled={!req.applicable}
                  onChange={(event) => updateReq(index, { required: event.target.checked })}
                />
                Obligatorio
              </label>
            </li>
          ))}
        </ul>
      </section>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          name="intent"
          value="draft"
          disabled={pending}
          className="rounded-md border border-line bg-white px-4 py-3 text-sm font-semibold disabled:opacity-60"
        >
          Guardar borrador
        </button>
        <button
          type="submit"
          name="intent"
          value="publish"
          disabled={pending}
          className="rounded-md bg-anthracite px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Publicar"}
        </button>
      </div>
    </form>
  );
}
