"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUnderwriting } from "@/context/UnderwritingContext";
import { EmailSchema } from "@/lib/underwriting/validation";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";

export default function Step5EmailVerification() {
  const router = useRouter();
  const {
    formData,
    setIsSubmitting,
    isSubmitting,
    setError,
    goToPreviousStep,
    setProgressStep,
    setProgressStatus,
    setProgressPercent,
    setIsProcessing,
  } = useUnderwriting();

  const { executeRecaptcha } = useGoogleReCaptcha();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState(["", "", "", "", "", ""]);
  const [codeError, setCodeError] = useState("");
  const [sendingCode, setSendingCode] = useState(false);

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

    // Validate email format
    try {
      EmailSchema.parse(email);
    } catch {
      setEmailError("Please enter a valid email address");
      return;
    }

    setEmailError("");
    setSendingCode(true);

    try {
      const response = await fetch("/api/underwrite/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send verification code");
      }

      setCodeSent(true);
      // Focus first code input
      setTimeout(() => {
        codeInputRefs[0].current?.focus();
      }, 100);
    } catch (error: any) {
      setEmailError(error.message || "An error occurred");
    } finally {
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
    setIsProcessing(true);
    setError(null);
    setCodeError("");

    try {
      // Get reCAPTCHA token
      if (!executeRecaptcha) {
        throw new Error("reCAPTCHA not available");
      }

      const recaptchaToken = await executeRecaptcha("underwriting_submit");

      // Start streaming fetch
      const response = await fetch("/api/underwrite/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          verificationCode: code,
          recaptchaToken,
          formData,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to process underwriting");
      }

      // Check if we got a streaming response
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("text/event-stream")) {
        throw new Error("Unexpected response format");
      }

      // Read the stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("Stream reader not available");
      }

      let buffer = "";
      let reportId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines (events are separated by \n\n)
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data: ")) {
            continue;
          }

          try {
            const jsonStr = line.substring(6); // Remove "data: " prefix
            const event = JSON.parse(jsonStr);

            if (event.type === "progress") {
              // Update progress state
              setProgressStep(event.step);
              setProgressStatus(event.status);
              setProgressPercent(event.progress);
            } else if (event.type === "complete") {
              // Processing complete
              setProgressPercent(100);
              setProgressStatus("Complete!");

              if (event.data?.reportId) {
                reportId = event.data.reportId;
              }
            } else if (event.type === "error") {
              // Error occurred
              if (event.data?.code === "INVALID_CODE") {
                setCodeError(event.status || "Invalid verification code");
              } else {
                setError(event.status || "An error occurred");
              }
              return;
            }
          } catch (parseError) {
            console.error("Failed to parse event:", parseError);
          }
        }
      }

      // Redirect to report
      if (reportId) {
        router.push(`/underwrite/results/${reportId}`);
      } else {
        throw new Error("Report ID not received");
      }
    } catch (error: any) {
      setError(error.message || "An error occurred while processing your request");
    } finally {
      setIsSubmitting(false);
      setIsProcessing(false);
      // Reset progress state
      setTimeout(() => {
        setProgressStep(0);
        setProgressStatus("");
        setProgressPercent(0);
      }, 1000);
    }
  };

  const inputClass =
    "border-stroke w-full rounded-sm border bg-[#f8f8f8] px-6 py-3 text-base text-dark placeholder:text-body-color outline-none focus:border-primary dark:border-transparent dark:bg-[#2C303B] dark:text-white dark:placeholder:text-body-color-dark dark:shadow-two dark:focus:border-primary dark:focus:shadow-none";
  const labelClass = "mb-3 block text-sm font-medium text-dark dark:text-white";
  const errorClass = "mt-1 text-sm text-red-600 dark:text-red-400";

  return (
    <div className="-mx-4 flex flex-wrap">
      <div className="w-full px-4">
        <div className="mb-8">
          <div className="mb-6 rounded-sm bg-blue-50 p-4 dark:bg-blue-900/20">
            <p className="text-sm text-body-color">
              <strong>Final Step:</strong> Verify your email to receive your AI-powered underwriting analysis from Gary.
            </p>
            <p className="mt-2 text-xs text-body-color">
              You get <strong>3 free analyses</strong> per verified email address.
            </p>
          </div>

          {!codeSent ? (
            <form onSubmit={handleSendCode}>
              <label htmlFor="email" className={labelClass}>
                Email Address *
              </label>
              <div className="flex gap-3">
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
                  disabled={sendingCode}
                  className="whitespace-nowrap rounded-sm bg-primary px-6 py-3 text-base font-medium text-white shadow-submit duration-300 hover:bg-primary/90 disabled:opacity-50"
                >
                  {sendingCode ? "Sending..." : "Send Code"}
                </button>
              </div>
              {emailError && <p className={errorClass}>{emailError}</p>}
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
