import { DeliveryForm } from "@/components/admin/delivery-form";
import { requireRole } from "@/lib/auth/session";
import {
  listCatalogTemplates,
  listPickingProfiles,
  listRequirementTypes,
  templatesToDrafts,
} from "@/lib/deliveries/queries";

export const metadata = { title: "Nueva entrega" };

export default async function NewDeliveryPage() {
  await requireRole(["ADMIN"]);
  const [types, pickers, templates] = await Promise.all([
    listRequirementTypes(),
    listPickingProfiles(),
    listCatalogTemplates(),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="page-kicker">Alta</p>
        <h1 className="page-title">Nueva entrega</h1>
        <p className="page-sub">Completá los datos. Cuando la publiques, Picking la va a ver en el celular.</p>
      </div>
      <DeliveryForm pickers={pickers} templates={templatesToDrafts(templates, types)} />
    </div>
  );
}
