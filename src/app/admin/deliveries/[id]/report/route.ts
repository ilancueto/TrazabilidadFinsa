import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { canDownloadReport } from "@/lib/deliveries/permissions";
import { getDeliveryDetail } from "@/lib/deliveries/queries";
import { buildDeliveryReportPdf } from "@/lib/pdf/report";
import { getEvidenceStorage } from "@/lib/storage";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user || !canDownloadReport(user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await context.params;
  const detail = await getDeliveryDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
  }

  const storage = getEvidenceStorage();
  const images: Array<{ evidenceId: string; bytes: Uint8Array; mime: string }> = [];
  for (const req of detail.requirements) {
    for (const ev of req.evidences.filter((item) => !item.voided_at)) {
      try {
        const bytes = await storage.download(ev.storage_key);
        images.push({ evidenceId: ev.id, bytes, mime: ev.mime_type });
      } catch {
        // El PDF incluye un placeholder si falta el archivo.
      }
    }
  }

  const pdf = await buildDeliveryReportPdf(detail, images);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="entrega-${detail.number}-informe.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
