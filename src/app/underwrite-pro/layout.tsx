import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Underwrite Pro - 100 Monthly Reports | Glass Loans",
  description: "Upgrade to Underwrite Pro for 100 monthly AI-powered deal analysis reports, permanent report storage, PDF exports, and priority support. $129/month or $1199/year.",
  openGraph: {
    title: "Underwrite Pro - 100 Monthly Reports",
    description: "Get 100 monthly reports with Gary's AI-powered underwriting analysis with Pro.",
    url: "https://glassloans.io/underwrite-pro",
    siteName: "Glass Loans",
    type: "website",
    locale: "en_US",
  },
};

export default function UnderwriteProLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
