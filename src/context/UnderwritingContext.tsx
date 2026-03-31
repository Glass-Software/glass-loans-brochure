"use client";

import { createContext, useContext, useState } from "react";
import {
  UnderwritingFormData,
  UnderwritingResults,
  PropertyComps,
  CompSelectionState,
} from "@/types/underwriting";

interface UnderwritingContextType {
  // Current step (1-6)
  currentStep: number;
  setCurrentStep: (step: number) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;

  // Form data
  formData: Partial<UnderwritingFormData>;
  updateFormData: (data: Partial<UnderwritingFormData>) => void;
  resetFormData: () => void;

  // Comp selection (Step 6)
  propertyComps: PropertyComps | null;
  setPropertyComps: (comps: PropertyComps | null) => void;
  compSelectionState: CompSelectionState[];
  setCompSelectionState: (state: CompSelectionState[]) => void;
  updateCompSelection: (compIndex: number, updates: Partial<Omit<CompSelectionState, 'compIndex'>>) => void;
  getActiveCompsCount: () => number;
  lastFetchedAddress: string | null;
  setLastFetchedAddress: (address: string | null) => void;

  // Email state
  email: string | null;
  setEmail: (email: string) => void;
  emailVerified: boolean;
  setEmailVerified: (verified: boolean) => void;
  verificationCode: string | null;
  setVerificationCode: (code: string) => void;

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

  // Progress state (for streaming)
  progressStep: number;
  setProgressStep: (step: number) => void;
  progressStatus: string;
  setProgressStatus: (status: string) => void;
  progressPercent: number;
  setProgressPercent: (percent: number) => void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;

  // Errors
  error: string | null;
  setError: (error: string | null) => void;

  // Demo mode
  isDemoMode: boolean;
  setIsDemoMode: (isDemoMode: boolean) => void;

  // Cached Gary data (for demo mode)
  cachedGaryData: {
    garyOpinion: string | null;
    garyEstimatedARV: number | null;
    garyAsIsValue: number | null;
    finalScore: number | null;
  } | null;
  setCachedGaryData: (data: {
    garyOpinion: string | null;
    garyEstimatedARV: number | null;
    garyAsIsValue: number | null;
    finalScore: number | null;
  } | null) => void;
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
  const [propertyComps, setPropertyComps] = useState<PropertyComps | null>(null);
  const [compSelectionState, setCompSelectionState] = useState<CompSelectionState[]>([]);
  const [lastFetchedAddress, setLastFetchedAddress] = useState<string | null>(null);
  const [email, setEmailState] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [verificationCode, setVerificationCodeState] = useState<string | null>(null);
  const [usageCount, setUsageCount] = useState(0);
  const [results, setResults] = useState<UnderwritingResults | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Progress state for streaming
  const [progressStep, setProgressStep] = useState(0);
  const [progressStatus, setProgressStatus] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Demo mode
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [cachedGaryData, setCachedGaryData] = useState<{
    garyOpinion: string | null;
    garyEstimatedARV: number | null;
    garyAsIsValue: number | null;
    finalScore: number | null;
  } | null>(null);

  const usageLimit = 5;

  const goToNextStep = () => {
    if (currentStep < 6) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      console.log(`📉 goToPreviousStep: ${currentStep} -> ${currentStep - 1}`);
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      console.log(`📉 goToPreviousStep: Already at step 1, cannot go back`);
    }
  };

  const updateFormData = (data: Partial<UnderwritingFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const updateCompSelection = (
    compIndex: number,
    updates: Partial<Omit<CompSelectionState, 'compIndex'>>
  ) => {
    setCompSelectionState((prev) => {
      const newState = [...prev];
      const existingIndex = newState.findIndex((s) => s.compIndex === compIndex);

      if (existingIndex >= 0) {
        // Update existing state
        newState[existingIndex] = { ...newState[existingIndex], ...updates };
      } else {
        // Add new state
        newState.push({
          compIndex,
          emphasized: updates.emphasized ?? false,
          removed: updates.removed ?? false,
        });
      }

      return newState;
    });
  };

  const getActiveCompsCount = () => {
    if (!propertyComps) return 0;

    return propertyComps.compsUsed.filter((_, idx) => {
      const state = compSelectionState.find((s) => s.compIndex === idx);
      return !state?.removed;
    }).length;
  };

  const resetFormData = () => {
    setFormData({ renovationFunds: 0 });
    setPropertyComps(null);
    setCompSelectionState([]);
    setLastFetchedAddress(null);
    setCurrentStep(1);
    setResults(null);
    setError(null);
    setEmailVerified(false);
    setVerificationCodeState(null);
    setIsDemoMode(false);
    setCachedGaryData(null);
  };

  const setEmail = (newEmail: string) => {
    setEmailState(newEmail);
  };

  const setVerificationCode = (code: string) => {
    setVerificationCodeState(code);
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
        propertyComps,
        setPropertyComps,
        compSelectionState,
        setCompSelectionState,
        updateCompSelection,
        getActiveCompsCount,
        lastFetchedAddress,
        setLastFetchedAddress,
        email,
        setEmail,
        emailVerified,
        setEmailVerified,
        verificationCode,
        setVerificationCode,
        usageCount,
        setUsageCount,
        usageLimit,
        results,
        setResults,
        isSubmitting,
        setIsSubmitting,
        progressStep,
        setProgressStep,
        progressStatus,
        setProgressStatus,
        progressPercent,
        setProgressPercent,
        isProcessing,
        setIsProcessing,
        error,
        setError,
        isDemoMode,
        setIsDemoMode,
        cachedGaryData,
        setCachedGaryData,
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
