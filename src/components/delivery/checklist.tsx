import Link from "next/link";
import { EvidenceItem } from "@/components/delivery/evidence-item";
import { formatDateTime } from "@/lib/utils";
import { hasActiveEvidence } from "@/lib/deliveries/progress";
import { canUploadDispatch, canUploadFloor, canVoidEvidence } from "@/lib/deliveries/permissions";
import { pickingDeliveryPath } from "@/lib/deliveries/paths";
import { requirementStage } from "@/lib/deliveries/stages";
import type { DeliveryDetail, UserRole } from "@/lib/types";

export async function Checklist({
  detail,
  role,
}: {
  detail: DeliveryDetail;
  role: UserRole;
}) {
  const captureBase = role === "PICKING" ? pickingDeliveryPath(detail.number) : null;
  const floor = detail.requirements.filter((req) => requirementStage(req) === "FLOOR");
  const dispatch = detail.requirements.filter((req) => requirementStage(req) === "DISPATCH");

  return (
    <div className="space-y-4">
      <RequirementStageList
        title="Etapa 1 · Piso"
        hint={
          detail.progress.pendingRequired > 0
            ? `Faltan ${detail.progress.pendingRequired} para marcar lista`
            : "Piso listo. Se puede marcar lista."
        }
        items={floor}
        detail={detail}
        role={role}
        captureBase={captureBase}
        canCapture={Boolean(captureBase) && canUploadFloor(role, detail.status)}
      />
      {dispatch.length > 0 ? (
        <RequirementStageList
          title="Etapa 2 · Etiquetas"
          hint="Andreani, Tecpetrol o Pluspetrol. No traba el picking de bodega; sí hace falta para cerrar."
          items={dispatch}
          detail={detail}
          role={role}
          captureBase={captureBase}
          canCapture={Boolean(captureBase) && canUploadDispatch(role, detail.status)}
        />
      ) : null}
    </div>
  );
}

function RequirementStageList({
  title,
  hint,
  items,
  detail,
  role,
  captureBase,
  canCapture,
}: {
  title: string;
  hint: string;
  items: DeliveryDetail["requirements"];
  detail: DeliveryDetail;
  role: UserRole;
  captureBase: string | null;
  canCapture: boolean;
}) {
  return (
    <section className="panel overflow-hidden">
      <header className="panel-head flex items-end justify-between gap-3">
        <div>
          <h2 className="panel-title">{title}</h2>
          <p className="mt-1 text-xs text-muted">{hint}</p>
        </div>
      </header>
      <ol className="divide-y divide-line">
        {items.map((req, index) => {
          const active = req.evidences.filter((ev) => !ev.voided_at);
          const rejected = active.filter((ev) => ev.review_status === "REJECTED");
          const done = req.applicable && hasActiveEvidence(req);
          return (
            <li key={req.id} className="px-4 py-4">
              <div className="space-y-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                    <span className="font-mono text-xs text-muted">{index + 1}.</span>
                    <span>{req.label}</span>
                    {done ? (
                      <span className="inline-flex items-center rounded-full bg-ok/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-ok border border-ok/30">
                        ok
                      </span>
                    ) : null}
                    {req.required && req.applicable && !done ? (
                      <span className="inline-flex items-center rounded-full bg-cat/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-cat border border-cat/30">
                        falta
                      </span>
                    ) : null}
                    {!req.applicable ? (
                      <span className="inline-flex items-center rounded-full bg-elevated px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-muted border border-line/60">
                        no aplica
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {!req.applicable
                      ? "No aplica en esta entrega"
                      : active.length > 0
                        ? `${active.length} foto${active.length === 1 ? "" : "s"}`
                        : "Todavía sin foto"}
                  </p>
                  {req.guidance && req.applicable ? (
                    <p className="mt-1 text-xs text-cat/90 font-medium">💡 {req.guidance}</p>
                  ) : null}
                  {rejected.map((ev) => (
                    <div key={`${ev.id}-rejected`} className="mt-2.5 rounded-xl border border-danger/40 bg-danger/10 p-2.5 text-xs text-danger font-medium flex items-center gap-2">
                      <span>⚠</span>
                      <span>Foto rechazada{ev.review_note ? `: ${ev.review_note}` : ". Volvé a cargarla."}</span>
                    </div>
                  ))}
                </div>
                {req.applicable && canCapture ? (
                  <Link
                    href={`${captureBase}/${req.id}`}
                    prefetch={false}
                    className="btn btn-primary btn-block rounded-xl shadow-xs active:scale-[0.98] font-bold text-sm"
                  >
                    Subir foto
                  </Link>
                ) : null}
              </div>
              {active.length > 0 ? (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {active.map((ev) => (
                    <div key={ev.id} className="space-y-1">
                      <EvidenceItem
                        evidenceId={ev.id}
                        src={`/api/evidence/${ev.id}/file`}
                        thumbSrc={`/api/evidence/${ev.id}/file?variant=thumb`}
                        alt={ev.comment || ev.filename}
                        caption={`${ev.uploader_name ?? "—"} · ${formatDateTime(ev.created_at)}`}
                        canVoid={canVoidEvidence(role, detail.status)}
                        markup={ev.review_markup}
                      />
                      {ev.review_status === "REJECTED" ? (
                        <p className="text-[10px] font-extrabold uppercase text-danger">Rechazada</p>
                      ) : ev.review_status === "ACCEPTED" ? (
                        <p className="text-[10px] font-extrabold uppercase text-ok">Aceptada</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
