import Link from "next/link";
import { EvidenceItem } from "@/components/delivery/evidence-item";
import { formatDateTime } from "@/lib/utils";
import { hasActiveEvidence } from "@/lib/deliveries/progress";
import { canVoidEvidence } from "@/lib/deliveries/permissions";
import { pickingDeliveryPath } from "@/lib/deliveries/paths";
import { signedEvidenceUrlMap } from "@/lib/evidence/urls";
import type { DeliveryDetail, UserRole } from "@/lib/types";

export async function Checklist({
  detail,
  role,
}: {
  detail: DeliveryDetail;
  role: UserRole;
}) {
  const imageUrls = await signedEvidenceUrlMap(detail.requirements.flatMap((req) => req.evidences));
  const captureBase = role === "PICKING" ? pickingDeliveryPath(detail.number) : null;
  const canCapture = Boolean(captureBase) && detail.status !== "CLOSED";

  return (
    <section className="panel overflow-hidden">
      <header className="panel-head flex items-end justify-between gap-3">
        <div>
          <h2 className="panel-title">Requisitos</h2>
          <p className="mt-1 text-xs text-muted">
            {detail.progress.complete}/{detail.progress.total} con foto
            {detail.progress.pendingRequired > 0
              ? ` · faltan ${detail.progress.pendingRequired}`
              : " · listo lo obligatorio"}
          </p>
        </div>
      </header>
      <ol className="divide-y divide-line">
        {detail.requirements.map((req, index) => {
          const active = req.evidences.filter((ev) => !ev.voided_at);
          const rejected = active.filter((ev) => ev.review_status === "REJECTED");
          const done = req.applicable && hasActiveEvidence(req);
          return (
            <li key={req.id} className="px-4 py-4">
              <div className="space-y-3">
                <div>
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <span className="font-mono text-xs text-muted">{index + 1}.</span>
                    {req.label}
                    {done ? (
                      <span className="bg-ok px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-white">ok</span>
                    ) : null}
                    {req.required && req.applicable && !done ? (
                      <span className="bg-cat px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-ink">falta</span>
                    ) : null}
                    {!req.applicable ? (
                      <span className="text-[10px] font-extrabold uppercase text-muted">no aplica</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {!req.applicable
                      ? "No aplica en esta entrega"
                      : active.length > 0
                        ? `${active.length} foto${active.length === 1 ? "" : "s"}`
                        : "Todavía sin foto"}
                  </p>
                  {req.guidance && req.applicable ? (
                    <p className="mt-1 text-xs text-cat">{req.guidance}</p>
                  ) : null}
                  {rejected.map((ev) => (
                    <p key={`${ev.id}-rejected`} className="mt-2 rounded-sm border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
                      Foto rechazada{ev.review_note ? `: ${ev.review_note}` : ". Volvé a cargarla."}
                    </p>
                  ))}
                </div>
                {req.applicable && canCapture ? (
                  <Link href={`${captureBase}/${req.id}`} className="btn btn-primary btn-block">
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
                        src={imageUrls.get(ev.id)?.src ?? `/api/evidence/${ev.id}/file`}
                        thumbSrc={imageUrls.get(ev.id)?.thumbSrc ?? `/api/evidence/${ev.id}/file?variant=thumb`}
                        alt={ev.comment || ev.filename}
                        caption={`${ev.uploader_name ?? "—"} · ${formatDateTime(ev.created_at)}`}
                        canVoid={canVoidEvidence(role, detail.status)}
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
