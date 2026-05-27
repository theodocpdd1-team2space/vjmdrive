import type { Metadata } from "next";
import { readSettings } from "@/lib/settings";
import "./globals.css";

export const metadata: Metadata = {
  title: "driveOne",
  description: "Cloud storage and file sharing for driveOne.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await readSettings().catch(() => null);
  const theme = settings?.appearance.theme || "dark";
  const lang = settings?.language.locale || "en";

  return (
    <html lang={lang} className="h-full" data-theme={theme} suppressHydrationWarning>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
