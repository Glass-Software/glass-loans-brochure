import { Metadata } from "next";
import Underwriting from "@/components/Underwriting";

export const metadata: Metadata = {
  title: "AI Underwriting Tool | Glass Loans",
  description:
    "Get an instant AI-powered underwriting analysis for your real estate loan with Gary, Glass Loans' AI team member.",
  keywords: [
    "loan underwriting",
    "real estate financing",
    "AI underwriting",
    "property analysis",
    "Glass Loans",
  ],
};

export default function UnderwritePage() {
  return (
    <>
      <Underwriting />
    </>
  );
}
