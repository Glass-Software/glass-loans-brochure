"use client";

import { useState } from "react";
import { useUnderwriting } from "@/context/UnderwritingContext";
import { EmailSchema } from "@/lib/underwriting/validation";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";

export default function Step5EmailVerification() {
  const {
    email,
    setEmail,
    emailVerified,
    setEmailVerified,
    usageCount,
    setUsageCount,
    usageLimit,
    formData,
    setResults,
    setIsSubmitting,
    isSubmitting,
    setError,
    goToPreviousStep,
  } = useUnderwriting();

  const { executeRecaptcha } = useGoogleReCaptcha();
  const [localEmail, setLocalEmail] = useState(email || "");
  const [emailError, setEmailError] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate email format
    try {
      EmailSchema.parse(localEmail);
    } catch {
      setEmailError("Please enter a valid email address");
      return;
    }

    setEmailError("");
    setIsSubmitting(true);

    try {
      // Check email and usage
      const response = await fetch("/api/underwrite/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: localEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to verify email");
      }

      setEmail(localEmail);

      if (data.verified) {
        // Email already verified
        setEmailVerified(true);
        setUsageCount(data.usageCount || 0);

        if (data.limitReached) {
          setError(
            "You've reached your limit of 3 free underwriting analyses. Please contact us for more.",
          );
        } else {
          // Proceed to submit underwriting
          await submitUnderwriting(localEmail);
        }
      } else {
        // Verification email sent
        setVerificationSent(true);
      }
    } catch (error: any) {
      setEmailError(error.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitUnderwriting = async (userEmail: string) => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Get reCAPTCHA token
      if (!executeRecaptcha) {
        throw new Error("reCAPTCHA not available");
      }

      const recaptchaToken = await executeRecaptcha("underwriting_submit");

      const response = await fetch("/api/underwrite/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          recaptchaToken,
          formData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process underwriting");
      }

      if (data.limitReached) {
        setError(
          "You've reached your limit of 3 free underwriting analyses.",
        );
        return;
      }

      // Success! Set results
      setResults(data.results);
      setUsageCount((data.results?.usageCount || 0) + 1);
    } catch (error: any) {
      setError(error.message || "An error occurred while processing your request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    "border-stroke w-full rounded-sm border bg-[#f8f8f8] px-6 py-3 text-base text-dark placeholder:text-body-color outline-none focus:border-primary dark:border-transparent dark:bg-[#2C303B] dark:text-white dark:placeholder:text-body-color-dark dark:shadow-two dark:focus:border-primary dark:focus:shadow-none";
  const labelClass = "mb-3 block text-sm font-medium text-dark dark:text-white";
  const errorClass = "mt-1 text-sm text-red-600 dark:text-red-400";

  if (verificationSent) {
    return (
      <div className="rounded-sm bg-white p-8 shadow-three dark:bg-gray-dark">
        <div className="text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <svg
              className="h-8 w-8 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 className="mb-2 text-xl font-semibold text-dark dark:text-white">
            Check Your Email
          </h3>
          <p className="mb-6 text-body-color">
            We&apos;ve sent a verification link to <strong>{localEmail}</strong>.
            Click the link to view your underwriting results.
          </p>
          <p className="text-sm text-body-color">
            The link expires in 24 hours. Didn&apos;t receive it? Check your spam folder.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleEmailSubmit}>
      <div className="-mx-4 flex flex-wrap">
        <div className="w-full px-4">
          <div className="mb-8">
            <div className="mb-6 rounded-sm bg-blue-50 p-4 dark:bg-blue-900/20">
              <p className="text-sm text-body-color">
                <strong>Final Step:</strong> Enter your email to receive your AI-powered underwriting analysis from Gary.
              </p>
              <p className="mt-2 text-xs text-body-color">
                You get <strong>3 free analyses</strong> per email address. We&apos;ll send you a verification link to view your results.
              </p>
            </div>

            <label htmlFor="email" className={labelClass}>
              Email Address *
            </label>
            <input
              type="email"
              id="email"
              value={localEmail}
              onChange={(e) => setLocalEmail(e.target.value)}
              placeholder="your@email.com"
              disabled={isSubmitting}
              className={inputClass}
            />
            {emailError && <p className={errorClass}>{emailError}</p>}
          </div>
        </div>

        <div className="w-full px-4">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={goToPreviousStep}
              disabled={isSubmitting}
              className="rounded-sm border border-primary px-9 py-4 text-base font-medium text-primary duration-300 hover:bg-primary hover:text-white disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-sm bg-primary px-9 py-4 text-base font-medium text-white shadow-submit duration-300 hover:bg-primary/90 disabled:opacity-50 dark:shadow-submit-dark"
            >
              {isSubmitting ? "Processing..." : "Get Gary's Opinion"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
