import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import DashboardHeader from "@/components/Dashboard/DashboardHeader";
import SubscriptionCard from "@/components/Dashboard/SubscriptionCard";
import ReportsList from "@/components/Dashboard/ReportsList";

export const metadata = {
  title: "Dashboard | Glass Loans Pro",
  description: "Manage your underwriting reports and subscription",
};

// Force dynamic rendering (uses cookies for authentication)
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // Require authentication
  const user = await getCurrentUser();

  if (!user) {
    redirect("/signin");
  }

  // Dashboard is Pro-only - redirect free users to upgrade page
  if (user.tier !== "pro") {
    redirect("/underwrite");
  }

  // Fetch user's reports
  const reports = await prisma.underwritingSubmission.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      reportId: true,
      propertyAddress: true,
      propertyCity: true,
      propertyState: true,
      finalScore: true,
      estimatedArv: true,
      purchasePrice: true,
      createdAt: true,
      expiresAt: true,
    },
  });

  // Calculate usage for current period
  let usageCount = user.usageCount;
  let usageLimit = user.usageLimit;
  let periodStart = user.usagePeriodStart;
  let periodEnd = null;

  if (user.tier === "pro" && user.subscription) {
    periodEnd = user.subscription.currentPeriodEnd;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-white dark:bg-black">
      {/* Decorative Background SVG */}
      <div className="absolute left-0 top-0 z-0 h-full w-full">
        <svg
          className="absolute left-0 top-0 h-full w-full"
          viewBox="0 0 1440 969"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid slice"
        >
          <mask
            id="mask0_dashboard"
            style={{ maskType: "alpha" }}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="1440"
            height="969"
          >
            <rect width="1440" height="969" fill="#090E34" />
          </mask>
          <g mask="url(#mask0_dashboard)">
            <path
              opacity="0.05"
              d="M1086.96 297.978L632.959 554.978L935.625 535.926L1086.96 297.978Z"
              fill="url(#paint0_linear_dashboard)"
            />
            <path
              opacity="0.05"
              d="M1324.5 755.5L1450 687V886.5L1324.5 967.5L-10 288L1324.5 755.5Z"
              fill="url(#paint1_linear_dashboard)"
            />
          </g>
          <defs>
            <linearGradient
              id="paint0_linear_dashboard"
              x1="1178.4"
              y1="151.853"
              x2="780.959"
              y2="453.581"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#4A6CF7" />
              <stop offset="1" stopColor="#4A6CF7" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="paint1_linear_dashboard"
              x1="160.5"
              y1="220"
              x2="1099.45"
              y2="1192.04"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#4A6CF7" />
              <stop offset="1" stopColor="#4A6CF7" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10">
        <DashboardHeader user={user} />

        <main className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-black dark:text-white">
              Welcome back, {user.email.split("@")[0]}!
            </h1>
            <p className="mt-2 text-body-color dark:text-body-color-dark">
              Manage your underwriting reports and subscription
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Subscription Card - 1/3 width on desktop */}
            <div className="lg:col-span-1">
              <SubscriptionCard
                user={user}
                subscription={user.subscription}
                usageCount={usageCount}
                usageLimit={usageLimit}
                periodEnd={periodEnd}
              />
            </div>

            {/* Reports List - 2/3 width on desktop */}
            <div className="lg:col-span-2">
              <ReportsList reports={reports} userTier={user.tier} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
