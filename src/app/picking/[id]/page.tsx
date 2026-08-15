import Link from "next/link";
import { notFound } from "next/navigation";
import { AssignmentActions } from "@/components/delivery/assignment-actions";
import { Checklist } from "@/components/delivery/checklist";
import { ObservationForm } from "@/components/delivery/observation-form";
import { StatusActions } from "@/components/delivery/status-actions";
import { Timeline } from "@/components/delivery/timeline";
import { PriorityBadge } from "@/components/priority-badge";
import { StatusBadge } from "@/components/status-badge";
import { UploadSuccess } from "@/components/picking/upload-success";
import { requireRole } from "@/lib/auth/session";
import { MODALITY_LABEL } from "@/lib/constants";
import { nextPendingRequirement } from "@/lib/deliveries/progress";
import { getDeliveryDetail } from "@/lib/deliveries/queries";
import { DueBadge } from "@/components/due-badge";
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
  const next = nextPendingRequirement(detail.requirements);
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

      <section className="panel p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="page-kicker">Entrega</p>
            <h1 className="font-mono text-3xl font-semibold tracking-tight">{detail.number}</h1>
            <p className="mt-1">{detail.destination}</p>
            <p className="text-sm text-muted">
              {MODALITY_LABEL[detail.modality]} · {formatPackages(detail.packages)}
            </p>
          </div>
          <div className="space-y-1 text-right">
            <StatusBadge status={detail.status} />
            <PriorityBadge priority={detail.priority} />
            <DueBadge dueAt={detail.due_at} status={detail.status} />
          </div>
        </div>
        <p className="mt-3 text-sm">
          {detail.progress.complete}/{detail.progress.total} requisitos con foto
        </p>
      </section>

      {next && detail.status !== "CLOSED" ? (
        <Link href={`/picking/${detail.id}/${next.id}`} className="btn btn-primary btn-block btn-lg">
          Subir foto: {next.label}
        </Link>
      ) : null}

      {detail.status !== "CLOSED" && !next && detail.progress.pendingRequired === 0 ? (
        <p className="banner banner-ok">Ya están las fotos obligatorias. Podés marcarla lista.</p>
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
          {detail.status !== "CLOSED" ? <ObservationForm deliveryId={detail.id} /> : null}
        </div>
      </section>
      <Timeline audit={detail.audit} />
    </div>
  );
}
