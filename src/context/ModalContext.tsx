"use client";

import { createContext, useContext, useState, useEffect } from "react";

interface ModalContextType {
  isContactOpen: boolean;
  selectedPlan: string | null;
  openContactModal: (plan?: string) => void;
  closeContactModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  useEffect(() => {
    if (isContactOpen) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
  }, [isContactOpen]);

  const openContactModal = (plan?: string) => {
    setSelectedPlan(plan || null);
    setIsContactOpen(true);
  };

  const closeContactModal = () => {
    setIsContactOpen(false);
    setSelectedPlan(null);
  };

  return (
    <ModalContext.Provider
      value={{
        isContactOpen,
        selectedPlan,
        openContactModal,
        closeContactModal,
      }}
    >
      {children}
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
