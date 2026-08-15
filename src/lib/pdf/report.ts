import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { AUDIT_LABEL, MODALITY_LABEL, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/constants";
import { hasActiveEvidence } from "@/lib/deliveries/progress";
import { formatDateTime } from "@/lib/utils";
import type { DeliveryDetail } from "@/lib/types";

const BLACK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.35, 0.33, 0.3);
const LINE = rgb(0.82, 0.8, 0.74);
const WHITE = rgb(1, 1, 1);

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

class ReportWriter {
  constructor(
    private doc: PDFDocument,
    private page: PDFPage,
    private font: PDFFont,
    private bold: PDFFont,
    private y: number,
  ) {}

  private ensure(height: number) {
    if (this.y - height < 48) {
      this.page = this.doc.addPage([595, 842]);
      this.y = 800;
    }
  }

  text(value: string, opts?: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> }) {
    const size = opts?.size ?? 10;
    const font = opts?.bold ? this.bold : this.font;
    const lines = wrap(value, font, size, 500);
    for (const line of lines) {
      this.ensure(size + 4);
      this.page.drawText(line, {
        x: 48,
        y: this.y,
        size,
        font,
        color: opts?.color ?? BLACK,
      });
      this.y -= size + 4;
    }
  }

  kv(label: string, value: string) {
    const lines = wrap(value, this.font, 10, 375);
    this.ensure(Math.max(16, lines.length * 14));
    this.page.drawText(label, { x: 48, y: this.y, size: 9, font: this.bold, color: MUTED });
    for (const [index, line] of lines.entries()) {
      this.page.drawText(line, { x: 170, y: this.y - index * 14, size: 10, font: this.font, color: BLACK });
    }
    this.y -= Math.max(16, lines.length * 14);
  }

  gap(n = 10) {
    this.y -= n;
  }

  rule() {
    this.ensure(12);
    this.page.drawLine({
      start: { x: 48, y: this.y },
      end: { x: 547, y: this.y },
      thickness: 1,
      color: LINE,
    });
    this.y -= 12;
  }

  async image(bytes: Uint8Array, mime: string, caption: string) {
    this.ensure(280);
    try {
      const img =
        mime === "image/png" ? await this.doc.embedPng(bytes) : await this.doc.embedJpg(bytes);
      const maxW = 460;
      const maxH = 240;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = img.width * scale;
      const h = img.height * scale;
      this.page.drawImage(img, { x: 48, y: this.y - h, width: w, height: h });
      this.y -= h + 6;
      this.text(caption, { size: 8, color: MUTED });
    } catch {
      this.page.drawRectangle({
        x: 48,
        y: this.y - 40,
        width: 360,
        height: 40,
        borderColor: LINE,
        borderWidth: 1,
      });
      this.y -= 16;
      this.text(`(No se pudo incrustar la foto) ${caption}`, { size: 8, color: MUTED });
      this.y -= 20;
    }
  }
}

export async function buildDeliveryReportPdf(
  detail: DeliveryDetail,
  images: Array<{ evidenceId: string; bytes: Uint8Array; mime: string }>,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595, 842]);

  page.drawRectangle({ x: 0, y: 790, width: 595, height: 52, color: BLACK });
  try {
    const logoBytes = await readFile(join(process.cwd(), "public/brand/finning-cat-logo.png"));
    const logo = await doc.embedPng(logoBytes);
    const logoH = 32;
    const logoW = (logo.width / logo.height) * logoH;
    page.drawImage(logo, { x: 18, y: 800, width: logoW, height: logoH });
    page.drawText("TRAZABILIDAD DE ENTREGAS", {
      x: 18 + logoW + 14,
      y: 810,
      size: 11,
      font: bold,
      color: WHITE,
    });
  } catch {
    page.drawText("FINNING CAT  ·  TRAZABILIDAD DE ENTREGAS", {
      x: 24,
      y: 810,
      size: 12,
      font: bold,
      color: WHITE,
    });
  }

  const writer = new ReportWriter(doc, page, font, bold, 768);
  writer.text(`Entrega ${detail.number}`, { bold: true, size: 18 });
  writer.text("Informe de preparación y despacho", { size: 9, color: MUTED });
  writer.gap(8);
  writer.kv("Modalidad", MODALITY_LABEL[detail.modality]);
  writer.kv("Estado", STATUS_LABEL[detail.status]);
  writer.kv("Prioridad", PRIORITY_LABEL[detail.priority]);
  writer.kv("Destino / cliente", detail.destination);
  writer.kv("Bultos", String(detail.packages));
  writer.kv("Responsable", detail.assignee?.full_name ?? "Sin asignar");
  writer.kv("Creada por", detail.creator?.full_name ?? "—");
  writer.kv("Creada", formatDateTime(detail.created_at));
  writer.kv("Actualizada", formatDateTime(detail.updated_at));
  writer.kv("Progreso", `${detail.progress.complete}/${detail.progress.total} requisitos`);
  writer.gap(4);
  writer.rule();
  writer.text("Observaciones", { bold: true, size: 12 });
  writer.text(detail.observations?.trim() || "Sin observaciones.");
  writer.gap(6);
  writer.rule();
  writer.text("Checklist", { bold: true, size: 12 });
  writer.gap(4);

  const imageMap = new Map(images.map((img) => [img.evidenceId, img]));

  for (const req of detail.requirements) {
    const mark = !req.applicable ? "NO APLICA" : hasActiveEvidence(req) ? "OK" : req.required ? "FALTA" : "SIN FOTO";
    writer.text(`${mark}  ·  ${req.label}${req.required && req.applicable ? " (obligatorio)" : ""}`, {
      size: 11,
      bold: true,
    });
  }

  writer.gap(8);
  writer.rule();
  writer.text("Evidencias", { bold: true, size: 12 });

  for (const req of detail.requirements) {
    if (!req.applicable) continue;
    const active = req.evidences.filter((ev) => !ev.voided_at);
    writer.gap(6);
    writer.text(req.label, { bold: true, size: 12 });
    if (active.length === 0) {
      writer.text("Sin foto.", { size: 9, color: MUTED });
      continue;
    }
    for (const ev of active) {
      const rejected = ev.review_status === "REJECTED";
      const caption = [
        req.label,
        ev.uploader_name ?? "—",
        formatDateTime(ev.created_at),
        ev.comment,
        rejected ? `Rechazada: ${ev.review_note || "sin nota"}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      const img = imageMap.get(ev.id);
      if (img && !rejected) {
        await writer.image(img.bytes, img.mime, caption);
      } else {
        writer.text(caption, { size: 8, color: MUTED });
      }
    }
  }

  writer.gap(8);
  writer.rule();
  writer.text("Historial", { bold: true, size: 12 });
  for (const event of detail.audit) {
    const kind = typeof event.metadata.kind === "string" ? event.metadata.kind : event.action;
    const label = AUDIT_LABEL[kind] || AUDIT_LABEL[event.action] || event.action;
    const reason =
      typeof event.metadata.reason === "string"
        ? event.metadata.reason
        : typeof event.metadata.text === "string"
          ? event.metadata.text
          : typeof event.metadata.note === "string"
            ? event.metadata.note
            : "";
    writer.text(
      `${formatDateTime(event.created_at)}  ·  ${label}  ·  ${event.actor_name ?? "Sistema"}${reason ? `  ·  ${reason}` : ""}`,
      { size: 8 },
    );
  }

  return doc.save();
}
