import { z } from "zod";

// Property Condition enum
export const PropertyConditionSchema = z.enum(["Good", "Bad", "Really Bad"], {
  errorMap: () => ({ message: "Please select a valid property condition" }),
});

// Renovation Level (now calculated as number, not enum)
export const RenovationLevelSchema = z
  .number()
  .min(0, "Renovation per square foot cannot be negative");

// Market Type enum
export const MarketTypeSchema = z.enum(["Urban", "Suburban", "Rural"], {
  errorMap: () => ({ message: "Please select a valid market type" }),
});

// Property Type enum
export const PropertyTypeSchema = z.enum(
  ["Single Family", "Condo", "Townhouse", "Multi-Family"],
  {
    errorMap: () => ({ message: "Please select a valid property type" }),
  },
);

// Step 1: Property Details Schema
export const Step1Schema = z.object({
  propertyAddress: z
    .string()
    .min(5, "Property address must be at least 5 characters")
    .max(500, "Property address is too long"),
  propertyCity: z
    .string()
    .min(2, "City is required")
    .max(100, "City name is too long"),
  propertyState: z
    .string()
    .length(2, "State must be 2 letters (e.g., TX, CA)")
    .regex(/^[A-Z]{2}$/, "State must be 2 uppercase letters"),
  propertyZip: z
    .string()
    .min(5, "ZIP code must be at least 5 digits")
    .max(10, "ZIP code is too long")
    .regex(/^\d{5}(-\d{4})?$/, "ZIP code must be in format 12345 or 12345-6789"),
  purchasePrice: z
    .number()
    .min(1000, "Purchase price must be at least $1,000")
    .max(100000000, "Purchase price must be less than $100M"),
  rehab: z
    .number()
    .min(0, "Rehab cannot be negative")
    .max(10000000, "Rehab must be less than $10M"),
  squareFeet: z
    .number()
    .min(100, "Square feet must be at least 100")
    .max(50000, "Square feet must be less than 50,000"),
  bedrooms: z
    .number()
    .int("Bedrooms must be a whole number")
    .min(1, "At least 1 bedroom required")
    .max(10, "Bedrooms must be less than 10"),
  bathrooms: z
    .number()
    .min(1, "At least 1 bathroom required")
    .max(8, "Bathrooms must be less than 8"),
  yearBuilt: z
    .number()
    .int("Year built must be a whole number")
    .min(1800, "Year built must be after 1800")
    .max(
      new Date().getFullYear(),
      `Year built cannot be in the future`,
    ),
  propertyType: PropertyTypeSchema,
});

// Step 2: Property Condition Schema
export const Step2Schema = z.object({
  propertyCondition: PropertyConditionSchema,
  renovationPerSf: RenovationLevelSchema,
});

// Step 3: Loan Terms Schema
export const Step3Schema = z.object({
  interestRate: z
    .number()
    .min(0.1, "Interest rate must be at least 0.1%")
    .max(50, "Interest rate must be less than 50%"),
  months: z
    .number()
    .int("Months must be a whole number")
    .min(1, "Loan term must be at least 1 month")
    .max(360, "Loan term must be less than 360 months (30 years)"),
  loanAtPurchase: z
    .number()
    .min(1000, "Loan amount must be at least $1,000")
    .max(100000000, "Loan amount must be less than $100M"),
  renovationFunds: z
    .number()
    .min(0, "Renovation funds cannot be negative")
    .max(10000000, "Renovation funds must be less than $10M")
    .default(0),
  closingCostsPercent: z
    .number()
    .min(0, "Closing costs percentage cannot be negative")
    .max(20, "Closing costs percentage must be less than 20%"),
  points: z
    .number()
    .min(0, "Points cannot be negative")
    .max(10, "Points must be less than 10%"),
});

// Step 4: Market Details Schema
export const Step4Schema = z.object({
  marketType: MarketTypeSchema,
  additionalDetails: z.string().max(2000, "Details are too long").optional(),
});

// Complete form validation schema
export const UnderwritingFormSchema = z
  .object({
    propertyAddress: z
      .string()
      .min(5, "Property address must be at least 5 characters"),
    purchasePrice: z.number().min(1000, "Purchase price must be at least $1,000"),
    rehab: z.number().min(0, "Rehab cannot be negative"),
    squareFeet: z.number().min(100, "Square feet must be at least 100"),
    bedrooms: z.number().int().min(1, "At least 1 bedroom required"),
    bathrooms: z.number().min(1, "At least 1 bathroom required"),
    yearBuilt: z.number().int().min(1800, "Year built must be after 1800"),
    propertyType: PropertyTypeSchema,
    propertyCondition: PropertyConditionSchema,
    renovationPerSf: RenovationLevelSchema,
    userEstimatedAsIsValue: z
      .number()
      .min(1000, "As-is value must be at least $1,000")
      .max(100000000, "As-is value must be less than $100M")
      .optional(), // DEPRECATED: legacy field for backward compatibility
    userEstimatedArv: z
      .number()
      .min(1000, "ARV must be at least $1,000")
      .max(100000000, "ARV must be less than $100M")
      .optional(), // DEPRECATED: legacy field for backward compatibility
    interestRate: z.number().min(0.1, "Interest rate must be at least 0.1%"),
    months: z.number().int().min(1, "Loan term must be at least 1 month"),
    loanAtPurchase: z.number().min(1000, "Loan amount must be at least $1,000"),
    renovationFunds: z.number().min(0).default(0),
    closingCostsPercent: z.number().min(0, "Closing costs cannot be negative"),
    points: z.number().min(0, "Points cannot be negative"),
    marketType: MarketTypeSchema,
    additionalDetails: z.string().max(2000).optional(),
  })
  .refine(
    (data) => data.loanAtPurchase <= data.purchasePrice * 1.5,
    {
      message: "Loan amount seems unusually high compared to purchase price",
      path: ["loanAtPurchase"],
    },
  )
  .refine(
    (data) => data.rehab <= data.purchasePrice * 3,
    {
      message: "Rehab cost seems unusually high compared to purchase price",
      path: ["rehab"],
    },
  );

// Email validation schema
export const EmailSchema = z
  .string()
  .email("Please enter a valid email address")
  .min(5, "Email is too short")
  .max(255, "Email is too long");

/**
 * Validate a single step of the form
 */
export function validateStep(
  step: number,
  data: any,
): { valid: boolean; errors: Record<string, string> } {
  let schema;

  switch (step) {
    case 1:
      schema = Step1Schema;
      break;
    case 2:
      schema = Step2Schema;
      break;
    case 3:
      schema = Step3Schema;
      break;
    case 4:
      schema = Step4Schema;
      break;
    default:
      return { valid: false, errors: { _form: "Invalid step" } };
  }

  try {
    schema.parse(data);
    return { valid: true, errors: {} };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      error.errors.forEach((err) => {
        const field = err.path.join(".");
        errors[field] = err.message;
      });
      return { valid: false, errors };
    }
    return { valid: false, errors: { _form: "Validation error" } };
  }
}

/**
 * Validate the complete form
 */
export function validateCompleteForm(data: any): {
  valid: boolean;
  errors: Record<string, string>;
} {
  try {
    UnderwritingFormSchema.parse(data);
    return { valid: true, errors: {} };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      error.errors.forEach((err) => {
        const field = err.path.join(".");
        errors[field] = err.message;
      });
      return { valid: false, errors };
    }
    return { valid: false, errors: { _form: "Validation error" } };
  }
}
