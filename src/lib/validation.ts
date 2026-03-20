import { z } from "zod";

export const leadSchema = z.object({
  // Step 1 - ZIP
  zipCode: z
    .string()
    .min(5, "Enter a valid ZIP code")
    .max(10)
    .regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code format"),

  // Step 2 - Qualification
  isHomeowner: z.boolean({ required_error: "Please indicate if you own your home" }),
  monthlyBill: z
    .number({ required_error: "Please enter your monthly bill" })
    .min(30, "Monthly bill must be at least $30")
    .max(2000, "Please enter a realistic monthly bill"),
  roofType: z.string().optional(),
  roofSlope: z.enum(["flat", "low", "medium", "steep"]).optional(),
  shadingLevel: z.enum(["none", "light", "moderate", "heavy"]).optional(),
  isDecisionMaker: z.boolean().optional().default(true),

  // Step 3 - Financing preference
  preferredFinancing: z.enum(["lease", "loan", "cash", "undecided"]).optional(),

  // Step 4 - Contact
  firstName: z.string().min(1, "First name required").max(100),
  lastName: z.string().min(1, "Last name required").max(100),
  email: z.string().email("Invalid email address"),
  phone: z
    .string()
    .min(10, "Enter a valid phone number")
    .regex(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/, "Invalid phone number"),
  contactPreference: z.enum(["sms", "call", "email"]).default("call"),
  consentGiven: z.boolean().refine((v) => v === true, "Consent required to proceed"),

  // Tracking (optional, set server-side)
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
