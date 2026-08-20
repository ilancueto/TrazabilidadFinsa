export default function Loading() {
  return (
    <div className="space-y-3 py-6">
      <div className="h-8 w-56 animate-pulse bg-line" />
      <div className="h-40 animate-pulse bg-card" />
      <p className="text-sm text-muted">Cargando…</p>
    </div>
  );
}
