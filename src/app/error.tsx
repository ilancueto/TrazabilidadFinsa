"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen">
      <div className="h-2 bg-cat" />
      <div className="mx-auto flex min-h-[calc(100vh-8px)] max-w-lg flex-col justify-center gap-4 px-6">
        <p className="page-kicker">Error</p>
        <h1 className="page-title">No se pudo completar</h1>
        <p className="page-sub">Intentá de nuevo. Si vuelve a pasar, informá la referencia al responsable de la aplicación.</p>
        {error.digest ? <p className="font-mono text-xs text-muted">Referencia: {error.digest}</p> : null}
        <button type="button" onClick={reset} className="btn btn-primary self-start">
          Reintentar
        </button>
      </div>
    </main>
  );
}
