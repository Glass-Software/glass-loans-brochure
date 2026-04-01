import Image from "next/image";

const AboutSectionTwo = () => {
  return (
    <section className="py-16 md:py-20 lg:py-28">
      <div className="container">
        <div className="-mx-4 flex flex-wrap items-start">
          {/* Tyler Hervey */}
          <div className="w-full px-4 lg:w-1/2">
            <div className="mb-12 lg:mb-0">
              <div
                className="relative mx-auto mb-8 aspect-[25/24] max-w-[500px] text-center"
                data-wow-delay=".15s"
              >
                <Image
                  src="/images/about/tyler-hervey_headshot-2.jpg"
                  alt="Tyler Hervey headshot"
                  fill
                  className="object-cover drop-shadow-three dark:block dark:drop-shadow-none"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-4">
                  <span className="text-lg font-bold text-white">
                    Tyler Hervey
                  </span>
                  <br />
                  <span className="text-base text-white">
                    Chief Technology Officer
                  </span>
                </div>
              </div>
              <div className="mx-auto max-w-[500px]">
                <p className="text-base font-medium leading-relaxed text-body-color dark:text-body-color-dark sm:text-lg sm:leading-relaxed">
                  Tyler Hervey is a technical entrepreneur with an enterprise
                  software background, having built digital platforms and
                  websites for companies including Interpublic Group and
                  Technology Marketing Toolkit. After working with large
                  organizations, he sought a more hands-on role helping small
                  and mid-sized businesses solve real operational problems.
                  Tyler focuses on the product development, design, and
                  implementation.
                </p>
              </div>
            </div>
          </div>

          {/* Will Coleman */}
          <div className="w-full px-4 lg:w-1/2">
            <div>
              <div
                className="relative mx-auto mb-8 aspect-[25/24] max-w-[500px] text-center"
                data-wow-delay=".15s"
              >
                <Image
                  src="/images/about/Willnew.jpg"
                  alt="Will Coleman headshot"
                  fill
                  className="object-cover drop-shadow-three dark:block dark:drop-shadow-none"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-4">
                  <span className="text-lg font-bold text-white">
                    Will Coleman
                  </span>
                  <br />
                  <span className="text-base text-white">
                    Chief Operating Officer
                  </span>
                </div>
              </div>
              <div className="mx-auto max-w-[500px]">
                <p className="mb-4 text-base font-medium leading-relaxed text-body-color dark:text-body-color-dark sm:text-lg sm:leading-relaxed">
                  Will brings over a decade of experience in real estate
                  investing across Texas and Tennessee. He is the founder of
                  UrbanGate Capital, a private real estate debt fund with five
                  years of operating history, specializing in investor capital
                  formation and private lending.
                </p>
                <p className="text-base font-medium leading-relaxed text-body-color dark:text-body-color-dark sm:text-lg sm:leading-relaxed">
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
