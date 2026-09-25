import * as fs from "node:fs";
import * as path from "node:path";
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

  it("parses SAP ALV Grid HTML export with fixed-width nobr coordinates", () => {
    const sapAlvHtml = `
      <table class="list" border=1 cellspacing=0 cellpadding=1 rules=groups borderColor=black>
        <tr>
          <td style="background:#5dcbfd">
            <nobr id="l0003008">Entrega    </nobr>
            <nobr id="l0003020">Ruta   </nobr>
            <nobr id="l0003028">Ctd</nobr>
            <nobr id="l0003032">Nombre destinatario de mercanc&#xed;as  </nobr>
            <nobr id="l0003068">         Peso total</nobr>
            <nobr id="l0003088">            Volumen</nobr>
            <nobr id="l0003108">Lugar-destinatario                 </nobr>
          </td>
        </tr>
        <tr>
          <td style="background:#E8EAD8">
            <nobr id="l0005008">            31,334        1                                                                                                   </nobr>
          </td>
        </tr>
        <tr>
          <td>
            <input name="l0006003" type="checkbox">
            <nobr id="l0006008">806195646&nbsp;&nbsp;&nbsp;</nobr>
            <nobr id="l0006020">ARDESP&nbsp;&nbsp;&nbsp;1&nbsp;&nbsp;Roque&nbsp;Mocciola&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;31,334&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;60.860,904&nbsp;&nbsp;A&#xd1;ELO&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</nobr>
          </td>
        </tr>
        <tr>
          <td>
            <input name="l0007003" type="checkbox">
            <nobr id="l0007008">806195647&nbsp;&nbsp;&nbsp;</nobr>
            <nobr id="l0007020">ARRETI&nbsp;&nbsp;&nbsp;2&nbsp;&nbsp;YPF&nbsp;SOCIEDAD&nbsp;ANONIMA&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;21,916&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;703.005,044&nbsp;&nbsp;Neuqu&#xe9;n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</nobr>
          </td>
        </tr>
      </table>
    `;

    const res = parseSapInput(sapAlvHtml, existingNumbers, clients, aliases);
    expect(res.totalRows).toBe(2);
    expect(res.validCount).toBe(1);
    expect(res.excludedCount).toBe(1);

    // Row 1: ARDESP with Roque Mocciola matched
    const row1 = res.deliveries[0];
    expect(row1.number).toBe("806195646");
    expect(row1.rawRoute).toBe("ARDESP");
    expect(row1.packages).toBe(1);
    expect(row1.matchedClient?.name).toBe("Roque Mocciola");
    expect(row1.rawDestination).toBe("AÑELO");
    expect(row1.isExcluded).toBe(false);

    // Row 2: ARRETI with YPF matched via alias, but excluded
    const row2 = res.deliveries[1];
    expect(row2.number).toBe("806195647");
    expect(row2.rawRoute).toBe("ARRETI");
    expect(row2.packages).toBe(2);
    expect(row2.matchedClient?.name).toBe("YPF");
    expect(row2.rawDestination).toBe("Neuquén");
    expect(row2.isExcluded).toBe(true);
    expect(row2.excludeReason).toContain("ARRETI");
  });

  it("parses the complete real-world SAP ALV report fixture accurately", () => {
    const fixturePath = path.join(process.cwd(), "tests/fixtures/sap-sample.html");
    const rawFixture = fs.readFileSync(fixturePath, "utf8");

    const sapClients: Client[] = [
      { id: "c1", name: "Pluspetrol", active: true, created_at: "", updated_at: "" },
      { id: "c2", name: "Pampa Energía", active: true, created_at: "", updated_at: "" },
      { id: "c3", name: "Halliburton", active: true, created_at: "", updated_at: "" },
      { id: "c4", name: "Essesa", active: true, created_at: "", updated_at: "" },
      { id: "c5", name: "Oilfield Services", active: true, created_at: "", updated_at: "" },
    ];

    const sapAliases: ClientAlias[] = [
      { id: "a1", client_id: "c1", alias: "PLUSPETROL YSUR ENERGIA ARG SRL-ARE", created_at: "" },
    ];

    const res = parseSapInput(rawFixture, new Set(["806195646"]), sapClients, sapAliases);

    expect(res.totalRows).toBe(37);
    expect(res.excludedCount).toBe(10); // Exactly 10 ARRETI rows excluded
    expect(res.duplicateCount).toBe(1);  // 806195646 is duplicate
    expect(res.validCount).toBe(26);     // 26 valid dispatches

    // Check first delivery
    const d0 = res.deliveries[0];
    expect(d0.number).toBe("806195646");
    expect(d0.rawRoute).toBe("ARDESP");
    expect(d0.packages).toBe(1);
    expect(d0.matchedClient?.name).toBe("Pluspetrol");
    expect(d0.rawDestination).toBe("AÑELO");
    expect(d0.isDuplicate).toBe(true);
  });
});
