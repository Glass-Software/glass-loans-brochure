"use client";

import { createContext, useContext, useState } from "react";
import {
  UnderwritingFormData,
  UnderwritingResults,
} from "@/types/underwriting";

interface UnderwritingContextType {
  // Current step (1-5)
  currentStep: number;
  setCurrentStep: (step: number) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;

  // Form data
  formData: Partial<UnderwritingFormData>;
  updateFormData: (data: Partial<UnderwritingFormData>) => void;
  resetFormData: () => void;

  // Email state
  email: string | null;
  setEmail: (email: string) => void;
  emailVerified: boolean;
  setEmailVerified: (verified: boolean) => void;

  // Usage tracking
  usageCount: number;
  setUsageCount: (count: number) => void;
  usageLimit: number;

  // Results
  results: UnderwritingResults | null;
  setResults: (results: UnderwritingResults | null) => void;

  // Submission state
  isSubmitting: boolean;
  setIsSubmitting: (submitting: boolean) => void;

  // Errors
  error: string | null;
  setError: (error: string | null) => void;
}

const UnderwritingContext = createContext<
  UnderwritingContextType | undefined
>(undefined);

export function UnderwritingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Partial<UnderwritingFormData>>({
    // Set defaults
    renovationFunds: 0,
  });
  const [email, setEmailState] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [results, setResults] = useState<UnderwritingResults | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usageLimit = 3;

  const goToNextStep = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const updateFormData = (data: Partial<UnderwritingFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const resetFormData = () => {
    setFormData({ renovationFunds: 0 });
    setCurrentStep(1);
    setResults(null);
    setError(null);
    setEmailVerified(false);
  };

  const setEmail = (newEmail: string) => {
    setEmailState(newEmail);
  };

  return (
    <UnderwritingContext.Provider
      value={{
        currentStep,
        setCurrentStep,
        goToNextStep,
        goToPreviousStep,
        formData,
        updateFormData,
        resetFormData,
        email,
        setEmail,
        emailVerified,
        setEmailVerified,
        usageCount,
        setUsageCount,
        usageLimit,
        results,
        setResults,
        isSubmitting,
        setIsSubmitting,
        error,
        setError,
      }}
    >
      {children}
    </UnderwritingContext.Provider>
  );
}

export function useUnderwriting() {
  const context = useContext(UnderwritingContext);
  if (context === undefined) {
    throw new Error(
      "useUnderwriting must be used within an UnderwritingProvider",
    );
  }
  return context;
}
