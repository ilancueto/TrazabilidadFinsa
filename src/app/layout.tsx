import type { Metadata, Viewport } from "next";
import "./globals.css";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "Trazabilidad de entregas para Bodega Neuquén. Finning CAT.",
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    title: "Entregas",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/brand/finning-cat-logo.png",
    apple: "/brand/finning-cat-logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full bg-black">{children}</body>
    </html>
  );
}
