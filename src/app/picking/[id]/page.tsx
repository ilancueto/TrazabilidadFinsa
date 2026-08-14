import Link from "next/link";
import { notFound } from "next/navigation";
import { Checklist } from "@/components/delivery/checklist";
import { ObservationForm } from "@/components/delivery/observation-form";
import { StatusActions } from "@/components/delivery/status-actions";
import { Timeline } from "@/components/delivery/timeline";
import { PriorityBadge } from "@/components/priority-badge";
import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/lib/auth/session";
import { MODALITY_LABEL } from "@/lib/constants";
import { getDeliveryDetail } from "@/lib/deliveries/queries";

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

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href="/picking" className="text-sm text-muted">
        ← Pendientes
      </Link>
      {uploaded ? (
        <p className="rounded-md bg-cat/30 px-3 py-2 text-sm font-medium">
          Foto guardada. Ya figura en el checklist.
        </p>
      ) : null}
      <div>
        <h1 className="font-mono text-3xl font-semibold">{detail.number}</h1>
        <p>{detail.destination}</p>
        <p className="text-sm text-muted">
          {MODALITY_LABEL[detail.modality]} · {detail.packages} bultos
        </p>
        <div className="mt-2 flex gap-2">
          <StatusBadge status={detail.status} />
          <PriorityBadge priority={detail.priority} />
        </div>
      </div>
      <Checklist detail={detail} role={user.role === "ADMIN" ? "PICKING" : user.role} />
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
  );
}
