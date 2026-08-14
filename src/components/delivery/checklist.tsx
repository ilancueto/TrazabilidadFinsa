import Link from "next/link";
import { formatDateTime } from "@/lib/utils";
import type { DeliveryDetail, UserRole } from "@/lib/types";

export function Checklist({
  detail,
  role,
}: {
  detail: DeliveryDetail;
  role: UserRole;
}) {
  const captureBase = role === "PICKING" ? `/picking/${detail.id}` : null;

  return (
    <section className="rounded-md border border-line bg-white">
      <header className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">Checklist</h2>
        <p className="text-xs text-muted">
          {detail.progress.complete}/{detail.progress.total} aplicables ·{" "}
          {detail.progress.pendingRequired} obligatorios pendientes
        </p>
      </header>
      <ul className="divide-y divide-line">
        {detail.requirements.map((req) => {
          const active = req.evidences.filter((ev) => !ev.voided_at);
          return (
            <li key={req.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {req.label}
                    {req.required && req.applicable ? (
                      <span className="ml-2 text-[10px] font-semibold uppercase text-danger">
                        obligatorio
                      </span>
                    ) : null}
                    {!req.applicable ? (
                      <span className="ml-2 text-[10px] font-semibold uppercase text-muted">
                        no aplica
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted">
                    {req.applicable
                      ? active.length > 0
                        ? `${active.length} foto${active.length === 1 ? "" : "s"}`
                        : "Sin evidencias"
                      : "No requerido para esta modalidad"}
                  </p>
                </div>
                {req.applicable && captureBase && detail.status !== "CLOSED" ? (
                  <Link
                    href={`${captureBase}/${req.id}`}
                    className="rounded-md bg-cat px-3 py-2 text-sm font-semibold text-ink"
                  >
                    Cargar foto
                  </Link>
                ) : null}
              </div>
              {active.length > 0 ? (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {active.map((ev) => (
                    <figure key={ev.id} className="overflow-hidden rounded-sm border border-line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/evidence/${ev.id}/file`}
                        alt={ev.comment || ev.filename}
                        className="h-24 w-full object-cover"
                      />
                      <figcaption className="px-1.5 py-1 text-[10px] text-muted">
                        {ev.uploader_name} · {formatDateTime(ev.created_at)}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
