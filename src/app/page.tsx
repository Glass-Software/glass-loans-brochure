import AboutSectionOne from "@/components/About/AboutSectionOne";
import AboutSectionTwo from "@/components/About/AboutSectionTwo";
import Blog from "@/components/Blog";
import Brands from "@/components/Brands";
import ScrollUp from "@/components/Common/ScrollUp";
import Contact from "@/components/Contact";
import Features from "@/components/Features";
import Hero from "@/components/Hero";
import Pricing from "@/components/Pricing";
import Testimonials from "@/components/Testimonials";
// import Video from "@/components/Video";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Glass Loan Management Software",
  description: "Simple, easy to use loan management software",
  openGraph: {
    title: "Glass Loan Management Software",
    description: "Simple, easy to use loan management software",
    url: "https://glassloans.com",
    siteName: "Glass Loans",
    images: [
      {
        url: "/images/logo/glass_logo_2.svg",
        width: 1200,
        height: 630,
        alt: "Glass Loans Logo",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  // twitter: {
  //   card: "summary_large_image",
  //   title: "Glass Loan Management Software",
  //   description: "Simple, easy to use loan management software",
  //   images: ["/images/logo/glass_logo_2.svg"],
  //   creator: "@glassloans",
  // },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://glassloans.com",
  },
};

export default function Home() {
  return (
    <>
      <ScrollUp />
      <Hero />
      <Features />
      {/* <Video /> */}
      {/* <Brands /> */}
      <AboutSectionOne />
      {/* <AboutSectionTwo /> */}
      {/* <Testimonials /> */}
      <Pricing />
      {/* <Blog /> */}
      <Contact />
    </>
  );
}
