import { useState, useEffect } from "react";

interface PromoStatus {
  hasPromo: boolean;
  expiresAt: string | null;
}

export function usePromoStatus() {
  const [promoStatus, setPromoStatus] = useState<PromoStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPromoStatus() {
      try {
        const res = await fetch("/api/auth/promo-status");
        if (res.ok) {
          const data = await res.json();
          setPromoStatus(data);
        }
      } catch (error) {
        console.error("Failed to fetch promo status:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPromoStatus();

    // Poll every 5 seconds to keep timer in sync
    const interval = setInterval(fetchPromoStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  return { promoStatus, loading };
}
