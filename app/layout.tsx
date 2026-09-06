import type { Metadata } from "next";
import "./globals.css";
import { Header } from "../components/Header";

export const metadata: Metadata = {
  title: "Forming Material",
  description: "A research atlas and experimental archive for multi-stage press forming with 3D-printed tooling.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main>{children}</main>
        <footer className="site-footer">
          <span>Forming Material</span>
          <span>Architectural Products Lab · Research Atlas</span>
        </footer>
      </body>
    </html>
  );
}
