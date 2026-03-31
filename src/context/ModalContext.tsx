"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { usePromoStatus } from "@/hooks/usePromoStatus";
import UpgradePromoModal from "@/components/UpgradePromoModal";

interface ModalContextType {
  isContactOpen: boolean;
  selectedPlan: string | null;
  openContactModal: (plan?: string) => void;
  closeContactModal: () => void;
  isUpgradeOpen: boolean;
  openUpgradeModal: (expiryTime?: string) => void;
  closeUpgradeModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [customExpiryTime, setCustomExpiryTime] = useState<Date | null>(null);

  // Get promo status for upgrade modal (for logged-in users)
  const { promoStatus } = usePromoStatus();

  // Use custom expiry time if provided (for non-logged-in users), otherwise use promoStatus
  const upgradeExpiryTime = customExpiryTime ||
    (promoStatus?.expiresAt ? new Date(promoStatus.expiresAt) : null);

  useEffect(() => {
    if (isContactOpen || isUpgradeOpen) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
  }, [isContactOpen, isUpgradeOpen]);

  const openContactModal = (plan?: string) => {
    setSelectedPlan(plan || null);
    setIsContactOpen(true);
  };

  const closeContactModal = () => {
    setIsContactOpen(false);
    setSelectedPlan(null);
  };

  const openUpgradeModal = (expiryTime?: string) => {
    if (expiryTime) {
      setCustomExpiryTime(new Date(expiryTime));
    }
    setIsUpgradeOpen(true);
  };

  const closeUpgradeModal = () => {
    setIsUpgradeOpen(false);
    setCustomExpiryTime(null);
  };

  return (
    <ModalContext.Provider
      value={{
        isContactOpen,
        selectedPlan,
        openContactModal,
        closeContactModal,
        isUpgradeOpen,
        openUpgradeModal,
        closeUpgradeModal,
      }}
    >
      {children}
      <UpgradePromoModal
        isOpen={isUpgradeOpen}
        onClose={closeUpgradeModal}
        expiryTime={upgradeExpiryTime}
      />
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
}
