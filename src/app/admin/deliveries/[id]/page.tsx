import Link from "next/link";
import { notFound } from "next/navigation";
import { AssignmentActions } from "@/components/delivery/assignment-actions";
import { Checklist } from "@/components/delivery/checklist";
import { ObservationForm } from "@/components/delivery/observation-form";
import { StatusActions } from "@/components/delivery/status-actions";
import { Timeline } from "@/components/delivery/timeline";
import { PriorityBadge } from "@/components/priority-badge";
import { ProgressBar } from "@/components/progress-bar";
import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/lib/auth/session";
import { MODALITY_LABEL } from "@/lib/constants";
import { getDeliveryDetail, listPickingProfiles } from "@/lib/deliveries/queries";
import { DueBadge } from "@/components/due-badge";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Detalle de entrega" };

export default async function AdminDeliveryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(["ADMIN", "SUPERVISOR"]);
  const { id } = await params;
  const [detail, pickers] = await Promise.all([getDeliveryDetail(id), listPickingProfiles()]);
  if (!detail) notFound();

  return (
    <div className="space-y-4">
      <Link href="/admin" className="back-link">
        ← Entregas
      </Link>
      <div className="page-head">
        <div>
          <p className="page-kicker">Entrega</p>
          <h1 className="font-mono text-3xl font-semibold tracking-tight">{detail.number}</h1>
          <p className="page-sub">{detail.destination}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={detail.status} />
          <PriorityBadge priority={detail.priority} />
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Info label="Modalidad" value={MODALITY_LABEL[detail.modality]} />
        <Info label="Bultos" value={String(detail.packages)} />
        <Info label="Responsable" value={detail.assignee?.full_name ?? "Sin asignar"} />
        <Info label="Actualizada" value={formatDateTime(detail.updated_at)} />
        <div className="kpi">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Sale</p>
          <div className="mt-1">
            <DueBadge dueAt={detail.due_at} status={detail.status} />
            {!detail.due_at ? <p className="text-sm font-medium">Sin hora</p> : null}
          </div>
        </div>
      </section>

      <div className="panel p-4">
        <ProgressBar progress={detail.progress} />
      </div>
      {detail.has_open_observation ? (
        <p className="banner banner-cat">Hay una observación abierta. Revisala antes de cerrar.</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <Checklist detail={detail} role={user.role} />
        <div className="space-y-4">
          <StatusActions detail={detail} role={user.role} />
          <AssignmentActions detail={detail} role={user.role} userId={user.id} pickers={pickers} />
          <section className="panel">
            <header className="panel-head">
              <h2 className="panel-title">Observaciones</h2>
            </header>
            <div className="p-4">
              <pre className="mb-3 whitespace-pre-wrap font-sans text-sm text-muted">
                {detail.observations || "Sin observaciones."}
              </pre>
              {user.role === "ADMIN" && detail.status !== "CLOSED" ? (
                <ObservationForm deliveryId={detail.id} />
              ) : null}
            </div>
          </section>
          <Timeline audit={detail.audit} />
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi">
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
