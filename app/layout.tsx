import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DemoProvider } from "../lib/store";
import "./globals.css";

export const metadata: Metadata = {
  title: "VED-SCOUT · Interactive demo",
  description: "Try voice-enabled agricultural drone mission configuration with your own browser-local plots, missions, camera sensors, and sample flight history. A project by Varun Aggarwal at Purdue University.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><DemoProvider>{children}</DemoProvider></body></html>;
}
