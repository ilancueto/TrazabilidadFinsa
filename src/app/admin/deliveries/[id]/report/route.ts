import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { canDownloadReport } from "@/lib/deliveries/permissions";
import { getDeliveryDetail } from "@/lib/deliveries/queries";
import { buildDeliveryReportPdf } from "@/lib/pdf/report";
import { getEvidenceStorage } from "@/lib/storage";
import { getRequestLogContext, logServerError, type ServerLogContext } from "@/lib/observability";

type RouteContext = { params: Promise<{ id: string }> };

async function downloadImages(
  rows: Array<{ id: string; storageKey: string; mime: string }>,
  logContext: ServerLogContext,
  concurrency = 4,
) {
  const storage = getEvidenceStorage();
  const images: Array<{ evidenceId: string; bytes: Uint8Array; mime: string }> = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, async () => {
    while (cursor < rows.length) {
      const row = rows[cursor++];
      try {
        let bytes = await storage.download(row.storageKey);
        let mime = row.mime;
        if (mime !== "image/png" && mime !== "image/jpeg") {
          const sharp = (await import("sharp")).default;
          bytes = new Uint8Array(await sharp(bytes).rotate().jpeg({ quality: 88 }).toBuffer());
          mime = "image/jpeg";
        }
        images.push({ evidenceId: row.id, bytes, mime });
      } catch (error) {
        logServerError("report.image_download_failed", error, {
          ...logContext,
          operation: "delivery.report",
          metadata: { evidenceId: row.id },
        });
        // El PDF incluye un placeholder si falta el archivo.
      }
    }
  }));
  return images;
}

export async function GET(request: Request, context: RouteContext) {
  const logContext = getRequestLogContext(request);
  const user = await getSessionUser();
  if (!user || !canDownloadReport(user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await context.params;
  const detail = await getDeliveryDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
  }

  const imageRows = detail.requirements.flatMap((req) =>
    req.evidences
      .filter((item) => !item.voided_at && item.review_status !== "REJECTED")
      .map((item) => ({ id: item.id, storageKey: item.storage_key, mime: item.mime_type })),
  );
  const images = await downloadImages(imageRows, logContext);

  const pdf = await buildDeliveryReportPdf(detail, images);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="entrega-${detail.number}-informe.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
