import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Outfit } from "next/font/google";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const store = await getRepositoryRuntime().read();

  return {
    title: {
      default: `${store.brand.companyName} — Excursões`,
      template: `%s | ${store.brand.companyName}`,
    },
    description:
      "Reserve excursões com segurança: praias, parques, day use e viagens especiais.",
    icons: { icon: store.brand.faviconUrl },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const store = await getRepositoryRuntime().read();
  return {
    themeColor: store.brand.primary || "#E84C91",
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${outfit.variable} antialiased`}>
        {children}

        <Script
          src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
          strategy="afterInteractive"
        />

        <Script id="onesignal-init" strategy="afterInteractive">
          {`
            window.OneSignalDeferred = window.OneSignalDeferred || [];
            OneSignalDeferred.push(async function(OneSignal) {
              try {
                await OneSignal.init({
                  appId: "03bda2ea-ad11-4b11-884d-2cf4ddc9bcb7",
                });
              } catch (error) {
                console.warn("[OneSignal] init falhou (não-fatal):", error);
              }
            });
          `}
        </Script>
      </body>
    </html>
  );
}