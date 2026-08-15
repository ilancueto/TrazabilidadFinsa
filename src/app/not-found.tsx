import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen">
      <div className="h-2 bg-cat" />
      <div className="mx-auto flex min-h-[calc(100vh-8px)] max-w-lg flex-col justify-center gap-4 px-6">
        <p className="page-kicker">404</p>
        <h1 className="page-title">No encontramos esa página</h1>
        <p className="page-sub">Revisá el enlace o volvé al inicio.</p>
        <Link href="/" className="btn btn-primary self-start">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
