import { Metadata } from "next";
import Underwriting from "@/components/Underwriting";

export const metadata: Metadata = {
  title: "AI Underwriting Tool | Glass Loans",
  description:
    "Get an instant AI-powered underwriting analysis for your fix-and-flip loan with Gary, Glass Loans' AI team member.",
  keywords: [
    "loan underwriting",
    "fix and flip financing",
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
