import Image from "next/image";

const AboutSectionTwo = () => {
  return (
    <section className="py-16 md:py-20 lg:py-28">
      <div className="container">
        <div className="-mx-4 flex flex-wrap items-center">
          <div className="w-full px-4 lg:w-1/2">
            <div
              className="relative mx-auto mb-12 aspect-[25/24] max-w-[500px] text-center lg:m-0"
              data-wow-delay=".15s"
            >
              <Image
                src="/images/about/willnew.jpg"
                alt="about image"
                fill
                className="object-cover drop-shadow-three dark:block dark:drop-shadow-none"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-4">
                <span className="text-lg font-bold text-white">
                  Will Coleman
                </span>
                <br />
                {/* light font in italics */}
                <span className="text-base text-white">
                  Chief Operating Officer
                </span>
              </div>
            </div>
          </div>
          <div className="w-full px-4 lg:w-1/2">
            <div className="max-w-[470px]">
              <div className="mb-9">
                <h3 className="mb-4 text-xl font-bold text-black dark:text-white sm:text-2xl lg:text-xl xl:text-2xl">
                  Tyler Hervey | Chief Technology Officer
                </h3>
                <p className="text-base font-medium leading-relaxed text-body-color sm:text-lg sm:leading-relaxed">
                  Tyler Hervey is a technical entrepreneur with an enterprise
                  software background, having built digital platforms and
                  websites for companies including Interpublic Group and Kaseya.
                  After working with large organizations, he sought a more
                  hands-on role helping small and mid-sized businesses solve
                  real operational problems. Tyler focuses on the product
                  development, design, and implementation.
                </p>
              </div>
              <div className="mb-9">
                <h3 className="mb-4 text-xl font-bold text-black dark:text-white sm:text-2xl lg:text-xl xl:text-2xl">
                  Will Coleman | Chief Operating Officer
                </h3>
                <p className="text-base font-medium leading-relaxed text-body-color sm:text-lg sm:leading-relaxed">
                  Will brings over a decade of experience in real estate
                  investing across Texas and Tennessee. He is the founder of
                  UrbanGate Capital, a private real estate debt fund with five
                  years of operating history, specializing in investor capital
                  formation and private lending.
                </p>
                <p className="text-base font-medium leading-relaxed text-body-color sm:text-lg sm:leading-relaxed">
                  His background includes roles as a Credit Analyst at City Bank
                  and Director of Finance at Rand Capital, a commercial mortgage
                  brokerage.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSectionTwo;
