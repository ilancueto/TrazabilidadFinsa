import AdminDashboardPage from "../page";

export const metadata = { title: "Retira cliente" };

export default async function CustomerPickupAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return AdminDashboardPage({
    searchParams: Promise.resolve({ ...params, section: "CUSTOMER_PICKUP" }),
  });
}
