"use client";

import { useMemo, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { usePromoTimer } from "@/hooks/usePromoTimer";
import { usePromoStatus } from "@/hooks/usePromoStatus";
import { useModal } from "@/context/ModalContext";

// Helper to read cookie
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(";").shift() || null;
    // Decode URL-encoded characters (e.g., %3A -> :)
    return cookieValue ? decodeURIComponent(cookieValue) : null;
  }
  return null;
}

export default function UpgradePromoBanner() {
  const { openUpgradeModal } = useModal();
  const pathname = usePathname();

  // Priority: Cookie (pre-auth) > Database (post-auth)
  // Use state to trigger re-renders when cookie changes
  const [cookieExpiry, setCookieExpiry] = useState<string | null>(null);
  const { promoStatus, loading } = usePromoStatus();

  // Re-read cookie on initial mount and bfcache restoration
  useEffect(() => {
    // Initial read on mount
    setCookieExpiry(getCookie("gl_promo_expires"));

    // Handle bfcache restoration (browser back button)
    const handlePageShow = () => {
      // Always re-read cookie on pageshow, regardless of persisted status
      setCookieExpiry(getCookie("gl_promo_expires"));
    };

    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []); // Empty deps - only set up once

  // Re-read cookie when pathname changes (normal client-side navigation)
  useEffect(() => {
    setCookieExpiry(getCookie("gl_promo_expires"));
  }, [pathname]);

  // Clear cookie if API says user is Pro (prevents banner from showing on future page loads)
  useEffect(() => {
    if (!loading && promoStatus && !promoStatus.hasPromo && cookieExpiry) {
      // Delete the cookie
      document.cookie = "gl_promo_expires=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      setCookieExpiry(null);
    }
  }, [loading, promoStatus, cookieExpiry]);

  // Memoize the Date object to prevent recreating it on every render
  const expiryTime = useMemo(() => {
    if (cookieExpiry) {
      const date = new Date(cookieExpiry);
      return !isNaN(date.getTime()) ? date : null;
    }
    if (promoStatus?.expiresAt) {
      const date = new Date(promoStatus.expiresAt);
      return !isNaN(date.getTime()) ? date : null;
    }
    return null;
  }, [cookieExpiry, promoStatus?.expiresAt]);

  const { hoursRemaining, minutesRemaining, secondsRemaining, isExpired } =
    usePromoTimer(expiryTime);

  // Show banner if we have valid expiry (from cookie or database) and not expired
  const hasActivePromo = expiryTime && !isExpired;

  // Don't show on signup or dashboard pages (user is already upgrading or upgraded)
  if (pathname === '/signup' || pathname === '/dashboard') return null;

  // Hide banner if API has loaded and user is Pro (hasPromo: false overrides cookie)
  if (!loading && promoStatus && !promoStatus.hasPromo) return null;

  // Don't wait for API loading if we have cookie
  if (loading && !cookieExpiry) return null;
  if (!hasActivePromo) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[999] border-b border-primary/20 bg-gradient-to-r from-primary/90 to-primary px-4 py-3 shadow-lg">
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-4">
          {/* Timer */}
          <div className="flex gap-1">
            <div className="rounded bg-white/20 px-2 py-1">
              <span className="text-sm font-bold text-white">
                {hoursRemaining.toString().padStart(2, "0")}
              </span>
            </div>
            <span className="text-white">:</span>
            <div className="rounded bg-white/20 px-2 py-1">
              <span className="text-sm font-bold text-white">
                {minutesRemaining.toString().padStart(2, "0")}
              </span>
            </div>
            <span className="text-white">:</span>
            <div className="rounded bg-white/20 px-2 py-1">
              <span className="text-sm font-bold text-white">
                {secondsRemaining.toString().padStart(2, "0")}
              </span>
            </div>
          </div>

          {/* Message */}
          <p className="text-sm font-medium text-white">
            <span className="hidden sm:inline">Limited Time: </span>
            <strong>Save up to $400</strong> - Pro from $99/month
          </p>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => openUpgradeModal()}
            className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-white/90"
          >
            Upgrade Now
          </button>
        </div>
      </div>
    </div>
  );
}
