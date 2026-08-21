import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { AUDIT_LABEL, CARRIER_LABEL, MODALITY_LABEL, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/constants";
import { hasActiveEvidence } from "@/lib/deliveries/progress";
import { formatDateTime } from "@/lib/utils";
import type { DeliveryDetail } from "@/lib/types";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 44;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BLACK = rgb(0.035, 0.047, 0.055);
const INK = rgb(0.08, 0.1, 0.11);
const MUTED = rgb(0.38, 0.42, 0.44);
const LINE = rgb(0.84, 0.85, 0.84);
const SOFT = rgb(0.965, 0.968, 0.96);
const YELLOW = rgb(1, 0.804, 0);
const GREEN = rgb(0.12, 0.55, 0.31);
const RED = rgb(0.78, 0.2, 0.16);
const WHITE = rgb(1, 1, 1);

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = String(text || "-").replace(/\s+/g, " ").trim().split(" ");
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
  return lines.length ? lines : ["-"];
}

class ReportWriter {
  private page!: PDFPage;
  private y = 0;

  constructor(
    private doc: PDFDocument,
    private font: PDFFont,
    private bold: PDFFont,
    private logo: PDFImage | null,
    private deliveryNumber: string,
  ) {
    this.addPage();
  }

  private addPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 72, width: PAGE_WIDTH, height: 72, color: BLACK });
    this.page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 76, width: PAGE_WIDTH, height: 4, color: YELLOW });

    let titleX = MARGIN;
    if (this.logo) {
      const height = 34;
      const width = (this.logo.width / this.logo.height) * height;
      this.page.drawImage(this.logo, { x: MARGIN, y: PAGE_HEIGHT - 55, width, height });
      titleX += width + 16;
    }
    this.page.drawText("INFORME DE ENTREGA", {
      x: titleX,
      y: PAGE_HEIGHT - 38,
      size: 12,
      font: this.bold,
      color: WHITE,
    });
    this.page.drawText(`BODEGA NEUQUEN  /  ${this.deliveryNumber}`, {
      x: titleX,
      y: PAGE_HEIGHT - 53,
      size: 7.5,
      font: this.bold,
      color: YELLOW,
    });
    this.y = PAGE_HEIGHT - 104;
  }

  private ensure(height: number) {
    if (this.y - height < 54) this.addPage();
  }

  title(title: string, subtitle: string) {
    this.ensure(78);
    this.page.drawText(title, { x: MARGIN, y: this.y, size: 24, font: this.bold, color: INK });
    this.y -= 25;
    for (const line of wrap(subtitle, this.font, 9.5, CONTENT_WIDTH)) {
      this.page.drawText(line, { x: MARGIN, y: this.y, size: 9.5, font: this.font, color: MUTED });
      this.y -= 13;
    }
    this.y -= 10;
  }

  statusStrip(status: string, priority: string, progress: string) {
    this.ensure(50);
    const items = [
      ["ESTADO", status],
      ["PRIORIDAD", priority],
      ["PROGRESO", progress],
    ];
    const width = (CONTENT_WIDTH - 12) / 3;
    items.forEach(([label, value], index) => {
      const x = MARGIN + index * (width + 6);
      this.page.drawRectangle({ x, y: this.y - 38, width, height: 38, color: index === 0 ? YELLOW : SOFT });
      this.page.drawText(label, { x: x + 10, y: this.y - 13, size: 6.5, font: this.bold, color: MUTED });
      this.page.drawText(value, { x: x + 10, y: this.y - 29, size: 10, font: this.bold, color: INK });
    });
    this.y -= 52;
  }

  section(title: string, subtitle?: string, minimumBodyHeight = 0) {
    this.ensure((subtitle ? 56 : 42) + minimumBodyHeight);
    this.page.drawRectangle({ x: MARGIN, y: this.y - 3, width: 28, height: 3, color: YELLOW });
    this.y -= 20;
    this.page.drawText(title.toUpperCase(), { x: MARGIN, y: this.y, size: 11, font: this.bold, color: INK });
    this.y -= 15;
    if (subtitle) {
      for (const line of wrap(subtitle, this.font, 8.5, CONTENT_WIDTH)) {
        this.page.drawText(line, { x: MARGIN, y: this.y, size: 8.5, font: this.font, color: MUTED });
        this.y -= 11;
      }
    }
    this.y -= 8;
  }

  infoGrid(entries: Array<[string, string]>) {
    const columnWidth = (CONTENT_WIDTH - 10) / 2;
    for (let index = 0; index < entries.length; index += 2) {
      const pair = entries.slice(index, index + 2);
      const lineSets = pair.map(([, value]) => wrap(value, this.font, 9.5, columnWidth - 20));
      const height = Math.max(48, ...lineSets.map((lines) => 29 + lines.length * 12));
      this.ensure(height + 8);
      pair.forEach(([label], column) => {
        const x = MARGIN + column * (columnWidth + 10);
        this.page.drawRectangle({ x, y: this.y - height, width: columnWidth, height, color: SOFT });
        this.page.drawText(label.toUpperCase(), { x: x + 10, y: this.y - 15, size: 6.5, font: this.bold, color: MUTED });
        lineSets[column].forEach((line, lineIndex) => {
          this.page.drawText(line, { x: x + 10, y: this.y - 31 - lineIndex * 12, size: 9.5, font: this.font, color: INK });
        });
      });
      this.y -= height + 8;
    }
  }

  paragraph(text: string, opts?: { muted?: boolean }) {
    const lines = wrap(text, this.font, 9.5, CONTENT_WIDTH - 20);
    const height = 20 + lines.length * 13;
    this.ensure(height + 4);
    this.page.drawRectangle({ x: MARGIN, y: this.y - height, width: CONTENT_WIDTH, height, color: SOFT });
    lines.forEach((line, index) => {
      this.page.drawText(line, { x: MARGIN + 10, y: this.y - 18 - index * 13, size: 9.5, font: this.font, color: opts?.muted ? MUTED : INK });
    });
    this.y -= height + 8;
  }

  checklistRow(label: string, state: "OK" | "PENDING" | "OPTIONAL" | "NA", required: boolean) {
    const lines = wrap(label, this.font, 9.5, CONTENT_WIDTH - 128);
    const height = Math.max(36, 14 + lines.length * 12);
    this.ensure(height + 4);
    this.page.drawRectangle({ x: MARGIN, y: this.y - height, width: CONTENT_WIDTH, height, color: SOFT });
    const stateColor = state === "OK" ? GREEN : state === "PENDING" ? RED : MUTED;
    this.page.drawRectangle({ x: MARGIN, y: this.y - height, width: 4, height, color: stateColor });
    lines.forEach((line, index) => {
      this.page.drawText(line, { x: MARGIN + 14, y: this.y - 21 - index * 12, size: 9.5, font: index === 0 ? this.bold : this.font, color: INK });
    });
    const chipWidth = state === "OPTIONAL" ? 62 : 48;
    this.page.drawRectangle({ x: PAGE_WIDTH - MARGIN - chipWidth - 10, y: this.y - 27, width: chipWidth, height: 18, color: stateColor });
    this.page.drawText(state, { x: PAGE_WIDTH - MARGIN - chipWidth - 4, y: this.y - 21.5, size: 6.5, font: this.bold, color: WHITE });
    if (required) this.page.drawText("OBLIGATORIO", { x: PAGE_WIDTH - MARGIN - 118, y: this.y - 21, size: 6, font: this.bold, color: MUTED });
    this.y -= height + 4;
  }

  evidenceHeading(label: string, count: number) {
    this.ensure(36);
    this.page.drawText(label, { x: MARGIN, y: this.y, size: 11, font: this.bold, color: INK });
    this.page.drawText(`${count} ${count === 1 ? "FOTO" : "FOTOS"}`, { x: PAGE_WIDTH - MARGIN - 55, y: this.y, size: 7, font: this.bold, color: MUTED });
    this.y -= 18;
  }

  async image(bytes: Uint8Array, mime: string, caption: string) {
    const captionLines = wrap(caption, this.font, 7.5, CONTENT_WIDTH - 20);
    const blockHeight = 278 + captionLines.length * 10;
    this.ensure(blockHeight);
    try {
      const image = mime === "image/png" ? await this.doc.embedPng(bytes) : await this.doc.embedJpg(bytes);
      const frameHeight = 250;
      this.page.drawRectangle({ x: MARGIN, y: this.y - frameHeight, width: CONTENT_WIDTH, height: frameHeight, color: BLACK });
      const scale = Math.min((CONTENT_WIDTH - 16) / image.width, (frameHeight - 16) / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      this.page.drawImage(image, {
        x: MARGIN + (CONTENT_WIDTH - width) / 2,
        y: this.y - frameHeight + (frameHeight - height) / 2,
        width,
        height,
      });
      this.y -= frameHeight + 8;
      captionLines.forEach((line, index) => {
        this.page.drawText(line, { x: MARGIN + 8, y: this.y - index * 10, size: 7.5, font: this.font, color: MUTED });
      });
      this.y -= captionLines.length * 10 + 12;
    } catch {
      this.page.drawRectangle({ x: MARGIN, y: this.y - 54, width: CONTENT_WIDTH, height: 54, color: SOFT, borderColor: LINE, borderWidth: 1 });
      this.page.drawText("La imagen no pudo incorporarse al informe.", { x: MARGIN + 12, y: this.y - 23, size: 9, font: this.bold, color: RED });
      this.y -= 68;
    }
  }

  empty(text: string) {
    this.ensure(34);
    this.page.drawText(text, { x: MARGIN, y: this.y, size: 9, font: this.font, color: MUTED });
    this.y -= 24;
  }

  historyRow(date: string, label: string, actor: string, reason: string) {
    const detail = [actor, reason].filter(Boolean).join("  /  ");
    const detailLines = wrap(detail || "Sistema", this.font, 8, CONTENT_WIDTH - 128);
    const height = Math.max(34, 20 + detailLines.length * 10);
    this.ensure(height + 2);
    this.page.drawCircle({ x: MARGIN + 4, y: this.y - 9, size: 3, color: YELLOW });
    this.page.drawText(date, { x: MARGIN + 16, y: this.y - 12, size: 7.5, font: this.font, color: MUTED });
    this.page.drawText(label, { x: MARGIN + 125, y: this.y - 12, size: 8.5, font: this.bold, color: INK });
    detailLines.forEach((line, index) => {
      this.page.drawText(line, { x: MARGIN + 125, y: this.y - 24 - index * 10, size: 8, font: this.font, color: MUTED });
    });
    this.y -= height;
  }

  finish() {
    const pages = this.doc.getPages();
    pages.forEach((page, index) => {
      page.drawLine({ start: { x: MARGIN, y: 38 }, end: { x: PAGE_WIDTH - MARGIN, y: 38 }, thickness: 0.6, color: LINE });
      page.drawText("Finning CAT  /  Bodega Neuquen", { x: MARGIN, y: 23, size: 7, font: this.font, color: MUTED });
      const pageText = `Pagina ${index + 1} de ${pages.length}`;
      page.drawText(pageText, { x: PAGE_WIDTH - MARGIN - this.font.widthOfTextAtSize(pageText, 7), y: 23, size: 7, font: this.font, color: MUTED });
    });
  }
}

