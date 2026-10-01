import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "App en Pausa · Finning CAT" },
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <main className="min-h-screen w-full bg-black flex items-center justify-center overflow-hidden">
      <picture className="flex h-screen h-[100dvh] w-full items-center justify-center">
        <source
          media="(orientation: portrait), (max-width: 768px), (max-aspect-ratio: 1/1)"
          srcSet="/maintenance-mobile.jpg"
        />
        {/* Native picture selects the supplied artwork by orientation and aspect ratio. */}
        <img
          src="/maintenance-desktop.jpg"
          alt="App en Pausa"
          className="w-full h-full object-contain pointer-events-none"
        />
      </picture>
    </main>
  );
}
