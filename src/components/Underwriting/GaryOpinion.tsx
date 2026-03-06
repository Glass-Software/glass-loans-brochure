"use client";

interface GaryOpinionProps {
  opinion: string;
}

export default function GaryOpinion({ opinion }: GaryOpinionProps) {
  return (
    <div className="rounded-sm bg-white p-8 shadow-three dark:bg-gray-dark">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
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
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-bold text-dark dark:text-white">
            Gary&apos;s Opinion
          </h3>
          <p className="text-sm text-body-color">
            Senior Underwriter, Glass Loans
          </p>
        </div>
      </div>

      <div className="prose prose-sm max-w-none dark:prose-invert">
        {(() => {
          // Split by markdown headers (## ) to properly separate sections
          const parts = opinion.split(/(?=##\s)/g);

          return parts.map((part, index) => {
            const trimmed = part.trim();
            if (!trimmed) return null;

            // Check if this part starts with a markdown header
            if (trimmed.startsWith("## ")) {
              // Extract header and content
              const lines = trimmed.split("\n");
              const headerLine = lines[0];
              const headerText = headerLine.substring(3).trim(); // Remove "## "
              const content = lines.slice(1).join("\n").trim();

              return (
                <div key={index}>
                  <h2 className="mb-3 mt-6 text-lg font-bold text-dark dark:text-white first:mt-0">
                    {headerText}
                  </h2>
                  {content && (
                    <p className="mb-4 text-base leading-relaxed text-dark dark:text-white">
                      {content}
                    </p>
                  )}
                </div>
              );
            }

            // Regular paragraph (no header)
            return (
              <p
                key={index}
                className="mb-4 text-base leading-relaxed text-dark dark:text-white last:mb-0"
              >
                {trimmed}
              </p>
            );
          });
        })()}
      </div>
    </div>
  );
}
