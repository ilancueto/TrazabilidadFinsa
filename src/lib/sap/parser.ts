import { resolveClientFromSap } from "@/lib/clients/matching";
import type { Client, ClientAlias } from "@/lib/types";

export type ParsedSapDelivery = {
  id: string; // id temporal para React keys
  number: string;
  rawCustomer: string;
  rawRoute: string;
  rawDestination: string;
  packages: number;
  isExcluded: boolean;
  excludeReason?: string;
  isDuplicate: boolean;
  matchedClient: Client | null;
  matchType: "alias" | "exact" | "fuzzy" | "none";
  selectedClientId: string | null;
  saveAliasOnImport: boolean;
};

export type SapParseResult = {
  totalRows: number;
  validCount: number;
  excludedCount: number;
  duplicateCount: number;
  deliveries: ParsedSapDelivery[];
};

const HEADER_SYNONYMS = {
  number: ["entrega", "doc. entrega", "doc.entrega", "documento", "nº entrega", "n° entrega", "delivery", "vbeln", "remito"],
  route: ["ruta", "route", "cod. ruta", "itinerario"],
  customer: ["destinatario", "nombre", "razon social", "razón social", "cliente", "customer", "name1", "name", "solicitante", "kunnr"],
  destination: ["poblacion", "población", "ciudad", "destino", "city", "ort01", "localidad", "domicilio"],
  packages: ["bultos", "cant", "cantidad", "anzpk", "posiciones", "pos."],
};

function normalizeHeader(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .trim();
}

function findColumnIndex(headers: string[], synonyms: string[]): number {
  return headers.findIndex((h) => {
    const norm = normalizeHeader(h);
    return synonyms.some((syn) => norm.includes(syn) || syn.includes(norm));
  });
}

