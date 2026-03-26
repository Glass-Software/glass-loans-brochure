"use client";

import { UnderwritingProvider } from "@/context/UnderwritingContext";

export default function UnderwriteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <UnderwritingProvider>{children}</UnderwritingProvider>;
}
