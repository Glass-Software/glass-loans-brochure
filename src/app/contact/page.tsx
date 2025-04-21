import Breadcrumb from "@/components/Common/Breadcrumb";
import Contact from "@/components/Contact";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Page | Glass Loan Management Software",
  description: "Simple, easy to use loan management software",
};

const ContactPage = () => {
  return (
    <>
      <Breadcrumb
        pageName="Contact Page"
        description="For general inquiries, please fill out the form below. For support or to schedule a demo, please call us at (469) 371-2202."
      />

      <Contact />
    </>
  );
};

export default ContactPage;
