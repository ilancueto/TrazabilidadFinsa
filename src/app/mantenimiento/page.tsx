import type { Metadata, Viewport } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fuera de Servicio · Finning CAT",
  description: "Fuera de servicio hasta nuevo aviso.",
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function MantenimientoPage() {
  return (
    <main className="fixed inset-0 z-50 flex items-center justify-center bg-black overflow-hidden select-none p-0 m-0">
      <picture className="w-full h-full flex items-center justify-center">
        {/* Mobile / Vertical (9:16) */}
        <source
          media="(orientation: portrait), (max-aspect-ratio: 1/1), (max-width: 768px)"
          srcSet="/maintenance-mobile.jpg"
        />
        {/* Desktop / Horizontal (16:9) */}
        <img
          src="/maintenance-desktop.jpg"
          alt="Fuera de servicio hasta nuevo aviso"
          className="w-full h-full object-contain pointer-events-none"
        />
      </picture>
    </main>
  );
}
