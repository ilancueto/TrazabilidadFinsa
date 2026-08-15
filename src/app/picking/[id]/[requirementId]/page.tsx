import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EvidenceCapture } from "@/components/picking/evidence-capture";
import { UploadSuccess } from "@/components/picking/upload-success";
import { requireRole } from "@/lib/auth/session";
import { canUploadEvidence } from "@/lib/deliveries/permissions";
import { getDeliveryDetail } from "@/lib/deliveries/queries";
import { pickingDeliveryPath } from "@/lib/deliveries/paths";

export const metadata = { title: "Cargar evidencia" };

export default async function CapturePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; requirementId: string }>;
  searchParams: Promise<{ error?: string; uploaded?: string }>;
}) {
  const user = await requireRole(["PICKING", "ADMIN"]);
  const { id, requirementId } = await params;
  const { error, uploaded } = await searchParams;
  const detail = await getDeliveryDetail(id);
  if (!detail) notFound();
  if (id !== detail.number) redirect(pickingDeliveryPath(detail.number, requirementId));
  const requirement = detail.requirements.find((req) => req.id === requirementId);
  if (!requirement || !requirement.applicable) notFound();

  if (!canUploadEvidence(user.role, detail.status)) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Link href={pickingDeliveryPath(detail.number)} className="back-link">
          ← {detail.number}
        </Link>
        <p className="panel p-4 text-sm">Ahora no se pueden cargar fotos en esta entrega.</p>
      </div>
    );
  }

  const applicable = detail.requirements.filter((item) => item.applicable);
  const step = applicable.findIndex((item) => item.id === requirement.id) + 1;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href={pickingDeliveryPath(detail.number)} className="back-link">
        ← {detail.number}
      </Link>
      <div>
        <p className="page-kicker">
          {detail.number} · paso {step} de {applicable.length}
        </p>
        <h1 className="page-title">{requirement.label}</h1>
        <p className="page-sub">Elegí o sacá la foto y después tocá Subir foto.</p>
        {requirement.guidance ? <p className="mt-2 text-sm text-cat">{requirement.guidance}</p> : null}
        {uploaded ? (
          <div className="mt-3">
            <UploadSuccess />
          </div>
        ) : null}
      </div>
      <EvidenceCapture
        requirementId={requirement.id}
        deliveryNumber={detail.number}
        label={requirement.label}
        serverError={error}
      />
    </div>
  );
}
