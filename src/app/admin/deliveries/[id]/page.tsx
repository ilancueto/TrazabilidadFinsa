import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AssignmentActions } from "@/components/delivery/assignment-actions";
import { Checklist } from "@/components/delivery/checklist";
import { ObservationForm } from "@/components/delivery/observation-form";
import { StatusActions } from "@/components/delivery/status-actions";
import { Timeline } from "@/components/delivery/timeline";
import { PriorityBadge } from "@/components/priority-badge";
import { ProgressBar } from "@/components/progress-bar";
import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/lib/auth/session";
import { CARRIER_LABEL, MODALITY_LABEL } from "@/lib/constants";
import { canAddObservation } from "@/lib/deliveries/permissions";
import { getDeliveryDetail, listPickingProfiles } from "@/lib/deliveries/queries";
import { adminDeliveryPath } from "@/lib/deliveries/paths";

export const metadata = { title: "Detalle de entrega" };

export default async function AdminDeliveryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(["ADMIN", "SUPERVISOR"]);
  const { id } = await params;
  const detail = await getDeliveryDetail(id, { includeArchived: true });
  if (!detail) notFound();
  if (id !== detail.number) redirect(adminDeliveryPath(detail.number));

  if (detail.deleted_at) {
    return (
      <div className="space-y-4">
        <Link href="/admin" className="back-link">← Entregas</Link>
        <div className="page-head">
          <div><p className="page-kicker">Entrega archivada</p><h1 className="font-mono text-3xl font-semibold tracking-tight">{detail.number}</h1><p className="page-sub">{detail.destination}</p></div>
          <span className="banner banner-cat">Archivada · sólo lectura</span>
        </div>
        <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <Info label="Modalidad" value={MODALITY_LABEL[detail.modality]} />
          <Info label="Transportista" value={detail.carrier ? CARRIER_LABEL[detail.carrier] : "—"} />
          <Info label="Bultos" value={String(detail.packages)} />
          <Info label="Responsable" value={detail.assignee?.full_name ?? "Sin asignar"} />
        </section>
        <Timeline audit={detail.audit} />
      </div>
    );
  }
  const pickers = await listPickingProfiles();

  return (
    <div className="space-y-4">
      <Link href="/admin" className="back-link">
        ← Entregas
      </Link>
      <div className="page-head">
        <div>
          <p className="page-kicker">Entrega {detail.client_name ? `· ${detail.client_name}` : ""}</p>
          <h1 className="font-mono text-3xl sm:text-4xl font-bold tracking-tight text-cat">{detail.number}</h1>
          <p className="page-sub text-base font-medium">{detail.destination}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={detail.status} />
          <PriorityBadge priority={detail.priority} />
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
        <Info label="Modalidad" value={MODALITY_LABEL[detail.modality]} />
        <Info
          label="Transportista"
          value={detail.carrier ? CARRIER_LABEL[detail.carrier] : "—"}
        />
        <Info label="Bultos" value={String(detail.packages)} />
        <Info label="Responsable" value={detail.assignee?.full_name ?? "Sin asignar"} />
        <Info label="Lote / Pallet" value={detail.pallet_code ?? "—"} />
      </section>

      <div className="panel p-4 sm:p-5 rounded-2xl border-line/80 shadow-sm">
        <ProgressBar progress={detail.progress} size="md" />
      </div>
      {detail.has_open_observation ? (
        <p className="banner banner-cat rounded-xl">Hay una observación abierta. Revisala antes de cerrar.</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <Checklist detail={detail} role={user.role} />
        <div className="space-y-4">
          <StatusActions detail={detail} role={user.role} />
          <AssignmentActions detail={detail} role={user.role} userId={user.id} pickers={pickers} />
          <section className="panel rounded-2xl border-line/80 shadow-sm overflow-hidden">
            <header className="panel-head px-4 py-3 border-b border-line/70">
              <h2 className="panel-title">Observaciones</h2>
            </header>
            <div className="p-4 sm:p-5">
              <pre className="mb-3 whitespace-pre-wrap font-sans text-sm text-muted">
                {detail.observations || "Sin observaciones."}
              </pre>
              {canAddObservation(user.role, detail.status) ? (
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
    <div className="kpi rounded-xl border border-line bg-surface/70 p-3.5 shadow-xs">
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground truncate">{value}</p>
    </div>
  );
}
