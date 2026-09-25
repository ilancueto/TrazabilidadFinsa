import Link from "next/link";
import { BatchGrouper } from "@/components/admin/batch-grouper";
import { requireRole } from "@/lib/auth/session";
import { listDeliveries, listPickingProfiles } from "@/lib/deliveries/queries";

export const metadata = { title: "Armar Bultos — CAT" };

export default async function BatchGroupingPage() {
  const user = await requireRole(["ADMIN", "SUPERVISOR"]);
  const [deliveries, pickers] = await Promise.all([
    listDeliveries({ hideClosed: true, limit: 300 }),
    listPickingProfiles(),
  ]);

  return (
    <div className="space-y-5">
      <div className="page-head">
        <div>
          <p className="page-kicker">Despachos y Picking</p>
          <h1 className="page-title">Armar Bultos (Consolidar Entregas)</h1>
          <p className="page-sub">
            Uní múltiples entregas en el mismo bulto o caja. Cada entrega conserva sus fotos de materiales individuales, pero comparten automáticamente el Remito de Andreani y las etiquetas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin" className="btn btn-ghost">
            ← Volver a Entregas
          </Link>
        </div>
      </div>

      <BatchGrouper deliveries={deliveries} pickers={pickers} role={user.role} />
    </div>
  );
}
