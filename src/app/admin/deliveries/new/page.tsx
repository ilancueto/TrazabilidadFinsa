import { DeliveryForm } from "@/components/admin/delivery-form";
import { listPickingProfiles, listRequirementTypes } from "@/lib/deliveries/queries";

export const metadata = { title: "Nueva entrega" };

export default async function NewDeliveryPage() {
  const [types, pickers] = await Promise.all([listRequirementTypes(), listPickingProfiles()]);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Nueva entrega</h1>
        <p className="text-sm text-muted">
          La plantilla se completa según la modalidad. Publicar la hace visible a Picking.
        </p>
      </div>
      <DeliveryForm types={types} pickers={pickers} />
    </div>
  );
}
