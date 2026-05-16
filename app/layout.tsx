import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VJMRTIM Asset Drive",
  description: "Private local asset drive for VJMRTIM.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
