import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nuvasite Portal",
  description: "Workspace for managing Nuvasite product functionality.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
