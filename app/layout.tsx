import type { Metadata, Viewport } from "next";
import "@fontsource-variable/figtree/wght.css";
import "@fontsource-variable/bricolage-grotesque/standard.css";
import "./globals.css";
import { SplashScreen } from "@/components/SplashScreen";

export const metadata: Metadata = {
  title: "AtlasFinanceiro",
  description: "Organização financeira: gastos do mês, fixos, cartão e estatísticas",
  appleWebApp: { capable: true, title: "AtlasFinanceiro", statusBarStyle: "default" },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/apple-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#eef1f5",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full">
        <SplashScreen />
        {children}
      </body>
    </html>
  );
}
