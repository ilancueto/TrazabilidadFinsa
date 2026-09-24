import { describe, expect, it } from "vitest";
import { parseSapInput } from "./parser";
import type { Client, ClientAlias } from "@/lib/types";

describe("SAP HTML and text parser", () => {
  const clients: Client[] = [
    { id: "c1", name: "Roque Mocciola", active: true, created_at: "", updated_at: "" },
    { id: "c2", name: "YPF", active: true, created_at: "", updated_at: "" },
  ];

  const aliases: ClientAlias[] = [
    { id: "a1", client_id: "c2", alias: "YPF SOCIEDAD ANONIMA", created_at: "" },
  ];

  const existingNumbers = new Set(["8492000"]);

  it("filters out ARRETI route and maps Roque Mocciola in SAP HTML", () => {
    const sapHtml = `
      <html>
      <body>
        <table border="1">
          <tr>
            <th>Entrega</th>
            <th>Destinatario</th>
            <th>Ruta</th>
            <th>Población</th>
            <th>Bultos</th>
          </tr>
          <tr>
            <td>008492001</td>
            <td>Empresa de Construcción Roque Mocciola</td>
            <td>ARANDR</td>
            <td>Neuquén</td>
            <td>2</td>
          </tr>
          <tr>
            <td>008492002</td>
            <td>YPF SOCIEDAD ANONIMA</td>
            <td>ARRETI</td>
            <td>Añelo</td>
            <td>1</td>
          </tr>
          <tr>
            <td>008492000</td>
            <td>Cliente Demo</td>
            <td>ARNEUQ</td>
            <td>Centenario</td>
            <td>3</td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const res = parseSapInput(sapHtml, existingNumbers, clients, aliases);
    expect(res.totalRows).toBe(3);
    expect(res.validCount).toBe(1);
    expect(res.excludedCount).toBe(1);
    expect(res.duplicateCount).toBe(1);

    // Fila 1: Válida, normalizada sin ceros, con Roque Mocciola mapeado
    const row1 = res.deliveries[0];
    expect(row1.number).toBe("8492001");
    expect(row1.isExcluded).toBe(false);
    expect(row1.matchedClient?.id).toBe("c1");
    expect(row1.packages).toBe(2);

    // Fila 2: Excluida por ruta ARRETI
    const row2 = res.deliveries[1];
    expect(row2.number).toBe("8492002");
    expect(row2.isExcluded).toBe(true);
    expect(row2.excludeReason).toContain("ARRETI");

    // Fila 3: Duplicada porque ya existía 8492000
    const row3 = res.deliveries[2];
    expect(row3.number).toBe("8492000");
    expect(row3.isDuplicate).toBe(true);
  });

  it("supports plain text pasted delivery numbers", () => {
    const plainText = `
      8492101
      8492102
      8492103
    `;

    const res = parseSapInput(plainText, existingNumbers, clients, aliases);
    expect(res.totalRows).toBe(3);
    expect(res.validCount).toBe(3);
    expect(res.deliveries[0].number).toBe("8492101");
  });
});
