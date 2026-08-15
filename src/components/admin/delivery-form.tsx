"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { saveDeliveryAction, type ActionState } from "@/lib/actions/deliveries";
import { MODALITY_LABEL, PRIORITY_LABEL } from "@/lib/constants";
import { adminDeliveryPath } from "@/lib/deliveries/paths";
import { mergeDraftsWithTemplate } from "@/lib/deliveries/templates";
import type {
  DeliveryDetail,
  DeliveryModality,
  DeliveryPriority,
  Profile,
  RequirementDraft,
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
  pickers,
  detail,
  pickingStarted,
  templates,
}: {
  pickers: Profile[];
  detail?: DeliveryDetail;
  pickingStarted?: boolean;
  templates: Record<DeliveryModality, RequirementDraft[]>;
}) {
  const router = useRouter();

  const [modality, setModality] = useState<DeliveryModality>(detail?.modality ?? "ANDREANI");
  const [requirements, setRequirements] = useState<RequirementDraft[]>(
    detail ? mergeDraftsWithTemplate(draftsFromDetail(detail), templates[detail.modality]) : templates.ANDREANI,
  );
  const [state, action, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await saveDeliveryAction(prev, formData);
      if (result.deliveryNumber && !result.error) {
        router.push(adminDeliveryPath(result.deliveryNumber));
      }
      return result;
    },
    {} as ActionState,
  );

  function changeModality(next: DeliveryModality) {
    setModality(next);
    setRequirements(templates[next] ?? []);
  }

  function updateReq(index: number, patch: Partial<RequirementDraft>) {
    setRequirements((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  return (
    <form action={action} className="space-y-5">
      {detail ? <input type="hidden" name="id" value={detail.id} /> : null}
      <input type="hidden" name="requirements" value={JSON.stringify(requirements)} />
      <input type="hidden" name="modality" value={modality} />

      {pickingStarted ? (
        <p className="banner banner-cat">Esta entrega ya tiene fotos. Si cambiás algo, queda registrado.</p>
      ) : null}

      <section className="panel">
        <header className="panel-head">
          <h2 className="panel-title">Datos de la entrega</h2>
        </header>
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <label className="block">
            <span className="label">Número de entrega</span>
            <input
              name="number"
              required
              defaultValue={detail?.number}
              placeholder="806042590"
              className="field font-mono"
            />
          </label>
          <label className="block">
            <span className="label">Modalidad</span>
            <select
              value={modality}
              onChange={(event) => changeModality(event.target.value as DeliveryModality)}
              className="field"
            >
              {(Object.keys(MODALITY_LABEL) as DeliveryModality[]).map((key) => (
                <option key={key} value={key}>
                  {MODALITY_LABEL[key]}
                </option>
              ))}
            </select>
          </label>
          <label className="block md:col-span-2">
            <span className="label">Destino / cliente</span>
            <input
              name="destination"
              required
              defaultValue={detail?.destination}
              placeholder="Cliente o destino"
              className="field"
            />
          </label>
          <label className="block">
            <span className="label">Bultos</span>
            <input
              name="packages"
              type="number"
              min={1}
              required
              defaultValue={detail?.packages ?? 1}
              className="field"
            />
          </label>
          <label className="block">
            <span className="label">Prioridad</span>
            <select name="priority" defaultValue={detail?.priority ?? "NORMAL"} className="field">
              {(Object.keys(PRIORITY_LABEL) as DeliveryPriority[]).map((key) => (
                <option key={key} value={key}>
                  {PRIORITY_LABEL[key]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Responsable Picking</span>
            <select name="assigneeId" defaultValue={detail?.assignee_id ?? ""} className="field">
              <option value="">Sin asignar</option>
              {pickers.map((picker) => (
                <option key={picker.id} value={picker.id}>
                  {picker.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="block md:col-span-2">
            <span className="label">Observaciones</span>
            <textarea name="observations" rows={3} defaultValue={detail?.observations ?? ""} className="field" />
          </label>
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2 className="panel-title">Qué hay que fotografiar</h2>
        </header>
        <div className="p-4">
          <p className="mb-3 text-sm text-muted">Desmarcá lo que no corresponda a esta entrega.</p>
          <ul className="divide-y divide-line">
            {requirements.length === 0 ? (
              <p className="banner banner-danger">Esta modalidad no tiene requisitos. Cargalos en Requisitos.</p>
            ) : null}
            {requirements.map((req, index) => (
              <li key={req.typeCode} className="check-row py-3">
                <span className="min-w-40 flex-1 font-medium">{req.label}</span>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={req.applicable}
                    onChange={(event) => updateReq(index, { applicable: event.target.checked })}
                  />
                  Aplica
                </label>
                <label className="check">
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
        </div>
      </section>

      {state.error ? <p className="banner banner-danger">{state.error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button type="submit" name="intent" value="draft" disabled={pending} className="btn btn-ghost">
          Guardar borrador
        </button>
        <button type="submit" name="intent" value="publish" disabled={pending} className="btn btn-primary">
          {pending ? "Guardando…" : "Publicar"}
        </button>
      </div>
    </form>
  );
}