function cleanCellText(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ") // quitar tags html
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parsea el texto o HTML de un reporte de SAP (ALV Grid)
 */
export function parseSapInput(
  rawInput: string,
  existingDeliveryNumbers: Set<string>,
  clients: Client[],
  aliases: ClientAlias[],
): SapParseResult {
  const isHtml = /<table|<tr|<html/i.test(rawInput);
  let rows: string[][] = [];

  if (isHtml) {
    rows = parseHtmlTable(rawInput);
  } else {
    rows = parsePlainText(rawInput);
  }

  if (rows.length === 0) {
    return {
      totalRows: 0,
      validCount: 0,
      excludedCount: 0,
      duplicateCount: 0,
      deliveries: [],
    };
  }

  // Detectar cabeceras si la primera fila parece ser de títulos
  let headers = rows[0].map(cleanCellText);
  let dataRows = rows.slice(1);

  let numIdx = findColumnIndex(headers, HEADER_SYNONYMS.number);
  let routeIdx = findColumnIndex(headers, HEADER_SYNONYMS.route);
  let custIdx = findColumnIndex(headers, HEADER_SYNONYMS.customer);
  let destIdx = findColumnIndex(headers, HEADER_SYNONYMS.destination);
  let pkgIdx = findColumnIndex(headers, HEADER_SYNONYMS.packages);

  // Si no se encontró la columna de entrega en la primera fila, quizás no tenía cabeceras
  if (numIdx === -1) {
    // Buscar si alguna fila contiene cabeceras en las primeras 5 filas
    let headerFoundRow = -1;
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const testHeaders = rows[i].map(cleanCellText);
      const testNumIdx = findColumnIndex(testHeaders, HEADER_SYNONYMS.number);
      if (testNumIdx !== -1) {
        headers = testHeaders;
        numIdx = testNumIdx;
        routeIdx = findColumnIndex(testHeaders, HEADER_SYNONYMS.route);
        custIdx = findColumnIndex(testHeaders, HEADER_SYNONYMS.customer);
        destIdx = findColumnIndex(testHeaders, HEADER_SYNONYMS.destination);
        pkgIdx = findColumnIndex(testHeaders, HEADER_SYNONYMS.packages);
        headerFoundRow = i;
        break;
      }
    }

    if (headerFoundRow !== -1) {
      dataRows = rows.slice(headerFoundRow + 1);
    } else {
      // Fallback: tratar la primera columna numérica como número de entrega
      dataRows = rows;
      numIdx = 0;
    }
  }

  const deliveries: ParsedSapDelivery[] = [];
  let validCount = 0;
  let excludedCount = 0;
  let duplicateCount = 0;

  dataRows.forEach((row, index) => {
    const rawNum = cleanCellText(row[numIdx] ?? "");
    if (!rawNum) return;

    // Normalizar número de entrega (conservar formato alfanumérico)
    const number = rawNum.replace(/^[0]+(?=\d{4,})/, "").trim(); // Quitar ceros a la izquierda solo si tiene al menos 4 dígitos restantes
    if (number.length < 3) return;

    const rawRoute = routeIdx !== -1 ? cleanCellText(row[routeIdx] ?? "") : "";
    const rawCustomer = custIdx !== -1 ? cleanCellText(row[custIdx] ?? "") : "";
    const rawDestination = destIdx !== -1 ? cleanCellText(row[destIdx] ?? "") : "";
    const rawPkgs = pkgIdx !== -1 ? Number.parseInt(cleanCellText(row[pkgIdx] ?? "1"), 10) : 1;
    const packages = Number.isFinite(rawPkgs) && rawPkgs > 0 ? rawPkgs : 1;

    // Regla de Negocio: Omitir ruta ARRETI
    const isArreti = /ARRETI/i.test(rawRoute);
    let isExcluded = false;
    let excludeReason: string | undefined;

    if (isArreti) {
      isExcluded = true;
      excludeReason = "Ruta ARRETI (Retira cliente omitido)";
    }

    // Comprobar duplicado en la base de datos
    const isDuplicate = existingDeliveryNumbers.has(number.toLowerCase()) || existingDeliveryNumbers.has(rawNum.toLowerCase());

    // Resolver cliente con reglas y equivalencias
    const match = rawCustomer ? resolveClientFromSap(rawCustomer, clients, aliases) : { client: null, matchType: "none" as const };

    if (isExcluded) {
      excludedCount++;
    } else if (isDuplicate) {
      duplicateCount++;
    } else {
      validCount++;
    }

    deliveries.push({
      id: `sap-row-${index}-${number}`,
      number,
      rawCustomer,
      rawRoute,
      rawDestination: rawDestination || rawCustomer,
      packages,
      isExcluded,
      excludeReason,
      isDuplicate,
      matchedClient: match.client,
      matchType: match.matchType,
      selectedClientId: match.client?.id ?? null,
      saveAliasOnImport: Boolean(rawCustomer && match.matchType !== "alias" && match.client),
    });
  });

  return {
    totalRows: deliveries.length,
    validCount,
    excludedCount,
    duplicateCount,
    deliveries,
  };
}

function parseHtmlTable(html: string): string[][] {
  const rows: string[][] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null = null;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const trContent = trMatch[1];
    const cells: string[] = [];
    const cellRegex = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
    let cellMatch: RegExpExecArray | null = null;

    while ((cellMatch = cellRegex.exec(trContent)) !== null) {
      cells.push(cleanCellText(cellMatch[1]));
    }

    if (cells.length > 0 && cells.some((c) => c.length > 0)) {
      rows.push(cells);
    }
  }

  return rows;
}

function parsePlainText(text: string): string[][] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.map((line) => {
    // Si contiene tabulaciones (copiado de Excel/SAP ALV Grid)
    if (line.includes("\t")) {
      return line.split("\t").map(cleanCellText);
    }
    // Si contiene punto y coma o comas
    if (line.includes(";")) {
      return line.split(";").map(cleanCellText);
    }
    // Si es solo una lista de números de remito, cada fila tiene 1 celda
    return [cleanCellText(line)];
  });
}
