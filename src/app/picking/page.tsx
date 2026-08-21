import { PickingInbox } from "@/components/picking-inbox";
import { requireRole } from "@/lib/auth/session";
import { buildPickingAlerts } from "@/lib/deliveries/alerts";
import { countDeliveries, listDeliveries } from "@/lib/deliveries/queries";

export const metadata = { title: "Picking · Despachos" };

export default async function PickingHomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cola?: string; page?: string }>;
}) {
  const user = await requireRole(["PICKING", "ADMIN"]);
  const { q, cola = "todas", page: rawPage } = await searchParams;
  const parsedPage = Number(rawPage ?? 1);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const pageSize = 50;
  const deliveryFilters = { q, hideClosed: true, excludeDraft: true, modality: "DESPACHO" as const };
  const [deliveries, total] = await Promise.all([
    listDeliveries({ ...deliveryFilters, page, limit: pageSize }),
    countDeliveries(deliveryFilters),
  ]);
  const actionable = deliveries.filter((row) => row.status === "PUBLISHED" || row.status === "IN_PICKING");
  const urgent = actionable.filter((row) => row.priority === "URGENT").length;
  const ready = deliveries.filter((row) => row.status === "READY").length;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <p className="page-kicker">Picking · Despachos</p>
        <h1 className="page-title">Despachos pendientes</h1>
        <p className="page-sub">
          {actionable.length} para completar
          {urgent > 0 ? ` · ${urgent} urgente${urgent === 1 ? "" : "s"}` : ""}
          {ready > 0 ? ` · ${ready} lista${ready === 1 ? "" : "s"}` : ""}.
        </p>
      </div>
      <PickingInbox
        deliveries={deliveries}
        total={total}
        userId={user.id}
        cola={cola}
        page={page}
        pageSize={pageSize}
        basePath="/picking"
        emptyLabel="despachos"
        alerts={buildPickingAlerts(deliveries, user.id)}
      />
    </div>
  );
}