export async function buildDeliveryReportPdf(
  detail: DeliveryDetail,
  images: Array<{ evidenceId: string; bytes: Uint8Array; mime: string }>,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Informe de entrega ${detail.number}`);
  doc.setAuthor("Finning CAT - Bodega Neuquen");
  doc.setSubject("Trazabilidad de preparación y despacho");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let logo: PDFImage | null = null;
  try {
    const logoBytes = await readFile(join(process.cwd(), "public/brand/finning-cat-logo.png"));
    logo = await doc.embedPng(logoBytes);
  } catch {
    // El encabezado conserva la marca tipográfica si el recurso no está disponible.
  }

  const writer = new ReportWriter(doc, font, bold, logo, detail.number);
  const completed = detail.progress.complete;
  const total = detail.progress.total;
  writer.title(`Entrega ${detail.number}`, `Informe de preparacion y trazabilidad generado el ${formatDateTime(new Date().toISOString())}`);
  writer.statusStrip(STATUS_LABEL[detail.status], PRIORITY_LABEL[detail.priority], `${completed} / ${total}`);

  writer.section("Datos de la entrega");
  writer.infoGrid([
    ["Cliente", detail.client_name ?? "—"],
    ["Destino", detail.destination],
    ["Modalidad", MODALITY_LABEL[detail.modality]],
    ["Transportista", detail.carrier ? CARRIER_LABEL[detail.carrier] : "—"],
    ["Bultos", String(detail.packages)],
    ["Lote / Pallet", detail.pallet_code ?? "—"],
    ["Responsable", detail.assignee?.full_name ?? "Sin asignar"],
    ["Creada por", detail.creator?.full_name ?? "Sistema"],
    ["Creada", formatDateTime(detail.created_at)],
    ["Ultima actualizacion", formatDateTime(detail.updated_at)],
    ["Cierre", detail.closed_at ? formatDateTime(detail.closed_at) : "Pendiente"],
  ]);

  writer.section("Observaciones");
  writer.paragraph(detail.observations?.trim() || "Sin observaciones registradas.", { muted: !detail.observations?.trim() });

  writer.section("Checklist", `${completed} de ${total} requisitos aplicables completos.`);
  for (const req of detail.requirements) {
    const state = !req.applicable
      ? "NA"
      : hasActiveEvidence(req)
        ? "OK"
        : req.required
          ? "PENDING"
          : "OPTIONAL";
    writer.checklistRow(req.label, state, req.required && req.applicable);
  }

  const imageMap = new Map(images.map((image) => [image.evidenceId, image]));
  writer.section("Evidencias", "Se muestran solamente fotos activas que no fueron rechazadas.", 300);
  let evidenceCount = 0;
  for (const req of detail.requirements) {
    if (!req.applicable) continue;
    const active = req.evidences.filter((evidence) => !evidence.voided_at && evidence.review_status !== "REJECTED");
    if (active.length === 0) continue;
    evidenceCount += active.length;
    writer.evidenceHeading(req.label, active.length);
    for (const evidence of active) {
      const caption = [
        evidence.uploader_name ?? "Usuario no identificado",
        formatDateTime(evidence.created_at),
        evidence.review_status === "ACCEPTED" ? "Revisada y aceptada" : "Pendiente de revision",
        evidence.comment?.trim() || null,
      ].filter(Boolean).join("  /  ");
      const image = imageMap.get(evidence.id);
      if (image) await writer.image(image.bytes, image.mime, caption);
      else writer.empty(`Foto no disponible en el momento de generar el informe. ${caption}`);
    }
  }
  if (evidenceCount === 0) writer.empty("No hay evidencias activas para mostrar.");

  writer.section("Historial", "Registro cronologico de acciones realizadas sobre la entrega.", 70);
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
    writer.historyRow(formatDateTime(event.created_at), label, event.actor_name ?? "Sistema", reason);
  }

  writer.finish();
  return doc.save();
}
