import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">404</p>
      <h1 className="text-2xl font-semibold">No encontramos esa pantalla</h1>
      <Link href="/" className="w-fit rounded-md bg-anthracite px-4 py-2 text-sm font-medium text-white">
        Volver al inicio
      </Link>
    </main>
  );
}
