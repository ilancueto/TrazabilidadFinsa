import Link from "next/link";
import { pickingDeliveryPath } from "@/lib/deliveries/paths";
import type { BultoSibling } from "@/lib/deliveries/queries";
import { cn } from "@/lib/utils";

type BultoNavProps = {
  palletCode: string;
  currentDeliveryNumber: string;
  siblings: BultoSibling[];
};

export function BultoNav({
  palletCode,
  currentDeliveryNumber,
  siblings,
}: BultoNavProps) {
  if (!siblings || siblings.length === 0) return null;

  const currentIndex = siblings.findIndex((s) => s.number === currentDeliveryNumber);
  const nextSibling = siblings.find(
    (s, idx) => idx > currentIndex && (!s.isReady || s.pendingRequired > 0),
  ) || siblings.find(
    (s) => s.number !== currentDeliveryNumber && (!s.isReady || s.pendingRequired > 0),
  );

  const completedCount = siblings.filter((s) => s.isReady).length;

  return (
    <section className="panel p-4 sm:p-4.5 rounded-2xl border-cat/40 bg-gradient-to-br from-cat/10 via-surface to-surface shadow-sm space-y-3">
      {/* Header del bulto */}
      <div className="flex items-center justify-between gap-2 border-b border-cat/20 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xl">📦</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-black text-cat tracking-wide">
                {palletCode}
              </span>
              <span className="text-[11px] font-semibold text-muted bg-elevated px-2 py-0.5 rounded-md border border-line/60">
                {siblings.length} entregas consolidadas
              </span>
            </div>
            <p className="text-[11px] text-muted mt-0.5">
              Las fotos de Remito Andreani y Etiquetas se replican automáticamente a todo este bulto.
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs font-bold font-mono text-foreground">
            {completedCount}/{siblings.length}
          </span>
          <p className="text-[10px] text-muted">listas</p>
        </div>
      </div>

      {/* Lista horizontal de entregas en este bulto */}
      <div>
        <p className="text-[11px] font-bold text-muted mb-2 uppercase tracking-wider">
          Entregas en este bulto:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {siblings.map((sib) => {
            const isCurrent = sib.number === currentDeliveryNumber;
            const statusDot = sib.isReady ? (
              <span className="h-2 w-2 rounded-full bg-ok" title="Lista" />
            ) : sib.pendingRequired < sib.totalRequired ? (
              <span className="h-2 w-2 rounded-full bg-cat animate-pulse" title="En progreso" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-muted/60" title="Pendiente" />
            );

            return (
              <Link
                key={sib.id}
                href={pickingDeliveryPath(sib.number)}
                prefetch={false}
                className={cn(
                  "p-2.5 rounded-xl border transition-all duration-120 flex flex-col justify-between text-left",
                  isCurrent
                    ? "border-cat bg-cat/15 shadow-xs ring-1 ring-cat/50"
                    : "border-line bg-surface hover:border-cat/40 hover:bg-elevated/70",
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-xs font-black text-foreground">
                    {sib.number}
                  </span>
                  {statusDot}
                </div>
                <p className="text-[11px] truncate text-muted mt-1 font-medium">
                  {sib.client_name || sib.destination}
                </p>
                <div className="mt-1.5 flex items-center justify-between text-[10px]">
                  {isCurrent ? (
                    <span className="text-cat font-bold uppercase tracking-wider">
                      ● Viendo ahora
                    </span>
                  ) : (
                    <span className="text-muted">
                      {sib.isReady
                        ? "Lista ✓"
                        : `${sib.pendingRequired} pendiente${sib.pendingRequired === 1 ? "" : "s"}`}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Acceso directo a la siguiente entrega pendiente */}
      {nextSibling ? (
        <div className="pt-1">
          <Link
            href={pickingDeliveryPath(nextSibling.number)}
            prefetch={false}
            className="btn btn-ghost btn-sm w-full rounded-xl border border-cat/30 bg-cat/5 hover:bg-cat/15 text-cat font-bold text-xs flex items-center justify-center gap-2 py-2"
          >
            <span>👉 Siguiente entrega del bulto:</span>
            <strong className="font-mono">{nextSibling.number}</strong>
            <span className="font-normal text-muted truncate max-w-[120px]">
              ({nextSibling.client_name || nextSibling.destination})
            </span>
            <span>→</span>
          </Link>
        </div>
      ) : null}
    </section>
  );
}
