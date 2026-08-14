"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Error</p>
      <h1 className="text-2xl font-semibold">No se pudo completar la operación</h1>
      <p className="text-sm text-muted">{error.message || "Error inesperado."}</p>
      <button
        type="button"
        onClick={reset}
        className="w-fit rounded-md bg-anthracite px-4 py-2 text-sm font-medium text-white"
      >
        Reintentar
      </button>
    </main>
  );
}
