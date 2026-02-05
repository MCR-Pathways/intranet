import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MCR Pathways Intranet",
  description: "Internal platform for MCR Pathways staff and coordinators",
  icons: {
    icon: "/MCR_LOGO-1.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* TT Commons Pro font from Adobe Fonts */}
        <link
          rel="preload"
          href="https://use.typekit.net/xef5jam.css"
          as="style"
        />
        <link rel="stylesheet" href="https://use.typekit.net/xef5jam.css" />
      </head>
      <body className="min-h-screen bg-background antialiased">
        {children}
      </body>
    </html>
  );
}
