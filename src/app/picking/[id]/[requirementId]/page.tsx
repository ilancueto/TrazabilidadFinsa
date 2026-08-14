import Link from "next/link";
import { notFound } from "next/navigation";
import { EvidenceCapture } from "@/components/picking/evidence-capture";
import { requireRole } from "@/lib/auth/session";
import { getDeliveryDetail } from "@/lib/deliveries/queries";

export const metadata = { title: "Cargar evidencia" };

export default async function CapturePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; requirementId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole(["PICKING", "ADMIN"]);
  const { id, requirementId } = await params;
  const { error } = await searchParams;
  const detail = await getDeliveryDetail(id);
  if (!detail) notFound();
  const requirement = detail.requirements.find((req) => req.id === requirementId);
  if (!requirement || !requirement.applicable) notFound();

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href={`/picking/${id}`} className="text-sm text-muted">
        ← {detail.number}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">{requirement.label}</h1>
        <p className="text-sm text-muted">En iPhone: elegí la foto y después tocá Subir foto.</p>
      </div>
      <EvidenceCapture
        requirementId={requirement.id}
        deliveryId={detail.id}
        label={requirement.label}
        serverError={error}
      />
    </div>
  );
}
