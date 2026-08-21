"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveDeliveryAction, type ActionState } from "@/lib/actions/deliveries";
import { saveClientAction } from "@/lib/actions/clients";
import { MODALITY_LABEL, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/constants";
import { adminDeliveryPath } from "@/lib/deliveries/paths";
import { applyClientLabelRequirements } from "@/lib/deliveries/stages";
import { mergeDraftsWithTemplate } from "@/lib/deliveries/templates";
import type {
  Client,
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
  clients = [],
  detail,
  pickingStarted,
  templates,
}: {
  pickers: Profile[];
  clients?: Client[];
  detail?: DeliveryDetail;
  pickingStarted?: boolean;
  templates: Record<DeliveryModality, RequirementDraft[]>;
}) {
  const router = useRouter();

  const [modality, setModality] = useState<DeliveryModality>(detail?.modality ?? "DESPACHO");
  const [numberInput, setNumberInput] = useState(detail?.number ?? "");
  const [clientList, setClientList] = useState<Client[]>(clients);
  const [selectedClientId, setSelectedClientId] = useState(detail?.client_id ?? "");
  const [destination, setDestination] = useState(detail?.destination ?? "");
  const [showQuickAddClient, setShowQuickAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [clientSaveError, setClientSaveError] = useState("");

  const [duplicateStatus, setDuplicateStatus] = useState<"idle" | "checking" | "available" | "duplicate">("idle");
  const [duplicateInfo, setDuplicateInfo] = useState<{
    id: string;
    number: string;
    status: string;
    destination: string;
  } | null>(null);

  const [requirements, setRequirements] = useState<RequirementDraft[]>(
    detail ? mergeDraftsWithTemplate(draftsFromDetail(detail), templates[detail.modality]) : templates.DESPACHO,
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

  // Verificación en tiempo real de número duplicado
  useEffect(() => {
    const trimmed = numberInput.trim();
    if (trimmed.length < 3 || (detail && trimmed.toLowerCase() === detail.number.toLowerCase())) {
      const idleTimer = setTimeout(() => {
        setDuplicateStatus("idle");
        setDuplicateInfo(null);
      }, 0);
      return () => clearTimeout(idleTimer);
    }

    const timer = setTimeout(async () => {
      setDuplicateStatus("checking");
      try {
        const url = `/api/deliveries/check-number?number=${encodeURIComponent(trimmed)}${
          detail?.id ? `&excludeId=${detail.id}` : ""
        }`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.exists && data.delivery) {
          setDuplicateStatus("duplicate");
          setDuplicateInfo(data.delivery);
        } else {
          setDuplicateStatus("available");
          setDuplicateInfo(null);
        }
      } catch {
        setDuplicateStatus("idle");
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [numberInput, detail]);

  function changeModality(next: DeliveryModality) {
    setModality(next);
    const client = clientList.find((item) => item.id === selectedClientId);
    setRequirements(applyClientLabelRequirements(templates[next] ?? [], client?.name));
  }

  function updateReq(index: number, patch: Partial<RequirementDraft>) {
    setRequirements((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  async function handleQuickAddClient() {
    if (!newClientName.trim() || newClientName.trim().length < 2) {
      setClientSaveError("Ingresá un nombre de al menos 2 caracteres");
      return;
    }
    setIsSavingClient(true);
    setClientSaveError("");
    const formData = new FormData();
    formData.set("name", newClientName.trim());
    try {
      const res = await saveClientAction({}, formData);
      if (res.error) {
        setClientSaveError(res.error);
      } else if (res.clientId) {
        const created: Client = {
          id: res.clientId,
          name: newClientName.trim(),
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setClientList((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedClientId(res.clientId);
        setDestination(newClientName.trim());
        setRequirements((current) => applyClientLabelRequirements(current, created.name));
        setNewClientName("");
        setShowQuickAddClient(false);
      }
    } catch {
      setClientSaveError("Error al guardar cliente");
    } finally {
      setIsSavingClient(false);
    }
  }

  return (
    <form action={action} className="space-y-5">
      {detail ? <input type="hidden" name="id" value={detail.id} /> : null}
      <input type="hidden" name="requirements" value={JSON.stringify(requirements)} />
      <input type="hidden" name="modality" value={modality} />
      <input type="hidden" name="carrier" value={modality === "DESPACHO" ? "ANDREANI" : ""} />

      {pickingStarted ? (
        <p className="banner banner-cat">Esta entrega ya tiene fotos. Si cambiás algo, queda registrado.</p>
      ) : null}

      <section className="panel">
        <header className="panel-head">
          <h2 className="panel-title">Datos de la entrega</h2>
        </header>
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <div className="block">
            <label className="label" htmlFor="delivery-number-field">Número de entrega</label>
            <input
              id="delivery-number-field"
              name="number"
              required
              value={numberInput}
              onChange={(e) => setNumberInput(e.target.value)}
              placeholder="806042590"
              className={`field font-mono ${
                duplicateStatus === "duplicate"
                  ? "!border-danger ring-1 ring-danger"
                  : duplicateStatus === "available"
                    ? "!border-ok ring-1 ring-ok"
                    : ""
              }`}
              autoComplete="off"
            />
            {duplicateStatus === "checking" ? (
              <p className="mt-1 text-xs text-muted">Verificando número…</p>
            ) : duplicateStatus === "available" ? (
              <p className="mt-1 text-xs font-semibold text-ok">✓ Número disponible</p>
            ) : duplicateStatus === "duplicate" && duplicateInfo ? (
              <div className="mt-2 rounded-md border border-danger/40 bg-danger/10 p-2.5 text-xs text-danger">
                <p className="font-bold">⚠️ Ya existe la entrega {duplicateInfo.number}</p>
                <p className="mt-0.5 text-muted">
                  Destino: <span className="font-medium text-foreground">{duplicateInfo.destination}</span> · Estado:{" "}
                  <span className="font-semibold text-foreground">
                    {STATUS_LABEL[duplicateInfo.status as keyof typeof STATUS_LABEL] || duplicateInfo.status}
                  </span>
                </p>
                <a
                  href={adminDeliveryPath(duplicateInfo.number)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-block font-bold text-cat underline hover:opacity-80"
                >
                  Abrir entrega existente en nueva pestaña ↗
                </a>
              </div>
            ) : null}
          </div>
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
          <div className="grid gap-3 sm:grid-cols-2 md:col-span-2">
            <div className="block">
              <div className="flex items-center justify-between">
                <span className="label">Cliente (catálogo)</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickAddClient(!showQuickAddClient);
                    setClientSaveError("");
                  }}
                  className="text-xs font-bold text-cat hover:underline"
                >
                  {showQuickAddClient ? "✕ Cancelar" : "+ Nuevo cliente"}
                </button>
              </div>

              {showQuickAddClient ? (
                <div className="mt-1 space-y-2 rounded border border-cat/40 bg-cat/5 p-2.5">
                  <div className="flex gap-2">
                    <input
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleQuickAddClient();
                        }
                      }}
                      placeholder="Nombre del nuevo cliente…"
                      className="field flex-1 text-sm font-semibold"
                      autoFocus
                    />
                    <button
                      type="button"
                      disabled={isSavingClient}
                      onClick={handleQuickAddClient}
                      className="btn btn-primary btn-sm"
                    >
                      {isSavingClient ? "Guardando…" : "Crear"}
                    </button>
                  </div>
                  {clientSaveError ? <p className="text-xs text-danger">{clientSaveError}</p> : null}
                </div>
              ) : (
                <select
                  name="clientId"
                  value={selectedClientId}
                  onChange={(event) => {
                    const id = event.target.value;
                    setSelectedClientId(id);
                    const found = clientList.find((c) => c.id === id);
                    if (found && (!destination || clientList.some((c) => c.name === destination))) {
                      setDestination(found.name);
                    }
                    setRequirements((current) => applyClientLabelRequirements(current, found?.name ?? ""));
                  }}
                  className="field"
                >
                  <option value="">Seleccionar del catálogo…</option>
                  {clientList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <label className="block">
              <span className="label">Destino / Detalle</span>
              <input
                name="destination"
                required
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                placeholder="Base operativa, yacimiento o destino"
                className="field"
              />
            </label>
          </div>

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
            <span className="label">Lote / Pallet / OC (opcional)</span>
            <input
              name="palletCode"
              defaultValue={detail?.pallet_code ?? ""}
              placeholder="Ej: Pallet 1, OC-9841..."
              className="field font-mono"
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
