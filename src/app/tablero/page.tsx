import { AppShell } from "@/components/shell";
import { TableroRefresh } from "@/components/tablero-refresh";
import { requireSession } from "@/lib/auth/session";
import { buildOperationalAlerts, getDashboardKpis, listDeliveries } from "@/lib/deliveries/queries";
import { cn } from "@/lib/utils";

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
        <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <Big number={kpis.picking} label="En Picking" />
          <Big number={urgent.length} label="Urgentes" warn={urgent.length > 0} />
          <Big number={kpis.observations} label="Observaciones" warn={kpis.observations > 0} />
          <Big number={ready.length} label="Para revisar" warn={ready.length > 0} />
        </section>

        {Object.keys(palletGroups).length > 0 ? (
          <section className="panel rounded-2xl border-line/80 shadow-sm overflow-hidden">
            <header className="panel-head px-5 py-4 border-b border-line/70">
              <h2 className="panel-title flex items-center gap-2">
                <span>📦</span>
                <span>Lotes y Pallets en preparación</span>
              </h2>
            </header>
            <div className="grid gap-3.5 p-4 sm:p-5 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(palletGroups).map(([pallet, items]) => {
                const readyCount = items.filter((d) => d.status === "READY" || d.status === "CLOSED").length;
                const isFullyReady = readyCount === items.length;
                return (
                  <div
                    key={pallet}
                    className={cn(
                      "rounded-xl border p-4 shadow-xs transition-all duration-140 hover:scale-[1.01]",
                      isFullyReady
                        ? "border-ok/50 bg-ok/10"
                        : "border-cat/40 bg-surface/90",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-base font-bold text-cat flex items-center gap-1.5">
                        <span>📦</span>
                        <span>{pallet}</span>
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-bold border",
                          isFullyReady
                            ? "bg-ok/20 text-ok border-ok/40"
                            : "bg-elevated text-muted border-line/60",
                        )}
                      >
                        {readyCount}/{items.length} listas
                      </span>
                    </div>
                    <ul className="mt-3 space-y-1.5 text-xs">
                      {items.map((it) => (
                        <li key={it.id} className="flex items-center justify-between text-muted border-t border-line/40 pt-1.5 first:border-0 first:pt-0">
                          <span className="font-mono font-semibold text-foreground">{it.number}</span>
                          <span className="truncate max-w-[140px] font-medium">{it.client_name || it.destination}</span>
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
          <section className="panel rounded-2xl border-line/80 shadow-sm overflow-hidden">
            <header className="panel-head px-5 py-4 border-b border-line/70">
              <h2 className="panel-title flex items-center gap-2">
                <span>⚠</span>
                <span>Atención</span>
              </h2>
            </header>
            <ul className="grid gap-2 p-4 sm:p-5 sm:grid-cols-2">
              {alerts.slice(0, 12).map((alert) => (
                <li
                  key={alert.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/80 p-3 text-sm shadow-xs transition-colors hover:border-cat/50"
                >
                  <span className="font-mono font-bold text-cat">{alert.number}</span>
                  <span className="text-right text-xs text-foreground/90 font-medium">{alert.label}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="panel empty rounded-2xl py-8">Nada urgente ahora.</p>
        )}
      </div>
    </AppShell>
  );
}

function Big({ number, label, warn }: { number: number; label: string; warn?: boolean }) {
  return (
    <div
      className={cn(
        "kpi p-5 sm:p-6 rounded-2xl border transition-all duration-150",
        warn
          ? "border-cat/50 bg-gradient-to-br from-cat/10 via-card to-card"
          : "border-line/80 bg-gradient-to-br from-elevated/70 via-card to-card",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-extrabold uppercase tracking-wider text-muted">{label}</p>
        {warn ? <span className="h-2 w-2 rounded-full bg-cat animate-pulse" /> : null}
      </div>
      <p className={cn("mt-2 font-mono text-4xl sm:text-5xl font-extrabold tracking-tight", warn ? "text-cat" : "text-foreground")}>
        {number}
      </p>
    </div>
  );
}
