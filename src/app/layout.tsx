"use client";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import ScrollToTop from "@/components/ScrollToTop";
import { Inter } from "next/font/google";
import "node_modules/react-modal-video/css/modal-video.css";
import "../styles/index.css";
import { Providers } from "./providers";
import { ModalProvider } from "@/context/ModalContext";
import ContactModal from "@/components/ContactModal";
import UpgradePromoBanner from "@/components/UpgradePromoBanner";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";
import { usePathname } from "next/navigation";

const inter = Inter({ subsets: ["latin"] });

// Metadata needs to be in a separate file since this is a client component
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Hide header/footer on dashboard routes
  const isDashboardRoute = pathname?.startsWith("/dashboard");

  return (
    <html suppressHydrationWarning lang="en">
      {/*
        <head /> will contain the components returned by the nearest parent
        head.js. Find out more at https://beta.nextjs.org/docs/api-reference/file-conventions/head
      */}
      <head>
        <link rel="icon" href="/favicon.svg" />
      </head>
      <body className={`bg-[#FCFCFC] dark:bg-black ${inter.className}`}>
        <Providers>
          <GoogleReCaptchaProvider
            reCaptchaKey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ""}
            scriptProps={{
              async: true,
              defer: true,
              appendTo: "head",
            }}
          >
            <ModalProvider>
              <UpgradePromoBanner />
              {!isDashboardRoute && <Header />}
              {children}
              {!isDashboardRoute && <Footer />}
              <ScrollToTop />
              <ContactModal />
            </ModalProvider>
          </GoogleReCaptchaProvider>
        </Providers>
      </body>
    </html>
  );
}
