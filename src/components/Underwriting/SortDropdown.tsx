"use client";

export type SortOption =
  | "distance"
  | "price-high"
  | "price-low"
  | "sqft-high"
  | "sqft-low"
  | "year-new"
  | "year-old"
  | "psf-high"
  | "psf-low";

interface SortDropdownProps {
  value: SortOption;
  onChange: (option: SortOption) => void;
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "distance", label: "Distance (closest)" },
  { value: "price-high", label: "Price (highest)" },
  { value: "price-low", label: "Price (lowest)" },
  { value: "sqft-high", label: "Sqft (highest)" },
  { value: "sqft-low", label: "Sqft (lowest)" },
  { value: "year-new", label: "Year (newest)" },
  { value: "year-old", label: "Year (oldest)" },
  { value: "psf-high", label: "$/sqft (highest)" },
  { value: "psf-low", label: "$/sqft (lowest)" },
];

export default function SortDropdown({ value, onChange }: SortDropdownProps) {
  return (
    <select
      id="comp-sort"
      value={value}
      onChange={(e) => onChange(e.target.value as SortOption)}
      className="w-full rounded-sm border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-stroke-dark dark:bg-gray-dark dark:text-white dark:focus:border-primary"
    >
      {sortOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
