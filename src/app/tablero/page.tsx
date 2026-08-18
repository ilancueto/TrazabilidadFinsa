import { AppShell } from "@/components/shell";
import { TableroRefresh } from "@/components/tablero-refresh";
import { requireSession } from "@/lib/auth/session";
import { buildOperationalAlerts, getDashboardKpis, listDeliveries } from "@/lib/deliveries/queries";

export const metadata = { title: "Tablero de bodega" };

export default async function TableroPage() {
  const user = await requireSession();
  const [kpis, deliveries] = await Promise.all([
    getDashboardKpis(),
    listDeliveries({ hideClosed: true, limit: 80 }),
  ]);
  const actionable = deliveries.filter(
    (row) => row.status === "PUBLISHED" || row.status === "IN_PICKING",
  );
  const urgent = actionable.filter((row) => row.priority === "URGENT");
  const ready = deliveries.filter((row) => row.status === "READY");
  const alerts = buildOperationalAlerts(deliveries);

  // Agrupar entregas activas por Lote / Pallet
  const palletGroups = deliveries.reduce<Record<string, typeof deliveries>>((acc, row) => {
    if (row.pallet_code) {
      if (!acc[row.pallet_code]) acc[row.pallet_code] = [];
      acc[row.pallet_code].push(row);
    }
    return acc;
  }, {});

  return (
    <AppShell user={user} variant={user.role === "PICKING" ? "picking" : "admin"}>
      <TableroRefresh />
      <div className="space-y-6">
        <div>
          <p className="page-kicker">Turno</p>
          <h1 className="page-title">Turno en curso</h1>
          <p className="page-sub">Se actualiza solo. Sin fotos.</p>
        </div>
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Big number={kpis.picking} label="En Picking" />
          <Big number={urgent.length} label="Urgentes" warn={urgent.length > 0} />
          <Big number={kpis.observations} label="Observaciones" warn={kpis.observations > 0} />
          <Big number={ready.length} label="Para revisar" warn={ready.length > 0} />
        </section>

        {Object.keys(palletGroups).length > 0 ? (
          <section className="panel">
            <header className="panel-head">
              <h2 className="panel-title">📦 Lotes y Pallets en preparación</h2>
            </header>
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(palletGroups).map(([pallet, items]) => {
                const readyCount = items.filter((d) => d.status === "READY" || d.status === "CLOSED").length;
                const isFullyReady = readyCount === items.length;
                return (
                  <div
                    key={pallet}
                    className={`rounded border p-3 ${
                      isFullyReady
                        ? "border-ok/60 bg-ok/10"
                        : "border-cat/40 bg-surface"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-base font-bold text-cat">📦 {pallet}</span>
                      <span className={`text-xs font-bold ${isFullyReady ? "text-ok" : "text-muted"}`}>
                        {readyCount}/{items.length} listas
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs">
                      {items.map((it) => (
                        <li key={it.id} className="flex items-center justify-between text-muted">
                          <span className="font-mono text-foreground">{it.number}</span>
                          <span className="truncate max-w-[140px]">{it.client_name || it.destination}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {alerts.length > 0 ? (
          <section className="panel">
            <header className="panel-head">
              <h2 className="panel-title">Atención</h2>
            </header>
            <ul className="space-y-2 p-4 text-lg">
              {alerts.slice(0, 12).map((alert) => (
                <li key={alert.id}>
                  <span className="font-mono font-bold text-cat">{alert.number}</span>{" "}
                  <span>{alert.label}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="panel empty">Nada urgente ahora.</p>
        )}
      </div>
    </AppShell>
  );
}

function Big({ number, label, warn }: { number: number; label: string; warn?: boolean }) {
  return (
    <div className={warn ? "kpi kpi-warn p-5" : "kpi p-5"}>
      <p className={`font-mono text-5xl font-bold ${warn ? "text-cat" : ""}`}>{number}</p>
      <p className="mt-2 text-sm uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}
