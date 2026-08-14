import { notFound } from "next/navigation";
import { DeliveryForm } from "@/components/admin/delivery-form";
import { pickingStartedWarning } from "@/lib/deliveries/permissions";
import { getDeliveryDetail, listPickingProfiles, listRequirementTypes } from "@/lib/deliveries/queries";

export const metadata = { title: "Editar entrega" };

export default async function EditDeliveryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, types, pickers] = await Promise.all([
    getDeliveryDetail(id),
    listRequirementTypes(),
    listPickingProfiles(),
  ]);
  if (!detail) notFound();
  if (detail.status === "CLOSED") {
    return (
      <p className="rounded-md border border-line bg-white p-4">
        La entrega cerrada está bloqueada. Usá el flujo de reapertura en el detalle.
      </p>
    );
  }

  const hasEvidence = detail.requirements.some((req) => req.evidences.some((ev) => !ev.voided_at));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Editar {detail.number}</h1>
        <p className="text-sm text-muted">Los cambios relevantes quedan en el historial.</p>
      </div>
      <DeliveryForm
        types={types}
        pickers={pickers}
        detail={detail}
        pickingStarted={pickingStartedWarning(detail.status, hasEvidence)}
      />
    </div>
  );
}
