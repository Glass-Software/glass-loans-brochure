"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [step, setStep] = useState<"loading" | "code-entry" | "error">("loading");
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setError("Invalid signup link. Please complete checkout first.");
      setStep("error");
      return;
    }

    initializeSignup();
  }, [sessionId]);

  /**
   * Initialize signup flow:
   * 1. Verify Stripe session and get email
   * 2. Poll for webhook completion
   * 3. Send verification code
   * 4. Show code entry form
   */
  async function initializeSignup() {
    try {
      // Step 1: Verify Stripe session and get email
      const sessionRes = await fetch(`/api/stripe/verify-session?session_id=${sessionId}`);
      if (!sessionRes.ok) {
        throw new Error("Failed to verify checkout session");
      }
      const sessionData = await sessionRes.json();
      setEmail(sessionData.email);

      // Step 2: Poll for webhook completion (up to 10 seconds)
      let webhookProcessed = false;
      for (let i = 0; i < 10; i++) {
        const checkRes = await fetch(`/api/auth/check-subscription?email=${encodeURIComponent(sessionData.email)}`);
        const checkData = await checkRes.json();

        if (checkData.ready) {
          webhookProcessed = true;
          break;
        }

        // Wait 1 second before next poll
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (!webhookProcessed) {
        console.warn("Webhook processing timeout - continuing anyway");
      }

      // Step 3: Send verification code
      const sendCodeRes = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: sessionData.email }),
      });

      if (!sendCodeRes.ok) {
        const errorData = await sendCodeRes.json();
        throw new Error(errorData.error || "Failed to send verification code");
      }

      // Step 4: Show code entry form
      setCodeSent(true);
      setStep("code-entry");
    } catch (err: any) {
      console.error("Signup initialization error:", err);
      setError(err.message || "Failed to initialize signup");
      setStep("error");
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-code-pro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          verificationCode: verificationCode.trim(),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Invalid verification code");
        setLoading(false);
        return;
      }

      // Success! Redirect to dashboard
      router.push(data.redirectTo || "/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to verify code");
      setLoading(false);
    }
  }

  async function handleResendCode() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        throw new Error("Failed to resend code");
      }

      setCodeSent(true);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Failed to resend code");
      setLoading(false);
    }
  }

  return (
    <section className="relative z-10 overflow-hidden pb-16 pt-36 md:pb-20 lg:pb-28 lg:pt-[180px]">
      <div className="container">
        <div className="-mx-4 flex flex-wrap">
          <div className="w-full px-4">
            <div className="shadow-three mx-auto max-w-[500px] rounded bg-white px-6 py-10 dark:bg-dark sm:p-[60px]">

              {step === "loading" && (
                <div className="text-center">
                  <div className="mb-6 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-t-transparent"></div>
                  <h3 className="mb-3 text-2xl font-bold text-black dark:text-white">
                    Setting up your Pro account
                  </h3>
                  <p className="text-base text-body-color dark:text-body-color-dark">
                    Processing your payment and creating your account...
                  </p>
                </div>
              )}

              {step === "code-entry" && (
                <>
                  <div className="mb-6 text-center">
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
                    <h3 className="mb-3 text-2xl font-bold text-black dark:text-white sm:text-3xl">
                      Welcome to Glass Loans Pro!
                    </h3>
                    <p className="mb-4 text-base text-body-color dark:text-body-color-dark">
                      We've sent a verification code to:
                    </p>
                    <p className="text-lg font-semibold text-primary">{email}</p>
                  </div>

                  <form onSubmit={handleVerifyCode}>
                    <div className="mb-6">
                      <label
                        htmlFor="code"
                        className="mb-3 block text-sm font-medium text-dark dark:text-white"
                      >
                        Enter Verification Code
                      </label>
                      <input
                        type="text"
                        id="code"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        placeholder="Enter 6-digit code"
                        maxLength={6}
                        className="border-stroke dark:text-body-color-dark dark:shadow-two w-full rounded-sm border bg-[#f8f8f8] px-6 py-3 text-center text-2xl font-mono tracking-widest text-body-color outline-none transition-all duration-300 focus:border-primary dark:border-transparent dark:bg-[#2C303B] dark:focus:border-primary dark:focus:shadow-none"
                        required
                        autoFocus
                        disabled={loading}
                      />
                    </div>

                    {error && (
                      <div className="mb-4 rounded bg-red-100 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                        {error}
                      </div>
                    )}

                    <div className="mb-6">
                      <button
                        type="submit"
                        disabled={loading || verificationCode.length !== 6}
                        className="shadow-submit dark:shadow-submit-dark flex w-full items-center justify-center rounded-sm bg-primary px-9 py-4 text-base font-medium text-white duration-300 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loading ? "Verifying..." : "Verify & Access Dashboard"}
                      </button>
                    </div>

                    <div className="text-center">
                      <p className="text-sm text-body-color dark:text-body-color-dark">
                        Didn't receive the code?{" "}
                        <button
                          type="button"
                          onClick={handleResendCode}
                          disabled={loading}
                          className="text-primary hover:underline disabled:opacity-50"
                        >
                          Resend Code
                        </button>
                      </p>
                    </div>
                  </form>

                  <div className="mt-6 rounded bg-blue-50 p-4 dark:bg-blue-900/20">
                    <p className="text-sm text-body-color dark:text-body-color-dark">
                      <strong className="text-primary">Your Pro Benefits:</strong>
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-body-color dark:text-body-color-dark">
                      <li>✓ 100 reports per month</li>
                      <li>✓ Unlimited report storage</li>
                      <li>✓ Priority support</li>
                    </ul>
                  </div>
                </>
              )}

              {step === "error" && (
                <>
                  <div className="mb-6 text-center">
                    <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                      <svg
                        className="h-8 w-8 text-red-600 dark:text-red-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <h3 className="mb-3 text-2xl font-bold text-black dark:text-white">
                      Something went wrong
                    </h3>
                    <p className="mb-6 text-base text-body-color dark:text-body-color-dark">
                      {error}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Link
                      href="/underwrite-pro"
                      className="shadow-submit dark:shadow-submit-dark flex w-full items-center justify-center rounded-sm bg-primary px-9 py-4 text-base font-medium text-white duration-300 hover:bg-primary/90"
                    >
                      Return to Pro Page
                    </Link>
                    <Link
                      href="/"
                      className="flex w-full items-center justify-center rounded-sm border border-stroke px-9 py-4 text-base font-medium text-body-color duration-300 hover:border-primary hover:text-primary dark:border-transparent dark:bg-[#2C303B] dark:text-body-color-dark dark:hover:border-primary dark:hover:text-primary"
                    >
                      Go Home
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute left-0 top-0 z-[-1]">
        <svg
          width="1440"
          height="969"
          viewBox="0 0 1440 969"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <mask
            id="mask0_95:1005"
            style={{ maskType: "alpha" }}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="1440"
            height="969"
          >
            <rect width="1440" height="969" fill="#090E34" />
          </mask>
          <g mask="url(#mask0_95:1005)">
            <path
              opacity="0.1"
              d="M1086.96 297.978L632.959 554.978L935.625 535.926L1086.96 297.978Z"
              fill="url(#paint0_linear_95:1005)"
            />
            <path
              opacity="0.1"
              d="M1324.5 755.5L1450 687V886.5L1324.5 967.5L-10 288L1324.5 755.5Z"
              fill="url(#paint1_linear_95:1005)"
            />
          </g>
          <defs>
            <linearGradient
              id="paint0_linear_95:1005"
              x1="1178.4"
              y1="151.853"
              x2="780.959"
              y2="453.581"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#4A6CF7" />
              <stop offset="1" stopColor="#4A6CF7" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="paint1_linear_95:1005"
              x1="160.5"
              y1="220"
              x2="1099.45"
              y2="1192.04"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#4A6CF7" />
              <stop offset="1" stopColor="#4A6CF7" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </section>
  );
}
