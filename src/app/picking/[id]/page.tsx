import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AssignmentActions } from "@/components/delivery/assignment-actions";
import { Checklist } from "@/components/delivery/checklist";
import { ObservationForm } from "@/components/delivery/observation-form";
import { StatusActions } from "@/components/delivery/status-actions";
import { Timeline } from "@/components/delivery/timeline";
import { PriorityBadge } from "@/components/priority-badge";
import { StatusBadge } from "@/components/status-badge";
import { ProgressBar } from "@/components/progress-bar";
import { UploadSuccess } from "@/components/picking/upload-success";
import { requireRole } from "@/lib/auth/session";
import { MODALITY_LABEL } from "@/lib/constants";
import { canAddObservation, canMarkReady, canUploadFloor } from "@/lib/deliveries/permissions";
import { nextPendingRequirement } from "@/lib/deliveries/progress";
import { getDeliveryDetail } from "@/lib/deliveries/queries";
import { pickingDeliveryPath } from "@/lib/deliveries/paths";
import { formatPackages } from "@/lib/utils";

export const metadata = { title: "Entrega" };

export default async function PickingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ uploaded?: string }>;
}) {
  const user = await requireRole(["PICKING", "ADMIN"]);
  const { id } = await params;
  const { uploaded } = await searchParams;
  const detail = await getDeliveryDetail(id);
  if (!detail) notFound();
  if (id !== detail.number) redirect(pickingDeliveryPath(detail.number));
  const next = nextPendingRequirement(detail.requirements, "FLOOR");
  const viewingAs = user.role === "ADMIN" ? "PICKING" : user.role;
  const lastReturn = [...detail.audit].reverse().find(
    (event) => event.action === "RETURNED" || event.metadata.kind === "RETURNED",
  );
  const returnReason =
    lastReturn && typeof lastReturn.metadata.reason === "string" ? lastReturn.metadata.reason : null;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href="/picking" className="back-link">
        ← Pendientes
      </Link>
      {uploaded ? <UploadSuccess /> : null}
      {returnReason && detail.status === "IN_PICKING" ? (
        <p className="banner banner-cat">Te la devolvieron: {returnReason}</p>
      ) : null}

      <section className="panel p-5 sm:p-6 rounded-2xl border-line/80 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="page-kicker">Entrega {detail.client_name ? `· ${detail.client_name}` : ""}</p>
            <h1 className="font-mono text-3xl sm:text-4xl font-bold tracking-tight text-cat">{detail.number}</h1>
            <p className="mt-1 text-base font-semibold text-foreground">{detail.destination}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="rounded-md bg-elevated px-2.5 py-1 font-medium border border-line/60">
                {MODALITY_LABEL[detail.modality]} · {formatPackages(detail.packages)}
              </span>
              {detail.pallet_code ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-cat/30 bg-cat/10 px-2 py-1 font-mono text-xs font-bold text-cat">
                  📦 {detail.pallet_code}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <StatusBadge status={detail.status} />
            <PriorityBadge priority={detail.priority} />
          </div>
        </div>
        <div className="mt-4 pt-3.5 border-t border-line/60">
          <ProgressBar progress={detail.progress} size="md" />
        </div>
      </section>

      {next && canUploadFloor(viewingAs, detail.status) ? (
        <Link
          href={pickingDeliveryPath(detail.number, next.id)}
          prefetch={false}
          className="btn btn-primary btn-block btn-lg rounded-2xl shadow-lg shadow-cat/20 active:scale-[0.98] font-bold text-base flex items-center justify-center gap-2.5"
        >
          <span className="text-xl">📷</span>
          <span>Subir foto: <strong>{next.label}</strong></span>
        </Link>
      ) : null}

      {canMarkReady(viewingAs, detail.status, detail.progress.pendingRequired) ? (
        <div className="banner banner-ok rounded-xl shadow-xs border border-ok/30 flex items-start gap-2.5">
          <span className="text-lg">✓</span>
          <p className="text-sm">
            El piso está listo. Podés marcarla lista
            {detail.progress.pendingDispatch > 0
              ? `. Las etiquetas (${detail.progress.pendingDispatchLabels.join(", ")}) no traban esta etapa.`
              : "."}
          </p>
        </div>
      ) : null}

      <Checklist detail={detail} role={viewingAs} />
      <AssignmentActions detail={detail} role={user.role} userId={user.id} />
      <StatusActions detail={detail} role={user.role} />
      <section className="panel">
        <header className="panel-head">
          <h2 className="panel-title">Observaciones</h2>
        </header>
        <div className="p-4">
          <pre className="mb-3 whitespace-pre-wrap font-sans text-sm text-muted">
            {detail.observations || "Sin observaciones."}
          </pre>
          {canAddObservation(user.role, detail.status) ? <ObservationForm deliveryId={detail.id} /> : null}
        </div>
      </section>
      <Timeline audit={detail.audit} />
    </div>
  );
}
