import { notFound } from "next/navigation";
import { Checklist } from "@/components/delivery/checklist";
import { ObservationForm } from "@/components/delivery/observation-form";
import { StatusActions } from "@/components/delivery/status-actions";
import { Timeline } from "@/components/delivery/timeline";
import { PriorityBadge } from "@/components/priority-badge";
import { ProgressBar } from "@/components/progress-bar";
import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/lib/auth/session";
import { MODALITY_LABEL } from "@/lib/constants";
import { getDeliveryDetail } from "@/lib/deliveries/queries";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Detalle de entrega" };

export default async function AdminDeliveryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(["ADMIN"]);
  const { id } = await params;
  const detail = await getDeliveryDetail(id);
  if (!detail) notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted">{detail.id}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{detail.number}</h1>
          <p className="text-sm text-muted">{detail.destination}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={detail.status} />
          <PriorityBadge priority={detail.priority} />
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <Info label="Modalidad" value={MODALITY_LABEL[detail.modality]} />
        <Info label="Bultos" value={String(detail.packages)} />
        <Info label="Responsable" value={detail.assignee?.full_name ?? "Sin asignar"} />
        <Info label="Actualizada" value={formatDateTime(detail.updated_at)} />
      </section>

      <ProgressBar progress={detail.progress} />
      {detail.has_open_observation ? (
        <p className="rounded-md bg-cat/30 px-3 py-2 text-sm font-medium">
          Hay una observación abierta.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Checklist detail={detail} role={user.role} />
        <div className="space-y-4">
          <StatusActions detail={detail} role={user.role} />
          <section className="rounded-md border border-line bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold">Observaciones</h2>
            <pre className="mb-3 whitespace-pre-wrap font-sans text-sm text-muted">
              {detail.observations || "Sin observaciones."}
            </pre>
            {detail.status !== "CLOSED" ? <ObservationForm deliveryId={detail.id} /> : null}
          </section>
          <Timeline audit={detail.audit} />
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
