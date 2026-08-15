import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DeliveryForm } from "@/components/admin/delivery-form";
import { requireRole } from "@/lib/auth/session";
import { pickingStartedWarning } from "@/lib/deliveries/permissions";
import {
  getDeliveryDetail,
  listCatalogTemplates,
  listPickingProfiles,
  listRequirementTypes,
  templatesToDrafts,
} from "@/lib/deliveries/queries";
import { adminDeliveryPath } from "@/lib/deliveries/paths";

export const metadata = { title: "Editar entrega" };

export default async function EditDeliveryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["ADMIN"]);
  const { id } = await params;
  const [detail, types, pickers, templates] = await Promise.all([
    getDeliveryDetail(id),
    listRequirementTypes(),
    listPickingProfiles(),
    listCatalogTemplates(),
  ]);
  if (!detail) notFound();
  if (id !== detail.number) redirect(adminDeliveryPath(detail.number, "/edit"));
  if (detail.status === "CLOSED") {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href={adminDeliveryPath(detail.number)} className="back-link">
          ← Volver
        </Link>
        <p className="panel p-4">Esta entrega está cerrada. Para cambiarla, reapertura desde el detalle.</p>
      </div>
    );
  }

  const hasEvidence = detail.requirements.some((req) => req.evidences.some((ev) => !ev.voided_at));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href={adminDeliveryPath(detail.number)} className="back-link">
        ← {detail.number}
      </Link>
      <div>
        <p className="page-kicker">Editar</p>
        <h1 className="page-title">{detail.number}</h1>
        <p className="page-sub">Los cambios quedan en el historial de la entrega.</p>
      </div>
      <DeliveryForm
        pickers={pickers}
        detail={detail}
        pickingStarted={pickingStartedWarning(detail.status, hasEvidence)}
        templates={templatesToDrafts(templates, types)}
      />
    </div>
  );
}
