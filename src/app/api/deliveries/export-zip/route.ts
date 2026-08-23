import { NextResponse } from "next/server";
import JSZip from "jszip";
import { requireRole } from "@/lib/auth/session";
import { getDeliveryDetail, listDeliveries } from "@/lib/deliveries/queries";
import { buildDeliveryReportPdf } from "@/lib/pdf/report";
import { getEvidenceStorage } from "@/lib/storage";
import { todayYmdAR } from "@/lib/time";
import {
  TECHNICAL_API_OPERATIONS,
  getRequestLogContext,
  logServerError,
  withTechnicalApiMetric,
} from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withTechnicalApiMetric(request, TECHNICAL_API_OPERATIONS.deliveriesExportZip, () => exportZip(request));
}

async function exportZip(request: Request) {
  const startedAt = performance.now();
  const logContext = getRequestLogContext(request);
  try {
    await requireRole(["ADMIN", "SUPERVISOR"]);
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawIds = searchParams.get("ids");
  const q = searchParams.get("q") || undefined;
  const status = searchParams.get("status") || undefined;
  const clientId = searchParams.get("clientId") || undefined;
  const palletCode = searchParams.get("palletCode") || undefined;

  let deliveryIds: string[] = [];

  if (rawIds) {
    deliveryIds = rawIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  } else {
    // Si no vienen IDs explícitos, exportar las entregas que coincidan con los filtros actuales
    const deliveries = await listDeliveries({
      q,
      status: status as import("@/lib/types").DeliveryStatus | "ALL",
      clientId: clientId as string | "ALL",
      palletCode,
      limit: 100,
    });
    deliveryIds = deliveries.map((d) => d.id);
  }

  if (deliveryIds.length === 0) {
    return NextResponse.json({ error: "No hay entregas para exportar" }, { status: 400 });
  }

  // Limitar a máximo 50 entregas por lote de ZIP para evitar timeouts
  const selectedIds = deliveryIds.slice(0, 50);
  const storage = getEvidenceStorage();
  const zip = new JSZip();

  for (const id of selectedIds) {
    const detail = await getDeliveryDetail(id);
    if (!detail) continue;

    const folderName = `Entrega_${detail.number}`;
    const folder = zip.folder(folderName);
    if (!folder) continue;

    // 1. Descargar fotos en paralelo concurrente
    const flatEvidences: Array<{
      req: (typeof detail.requirements)[0];
      ev: (typeof detail.requirements)[0]["evidences"][0];
      index: number;
    }> = [];

    for (const req of detail.requirements) {
      if (!req.applicable) continue;
      const active = req.evidences.filter(
        (e) => !e.voided_at && e.review_status !== "REJECTED",
      );
      active.forEach((ev, idx) => flatEvidences.push({ req, ev, index: idx }));
    }

    const downloadedImages: Array<{ evidenceId: string; bytes: Uint8Array; mime: string }> = [];
    const evidenceFolder = folder.folder("Evidencias");

    const CHUNK_SIZE = 5;
    for (let i = 0; i < flatEvidences.length; i += CHUNK_SIZE) {
      const chunk = flatEvidences.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async ({ req, ev, index }) => {
          try {
            let bytes = await storage.download(ev.storage_key);
            let mime = ev.mime_type;
            if (mime !== "image/png" && mime !== "image/jpeg") {
              const sharp = (await import("sharp")).default;
              bytes = new Uint8Array(await sharp(bytes).rotate().jpeg({ quality: 88 }).toBuffer());
              mime = "image/jpeg";
            }
            downloadedImages.push({ evidenceId: ev.id, bytes, mime });

            if (evidenceFolder) {
              const ext = ev.filename.includes(".") ? ev.filename.split(".").pop() : "jpg";
              const reqLabel = req.label.replace(/[^a-zA-Z0-9_-]/g, "_");
              const fileName = `${req.display_order}_${reqLabel}_${index + 1}.${ext}`;
              evidenceFolder.file(fileName, bytes);
            }
          } catch (downloadErr) {
            logServerError("export.evidence_download_failed", downloadErr, {
              ...logContext,
              operation: "deliveries.export_zip",
              deliveryId: detail.id,
              durationMs: performance.now() - startedAt,
              metadata: { evidenceId: ev.id },
            });
          }
        }),
      );
    }

    // 2. Generar e incluir PDF oficial
    try {
      const pdfBytes = await buildDeliveryReportPdf(detail, downloadedImages);
      folder.file(`Informe_${detail.number}.pdf`, pdfBytes);
    } catch (err) {
      logServerError("export.report_generation_failed", err, {
        ...logContext,
        operation: "deliveries.export_zip",
        deliveryId: detail.id,
        durationMs: performance.now() - startedAt,
      });
    }
  }

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const stamp = todayYmdAR();
  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="Entregas_CAT_${stamp}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
