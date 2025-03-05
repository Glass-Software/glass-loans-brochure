import AboutSectionOne from "@/components/About/AboutSectionOne";
import AboutSectionTwo from "@/components/About/AboutSectionTwo";
import Breadcrumb from "@/components/Common/Breadcrumb";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Page | Free Next.js Template for Startup and SaaS",
  description: "This is About Page for Startup Nextjs Template",
  // other metadata
};

const AboutPage = () => {
  return (
    <>
      <Breadcrumb
        pageName="About Us"
        description="After years of running a private lending business, we found existing loan management software to 
        be inefficient and lacking the features we needed. 
        So, we built our own—designed for lenders, by lenders. Now, we're offering that same powerful solution to you."
      />
      {/* <AboutSectionOne /> */}
      <AboutSectionTwo />
    </>
  );
};

export default AboutPage;
