"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUnderwriting } from "@/context/UnderwritingContext";
import { EmailSchema } from "@/lib/underwriting/validation";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { useModal } from "@/context/ModalContext";

type AuthenticatedUser = {
  id: number;
  email: string;
  tier: string;
  stripe_customer_id: string | null;
} | null;

interface Step5EmailVerificationProps {
  authenticatedUser: AuthenticatedUser;
}

export default function Step5EmailVerification({ authenticatedUser }: Step5EmailVerificationProps) {
  const router = useRouter();
  const { openUpgradeModal } = useModal();
  const {
    formData,
    setIsSubmitting,
    isSubmitting,
    setError,
    goToPreviousStep,
    goToNextStep,
    setProgressStep,
    setProgressStatus,
    setProgressPercent,
    setIsProcessing,
    setPropertyComps,
    setCompSelectionState,
    setEmail: setContextEmail,
    setEmailVerified,
    setVerificationCode: setContextVerificationCode,
    setUsageCount,
  } = useUnderwriting();

  const { executeRecaptcha } = useGoogleReCaptcha();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState(["", "", "", "", "", ""]);
  const [codeError, setCodeError] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  const isAuthenticated = !!authenticatedUser;
  const userEmail = authenticatedUser?.email || "";

  // Track if we've already auto-skipped to prevent loops when navigating back
  const [hasAutoSkipped, setHasAutoSkipped] = useState(false);

  // Auto-skip verification for authenticated users (but only once)
  useEffect(() => {
    if (isAuthenticated && userEmail && !hasAutoSkipped) {
      console.log("📧 [Step5] Auto-skipping for authenticated user:", userEmail);
      // Set email in context for submit endpoint
      setContextEmail(userEmail);
      setEmailVerified(true);
      setHasAutoSkipped(true);

      // Skip to next step immediately
      goToNextStep();
    }
  }, [isAuthenticated, userEmail, hasAutoSkipped, setContextEmail, setEmailVerified, goToNextStep]);

  // Refs for code inputs
  const codeInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("🔵 [Step5] handleSendCode started");

    // Validate email format
    try {
      EmailSchema.parse(email);
      console.log("🔵 [Step5] Email validation passed:", email);
    } catch {
      console.log("🔴 [Step5] Email validation failed");
      setEmailError("Please enter a valid email address");
      return;
    }

    // Validate marketing consent (REQUIRED)
    if (!marketingConsent) {
      console.log("🔴 [Step5] Marketing consent not checked");
      setEmailError("You must agree to receive marketing emails to continue");
      return;
    }

    console.log("🔵 [Step5] Starting API request...");
    setEmailError("");
    setSendingCode(true);

    try {
      console.log("🔵 [Step5] Fetching /api/underwrite/send-code...");
      const response = await fetch("/api/underwrite/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, marketingConsent }),
      });

      console.log("🔵 [Step5] Response received:", response.status);
      const data = await response.json();
      console.log("🔵 [Step5] Response data:", data);

      if (!response.ok) {
        // Check if user hit usage limit - open upgrade modal instead of showing error
        if (data.limitReached) {
          console.log("🔵 [Step5] Usage limit reached - opening upgrade modal");
          console.log("🔵 [Step5] Promo expires at:", data.promoExpiresAt);
          openUpgradeModal(data.promoExpiresAt);
          return;
        }
        throw new Error(data.error || "Failed to send verification code");
      }

      console.log("🔵 [Step5] Code sent successfully");
      setCodeSent(true);
      // Focus first code input
      setTimeout(() => {
        codeInputRefs[0].current?.focus();
      }, 100);
    } catch (error: any) {
      console.error("🔴 [Step5] Error:", error);
      setEmailError(error.message || "An error occurred");
    } finally {
      console.log("🔵 [Step5] Finally block - resetting sendingCode");
      setSendingCode(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) {
      return;
    }

    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);
    setCodeError("");

    // Auto-focus next input
    if (value && index < 5) {
      codeInputRefs[index + 1].current?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !verificationCode[index] && index > 0) {
      codeInputRefs[index - 1].current?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);

    if (paste.length === 6) {
      const newCode = paste.split("");
      setVerificationCode(newCode);
      codeInputRefs[5].current?.focus();
    }
  };

  const handleVerifyAndSubmit = async () => {
    const code = verificationCode.join("");

    if (code.length !== 6) {
      setCodeError("Please enter the 6-digit code");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setCodeError("");

    try {
      // Get reCAPTCHA token (skip if not configured)
      let recaptchaToken = null;
      if (executeRecaptcha) {
        try {
          recaptchaToken = await executeRecaptcha("verify_code");
        } catch (error) {
          console.warn("reCAPTCHA execution failed, continuing without it:", error);
        }
      }

      // Verify email code
      const verifyResponse = await fetch("/api/underwrite/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          verificationCode: code,
          recaptchaToken,
        }),
      });

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        throw new Error(errorData.error || "Invalid verification code");
      }

      const verifyData = await verifyResponse.json();

      // Update context with verified email, verification code, and usage count
      setContextEmail(email);
      setContextVerificationCode(code);
      setEmailVerified(true);
      setUsageCount(verifyData.user.usageCount);

      // Move to next step
      goToNextStep();
    } catch (error: any) {
      console.error("Verification error:", error);
      if (error.message.includes("verification code")) {
        setCodeError(error.message);
      } else {
        setError(error.message || "An error occurred while processing your request");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    "border-stroke w-full rounded-sm border bg-[#f8f8f8] px-6 py-3 text-base text-dark placeholder:text-placeholder-color outline-none focus:border-primary dark:border-transparent dark:bg-[#2C303B] dark:text-white dark:placeholder:text-placeholder-color-dark dark:shadow-two dark:focus:border-primary dark:focus:shadow-none";
  const labelClass = "mb-3 block text-sm font-medium text-dark dark:text-white";
  const errorClass = "mt-1 text-sm text-red-600 dark:text-red-400";

  return (
    <div className="-mx-4 flex flex-wrap">
      <div className="w-full px-4">
        <div className="mb-8">
          <div className="mb-6 rounded-sm bg-blue-50 p-4 dark:bg-blue-900/20">
            <p className="text-sm text-body-color dark:text-body-color-dark">
              <strong>Final Step:</strong> {isAuthenticated ? "Verify your identity" : "Verify your email"} to receive your AI-powered underwriting analysis from Gary.
            </p>
            {!isAuthenticated && (
              <p className="mt-2 text-xs text-body-color dark:text-body-color-dark">
                You get <strong>5 free reports</strong> per verified email address.
              </p>
            )}
          </div>

          {!codeSent ? (
            <form onSubmit={handleSendCode}>
              {isAuthenticated ? (
                <div className="mb-4 rounded-sm border border-green-500/20 bg-green-500/10 p-4">
                  <p className="text-sm text-green-700 dark:text-green-300">
                    ✓ Report will be saved to your Pro account ({userEmail})
                  </p>
                </div>
              ) : (
                <>
                  <label htmlFor="email" className={labelClass}>
                    Email Address *
                  </label>
                  <div className="mb-4 flex gap-3">
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      disabled={sendingCode}
                      className={inputClass}
                    />
                    <button
                      type="submit"
                      disabled={sendingCode || !marketingConsent}
                      className="whitespace-nowrap rounded-sm bg-primary px-6 py-3 text-base font-medium text-white shadow-submit duration-300 hover:bg-primary/90 disabled:opacity-50"
                    >
                      {sendingCode ? "Sending..." : "Send Code"}
                    </button>
                  </div>
                  {emailError && <p className={errorClass}>{emailError}</p>}

                  <div className="mt-4 flex items-start">
                    <input
                      type="checkbox"
                      id="marketingConsent"
                      checked={marketingConsent}
                      onChange={(e) => setMarketingConsent(e.target.checked)}
                      required
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <label
                      htmlFor="marketingConsent"
                      className="ml-3 text-sm text-body-color dark:text-body-color-dark"
                    >
                      <span className="font-semibold text-dark dark:text-white">*</span> I agree to receive marketing emails from Glass Loans about new products, features, and special offers. You can unsubscribe at any time.
                    </label>
                  </div>
                </>
              )}

              {isAuthenticated && (
                <button
                  type="submit"
                  disabled={sendingCode}
                  className="w-full rounded-sm bg-primary px-6 py-3 text-base font-medium text-white shadow-submit duration-300 hover:bg-primary/90 disabled:opacity-50"
                >
                  {sendingCode ? "Sending..." : "Send Verification Code"}
                </button>
              )}
            </form>
          ) : (
            <div>
              <div className="mb-4 rounded-sm bg-green-50 p-4 dark:bg-green-900/20">
                <p className="text-sm text-green-800 dark:text-green-200">
                  ✓ Verification code sent to <strong>{email}</strong>
                </p>
                <button
                  onClick={() => {
                    setCodeSent(false);
                    setVerificationCode(["", "", "", "", "", ""]);
                    setCodeError("");
                  }}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  Change email
                </button>
              </div>

              <label className={labelClass}>
                Enter 6-Digit Code *
              </label>
              <div className="mb-4 flex justify-center gap-2">
                {verificationCode.map((digit, index) => (
                  <input
                    key={index}
                    ref={codeInputRefs[index]}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(index, e)}
                    onPaste={index === 0 ? handleCodePaste : undefined}
                    disabled={isSubmitting}
                    className="h-14 w-14 rounded-sm border border-stroke bg-[#f8f8f8] text-center text-2xl font-semibold text-dark outline-none focus:border-primary dark:border-transparent dark:bg-[#2C303B] dark:text-white"
                  />
                ))}
              </div>
              {codeError && <p className={errorClass}>{codeError}</p>}

              <div className="text-center">
                <button
                  onClick={handleSendCode}
                  disabled={sendingCode}
                  className="text-sm text-body-color hover:text-primary"
                >
                  Didn&apos;t receive code? Resend
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-full px-4">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={goToPreviousStep}
            disabled={isSubmitting || sendingCode}
            className="rounded-sm border border-primary px-9 py-4 text-base font-medium text-primary duration-300 hover:bg-primary hover:text-white disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={handleVerifyAndSubmit}
            disabled={!codeSent || isSubmitting || verificationCode.join("").length !== 6}
            className="rounded-sm bg-primary px-9 py-4 text-base font-medium text-white shadow-submit duration-300 hover:bg-primary/90 disabled:opacity-50 dark:shadow-submit-dark"
          >
            {isSubmitting ? "Processing..." : "Verify & Get Report"}
          </button>
        </div>
      </div>
    </div>
  );
}
