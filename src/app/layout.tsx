import type { Metadata } from "next";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
