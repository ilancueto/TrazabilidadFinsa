import type { Client, ClientAlias } from "@/lib/types";

/**
 * Normaliza un texto para comparaciones de razones sociales:
 * - Pasa a minúsculas
 * - Remueve tildes y diacríticos
 * - Quita signos de puntuación (. , - / \ ")
 * - Colapsa espacios múltiples
 */
export function normalizeCorporateName(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,\-_/\\"'`´;:()[\]{}*+?^$|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Limpia sufijos societarios comunes en Argentina para mejorar el matching:
 * S.A., S.R.L., S.A.U., S.A.C.I.F., SOCIEDAD ANONIMA, etc.
 */
export function stripCorporateSuffixes(normalizedText: string): string {
  return normalizedText
    .replace(/\b(sociedad anonima|sociedad de responsabilidad limitada|s a u|s a c i f|s a|s r l|sau|srl|sa)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type ClientMatchResult = {
  client: Client | null;
  matchType: "alias" | "exact" | "fuzzy" | "none";
  matchedPattern?: string;
};

/**
 * Resuelve qué cliente de CAT Trazabilidad corresponde a un nombre o razón social proveniente de SAP.
 *
 * Jerarquía de resolución:
 * 1. Alias explícito registrado en client_aliases (exacto o normalizado)
 * 2. Nombre exacto de cliente en tabla clients
 * 3. Coincidencia por inclusión (ej: "Roque Mocciola" está contenido en "Empresa de Construcción Roque Mocciola S.A.")
 */
export function resolveClientFromSap(
  sapText: string,
  clients: Client[],
  aliases: ClientAlias[],
): ClientMatchResult {
  const rawClean = sapText.trim();
  if (!rawClean) {
    return { client: null, matchType: "none" };
  }

  const normSap = normalizeCorporateName(rawClean);
  const strippedSap = stripCorporateSuffixes(normSap);

  // 1. Verificación en Alias explícitos (reglas "Si X = Y entonces Z")
  for (const item of aliases) {
    const normAlias = normalizeCorporateName(item.alias);
    if (normAlias === normSap || normAlias === strippedSap) {
      const foundClient = clients.find((c) => c.id === item.client_id && c.active);
      if (foundClient) {
        return { client: foundClient, matchType: "alias", matchedPattern: item.alias };
      }
    }
  }

  // 2. Verificación por Nombre Exacto en clients
  for (const client of clients) {
    if (!client.active) continue;
    const normClient = normalizeCorporateName(client.name);
    if (normClient === normSap || normClient === strippedSap) {
      return { client, matchType: "exact", matchedPattern: client.name };
    }
  }

  // 3. Verificación Fuzzy / Inclusión
  // Caso A: El nombre del cliente en CAT está incluido dentro de la razón social de SAP
  // Ejemplo: Client = "Roque Mocciola", SAP = "Empresa de Construccion Roque Mocciola SA"
  let bestFuzzyClient: Client | null = null;
  let bestMatchLen = 0;

  for (const client of clients) {
    if (!client.active) continue;
    const normClient = normalizeCorporateName(client.name);
    const strippedClient = stripCorporateSuffixes(normClient);

    // Evitar falsos positivos con nombres de 1 o 2 letras
    if (strippedClient.length < 3) continue;

    const regex = new RegExp(`\\b${escapeRegExp(strippedClient)}\\b`, "i");
    if (regex.test(strippedSap) || strippedSap.includes(strippedClient)) {
      if (strippedClient.length > bestMatchLen) {
        bestMatchLen = strippedClient.length;
        bestFuzzyClient = client;
      }
    }
  }

  if (bestFuzzyClient) {
    return { client: bestFuzzyClient, matchType: "fuzzy", matchedPattern: bestFuzzyClient.name };
  }

  // Caso B: Token subset (ej: "Elio Rodriguez" en "RODRIGUEZ ELIO MATIAS" o nombres con orden invertido)
  const sapTokens = new Set(strippedSap.split(" ").filter((w) => w.length >= 2));
  for (const client of clients) {
    if (!client.active) continue;
    const normClient = normalizeCorporateName(client.name);
    const strippedClient = stripCorporateSuffixes(normClient);
    const clientTokens = strippedClient.split(" ").filter((w) => w.length >= 3 && !["del", "los", "las", "por", "para", "con", "sur"].includes(w));
    if (clientTokens.length >= 1 && clientTokens.every((t) => sapTokens.has(t))) {
      return { client, matchType: "fuzzy", matchedPattern: client.name };
    }
  }

  // Caso C: Viceversa (si SAP vino abreviado y el cliente en CAT es más largo)
  if (strippedSap.length >= 4) {
    for (const client of clients) {
      if (!client.active) continue;
      const strippedClient = stripCorporateSuffixes(normalizeCorporateName(client.name));
      if (strippedClient.includes(strippedSap)) {
        return { client, matchType: "fuzzy", matchedPattern: client.name };
      }
    }
  }

  return { client: null, matchType: "none" };
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
