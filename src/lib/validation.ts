import { z } from "zod";

const phoneDigits = z
  .string()
  .min(8)
  .transform((s) => s.replace(/\D/g, ""))
  .refine((d) => d.length >= 10 && d.length <= 11, "Enter a valid U.S. phone number");

export const leadSchema = z.object({
  // Location (Places + ZIP)
  zipCode: z
    .string()
    .min(5, "Enter a valid ZIP code")
    .max(10)
    .regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code format"),

  formattedAddress: z.string().min(8, "Choose your address from the list"),
  streetAddress: z.string().optional(),
  placeId: z.string().min(10, "Choose your address from the list"),
  latitude: z.number().optional(),
  longitude: z.number().optional(),

  city: z.string().optional(),
  state: z.string().max(2).optional(),

  utilityProvider: z.string().min(2, "Electric utility / provider is required").max(200),

  buildingType: z
    .enum([
      "residential",
      "commercial",
      "government",
      "education",
      "agriculture",
      "industrial",
      "multifamily",
      "mixed_use",
      "other",
    ])
    .optional()
    .default("residential"),
  stories: z.enum(["one", "two_plus"]).optional(),

  // Qualification
  isHomeowner: z.literal(true, { errorMap: () => ({ message: "SolarAdvisor is for property owners only" }) }),
  monthlyBill: z
    .number({ required_error: "Please enter your monthly bill" })
    .min(30, "Monthly bill must be at least $30")
    .max(2000, "Please enter a realistic monthly bill"),
  roofType: z.string().optional(),
  roofSlope: z.enum(["flat", "low", "medium", "steep"]).optional(),
  shadingLevel: z.enum(["none", "light", "moderate", "heavy"]).optional(),
  isDecisionMaker: z.boolean().optional().default(true),

  preferredFinancing: z.enum(["lease", "loan", "cash", "undecided"]).optional(),

  firstName: z.string().min(1, "First name required").max(100),
  lastName: z.string().min(1, "Last name required").max(100),
  email: z.string().email("Invalid email address"),
  phone: phoneDigits,
  contactPreference: z.enum(["sms", "call", "email"]).default("call"),
  consentGiven: z.boolean().refine((v) => v === true, "Consent required to proceed"),

  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
});

export type LeadFormData = z.infer<typeof leadSchema>;

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const leadUpdateSchema = z.object({
  status: z
    .enum(["new", "contacted", "appointment_set", "quoted", "converted", "lost", "sold"])
    .optional(),
  assignedTo: z.string().optional(),
  notes: z.string().optional(),
  appointmentAt: z.string().optional(),
  soldPrice: z.number().optional(),
  soldTo: z.string().optional(),
  commissionEarned: z.number().optional(),
});
