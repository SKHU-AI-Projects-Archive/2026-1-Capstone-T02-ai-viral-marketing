import type { Metadata } from "next";

import "../src/client/styles.css";

export const metadata: Metadata = {
  title: "AI Viral Marketing Workspace",
  description: "AI-powered viral marketing content workspace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
