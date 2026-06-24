import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthBootstrap } from "@/components/AuthBootstrap";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Ecommerce",
  description: "Web app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className="h-full antialiased"
      style={
        {
          "--font-geist-sans":
            '"Segoe UI", "Helvetica Neue", Arial, "Noto Sans", sans-serif',
          "--font-geist-mono":
            '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
        } as React.CSSProperties
      }
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-background">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthBootstrap />
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
