"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface User {
  id: number;
  email: string;
  tier: string;
}

interface DashboardHeaderProps {
  user: User;
}

export default function DashboardHeader({ user }: DashboardHeaderProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (res.ok) {
        router.push("/");
      }
    } catch (error) {
      console.error("Logout error:", error);
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="shadow-three border-b border-stroke bg-white dark:border-white/10 dark:bg-black/40">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-2xl font-bold text-primary">
            Glass Underwrite
          </Link>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              {user.tier === "pro" ? "Pro" : "Free"}
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-4">
          <Link
            href="/underwrite"
            className="shadow-submit dark:shadow-submit-dark rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
          >
            New Report
          </Link>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="rounded-md border border-stroke px-4 py-2 text-sm font-medium text-body-color transition-colors hover:border-primary hover:text-primary disabled:opacity-50 dark:border-white/20 dark:text-white dark:hover:border-primary"
          >
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
        </nav>
      </div>
    </header>
  );
}
