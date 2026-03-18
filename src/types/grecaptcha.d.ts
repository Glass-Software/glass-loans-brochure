// Type declarations for Google reCAPTCHA
interface ReCaptchaInstance {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
  render: (container: string | HTMLElement, parameters: Record<string, any>) => number;
}

interface Window {
  grecaptcha: ReCaptchaInstance;
}
