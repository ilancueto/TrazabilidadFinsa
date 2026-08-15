import Link from "next/link";
import { ForcedDateInput } from "@/components/forced-date-input";
import { PriorityBadge } from "@/components/priority-badge";
import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/lib/auth/session";
import { MODALITY_LABEL } from "@/lib/constants";
import { getDayReport } from "@/lib/deliveries/queries";
import { adminDeliveryPath } from "@/lib/deliveries/paths";
import { formatMinutes, parseDateInput, todayYmdAR } from "@/lib/time";

export const metadata = { title: "Cierre de día" };

export default async function DayClosePage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  await requireRole(["ADMIN", "SUPERVISOR"]);
  const { fecha } = await searchParams;
  const date = (fecha ? parseDateInput(fecha) : null) ?? todayYmdAR();
  const report = await getDayReport(date);

  return (
    <div className="space-y-5">
      <div className="page-head">
        <div>
          <p className="page-kicker">Operación</p>
          <h1 className="page-title">Cierre de día</h1>
          <p className="page-sub">Qué se publicó, qué salió y qué quedó.</p>
        </div>
        <form className="flex flex-wrap items-end gap-2">
          <label>
            <span className="label">Fecha</span>
            <ForcedDateInput defaultDate={date} />
            <span id="date-format-help" className="mt-1 block text-[10px] font-semibold text-muted">
              DD/MM/AAAA
            </span>
          </label>
          <button className="btn btn-ghost">Ver</button>
          <a href={`/admin/dia/export?desde=${date}&hasta=${date}`} className="btn btn-primary">
            Bajar Excel
          </a>
        </form>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Publicadas" value={report.published} />
        <Stat label="Listas" value={report.ready} />
        <Stat label="Cerradas" value={report.closed} />
        <Stat label="Urgentes abiertas" value={report.urgentOpen} warn={report.urgentOpen > 0} />
        <Stat label="Observaciones" value={report.observations} warn={report.observations > 0} />
        <Stat label="A la primera foto" value={formatMinutes(report.avgFirstPhotoMinutes)} />
        <Stat label="Lista a cierre" value={formatMinutes(report.avgReadyToCloseMinutes)} />
        <Stat label="Siguen abiertas" value={report.open.length} warn={report.open.length > 0} />
      </section>

      <section className="panel overflow-hidden">
        <header className="panel-head">
          <h2 className="panel-title">No salieron</h2>
        </header>
        {report.open.length === 0 ? (
          <p className="empty">Ese día no quedó nada abierto.</p>
        ) : (
          <ul className="divide-y divide-line">
            {report.open.map((row) => (
              <li key={row.id}>
                <Link href={adminDeliveryPath(row.number)} className="block px-4 py-3 hover:bg-[#242018]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono font-semibold text-cat">{row.number}</span>
                    <StatusBadge status={row.status} />
                  </div>
                  <p className="text-sm text-muted">
                    {row.destination} · {MODALITY_LABEL[row.modality]}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <PriorityBadge priority={row.priority} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string | number;
  warn?: boolean;
}) {
  return (
    <div className={warn ? "kpi kpi-warn" : "kpi"}>
      <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${warn ? "text-cat" : ""}`}>{value}</p>
    </div>
  );
}
