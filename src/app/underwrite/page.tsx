import { Metadata } from "next";
import Underwriting from "@/components/Underwriting";
import { getCurrentUser } from "@/lib/auth/session";

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

export default async function UnderwritePage() {
  // Check for authenticated user session
  const user = await getCurrentUser();

  return (
    <>
      <Underwriting authenticatedUser={user} />
    </>
  );
}
