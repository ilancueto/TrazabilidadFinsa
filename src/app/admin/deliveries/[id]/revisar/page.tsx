import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AssignmentActions } from "@/components/delivery/assignment-actions";
import { StatusActions } from "@/components/delivery/status-actions";
import { ReviewPhotoActions } from "@/components/admin/review-photo";
import { PhotoThumb } from "@/components/photo-lightbox";
import { canReviewEvidence } from "@/lib/deliveries/permissions";
import { PriorityBadge } from "@/components/priority-badge";
import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/lib/auth/session";
import { MODALITY_LABEL } from "@/lib/constants";
import { hasActiveEvidence } from "@/lib/deliveries/progress";
import { getDeliveryDetail, listPickingProfiles } from "@/lib/deliveries/queries";
import { adminDeliveryPath } from "@/lib/deliveries/paths";
import { formatDateTime, formatPackages } from "@/lib/utils";

export const metadata = { title: "Revisar entrega" };

export default async function ReviewDeliveryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(["ADMIN", "SUPERVISOR"]);
  const { id } = await params;
  const [detail, pickers] = await Promise.all([getDeliveryDetail(id), listPickingProfiles()]);
  if (!detail) notFound();
  if (id !== detail.number) redirect(adminDeliveryPath(detail.number, "/revisar"));
  const applicable = detail.requirements.filter((req) => req.applicable);
  const reviewEnabled = canReviewEvidence(user.role, detail.status);

  return (
    <div className="space-y-4">
      <Link href="/admin/revision" className="back-link">
        ← Para revisar
      </Link>

      <div className="page-head">
        <div>
          <p className="page-kicker">Revisión de fotos</p>
          <h1 className="font-mono text-3xl font-semibold tracking-tight">{detail.number}</h1>
          <p className="page-sub">{detail.destination}</p>
          <p className="text-sm text-muted">
            {MODALITY_LABEL[detail.modality]} · {formatPackages(detail.packages)} ·{" "}
            {detail.assignee?.full_name ?? "Sin asignar"}
          </p>
        </div>
        <div className="space-y-1 text-right">
          <StatusBadge status={detail.status} />
          <PriorityBadge priority={detail.priority} />
        </div>
      </div>

      {detail.has_open_observation ? (
        <p className="banner banner-cat">Hay una observación abierta.</p>
      ) : null}
      {!reviewEnabled ? (
        <p className="banner banner-cat">
          {user.role === "SUPERVISOR"
            ? "Vista de solo lectura."
            : "La revisión sólo se puede modificar mientras la entrega está lista."}
        </p>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        {applicable.map((req) => {
          const active = req.evidences.filter((ev) => !ev.voided_at);
          const done = hasActiveEvidence(req);
          return (
            <article key={req.id} className="panel">
              <header className="panel-head flex items-center justify-between gap-2">
                <h2 className="font-semibold">{req.label}</h2>
                {done ? (
                  <span className="text-[11px] font-extrabold uppercase text-ok">ok</span>
                ) : (
                  <span className="bg-cat px-1.5 py-0.5 text-[11px] font-extrabold uppercase text-ink">falta</span>
                )}
              </header>
              <div className="p-4">
                {req.guidance ? <p className="mb-3 text-xs text-cat">{req.guidance}</p> : null}
                {active.length === 0 ? (
                  <p className="text-sm text-muted">Todavía no hay foto.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {active.map((ev) => (
                      <div key={ev.id} className="space-y-2">
                        <PhotoThumb
                          src={`/api/evidence/${ev.id}/file`}
                          thumbSrc={`/api/evidence/${ev.id}/file?variant=thumb`}
                          alt={ev.comment || ev.filename}
                          caption={`${ev.uploader_name ?? "—"} · ${formatDateTime(ev.created_at)}`}
                        />
                        {reviewEnabled ? (
                          <ReviewPhotoActions
                            evidenceId={ev.id}
                            status={ev.review_status}
                            src={`/api/evidence/${ev.id}/file?variant=thumb`}
                            markup={ev.review_markup}
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <StatusActions detail={detail} role={user.role} />
        <AssignmentActions detail={detail} role={user.role} userId={user.id} pickers={pickers} />
      </div>
    </div>
  );
}
