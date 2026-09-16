import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Enterprise Dynamic Pricing System",
  description: "Autonomous pricing optimization engine powered by Gemini 3.7 Flash and Markov Decision Processes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
