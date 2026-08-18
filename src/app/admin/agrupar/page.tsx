import Link from "next/link";
import { BatchGrouper } from "@/components/admin/batch-grouper";
import { requireRole } from "@/lib/auth/session";
import { listDeliveries, listPickingProfiles } from "@/lib/deliveries/queries";

export const metadata = { title: "Agrupar entregas" };

export default async function BatchGroupingPage() {
  await requireRole(["ADMIN", "SUPERVISOR"]);
  const [deliveries, pickers] = await Promise.all([
    listDeliveries({ hideClosed: true, limit: 300 }),
    listPickingProfiles(),
  ]);

  return (
    <div className="space-y-5">
      <div className="page-head">
        <div>
          <p className="page-kicker">Operaciones</p>
          <h1 className="page-title">Agrupar en Lotes / Pallets</h1>
          <p className="page-sub">
            Seleccioná entregas para asignarlas a un lote/pallet o asignarles responsable de Picking en lote.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin" className="btn btn-ghost">
            ← Volver a Entregas
          </Link>
        </div>
      </div>

      <BatchGrouper deliveries={deliveries} pickers={pickers} />
    </div>
  );
}
