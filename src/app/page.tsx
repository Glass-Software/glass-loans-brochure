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
        url: "/images/logo/glass_logo_2--light.png",
        width: 304,
        height: 92,
        alt: "Glass Loans Logo",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Glass Loan Management Software",
    description: "Simple, easy to use loan management software",
    images: ["/images/logo/glass_logo_2--light.png"],
  },
  // other metadata
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
