import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Ingresar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="login-shell">
      <div className="login-backdrop" aria-hidden="true" />
      <div className="login-shade" aria-hidden="true" />
      <section className="login-main">
        <div className="login-panel">
          <div className="mb-8">
            <p className="page-kicker">Finning CAT · Operaciones</p>
            <h2 className="page-title">Ingresar</h2>
            <p className="page-sub">Bodega Neuquén</p>
          </div>
          <LoginForm nextPath={next ?? ""} />
          <p className="mt-6 text-center text-xs text-muted">Acceso interno · Centro de operaciones</p>
        </div>
      </section>
    </main>
  );
}
