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
        {opinion.split("\n\n").map((paragraph, index) => (
          <p
            key={index}
            className="mb-4 text-base leading-relaxed text-body-color last:mb-0"
          >
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  );
}
