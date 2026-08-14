import { LoginForm } from "@/components/login-form";
import { LOCAL_DEMO_USERS } from "@/lib/constants";

export const metadata = { title: "Ingresar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8">
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-sm bg-cat text-sm font-black text-ink">
          CAT
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Finning · Bodega y Despacho
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Trazabilidad de entregas</h1>
        <p className="mt-2 text-sm text-muted">
          Uso interno. Admin desde PC, Picking desde el celular.
        </p>
      </div>
      <LoginForm nextPath={next ?? ""} />
      <aside className="mt-6 rounded-md border border-line bg-white p-4 text-sm">
        <p className="font-semibold">Usuarios locales de desarrollo</p>
        <ul className="mt-2 space-y-1 text-muted">
          {LOCAL_DEMO_USERS.map((user) => (
            <li key={user.email}>
              {user.name} · {user.role} · {user.email} / {user.password}
            </li>
          ))}
        </ul>
      </aside>
    </main>
  );
}
