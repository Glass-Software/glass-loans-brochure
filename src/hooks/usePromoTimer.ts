import { useState, useEffect } from "react";

interface PromoTimerResult {
  timeRemaining: number; // milliseconds
  isExpired: boolean;
  hoursRemaining: number;
  minutesRemaining: number;
  secondsRemaining: number;
}

export function usePromoTimer(expiryTime: Date | null): PromoTimerResult {
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    if (!expiryTime) return;

    const updateTimer = () => {
      const now = Date.now();
      const expiry = new Date(expiryTime).getTime();
      const remaining = Math.max(0, expiry - now);
      setTimeRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiryTime]);

  const isExpired = timeRemaining <= 0;
  const totalSeconds = Math.floor(timeRemaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    timeRemaining,
    isExpired,
    hoursRemaining: hours,
    minutesRemaining: minutes,
    secondsRemaining: seconds,
  };
}
