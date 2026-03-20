import {
  mysqlTable,
  varchar,
  int,
  text,
  boolean,
  timestamp,
  decimal,
  json,
  index,
  mysqlEnum,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

// ─── Leads ────────────────────────────────────────────────────────────────────
export const leads = mysqlTable(
  "leads",
  {
    id: int("id").autoincrement().primaryKey(),
    // Contact
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    contactPreference: mysqlEnum("contact_preference", ["sms", "call", "email"]).default("call"),

    // Location & Qualification
    zipCode: varchar("zip_code", { length: 10 }).notNull(),
    state: varchar("state", { length: 2 }),
    city: varchar("city", { length: 100 }),
    isHomeowner: boolean("is_homeowner").notNull(),
    monthlyBill: int("monthly_bill").notNull(), // in dollars
    roofType: varchar("roof_type", { length: 50 }),
    roofSlope: mysqlEnum("roof_slope", ["flat", "low", "medium", "steep"]),
    shadingLevel: mysqlEnum("shading_level", ["none", "light", "moderate", "heavy"]),
    isDecisionMaker: boolean("is_decision_maker").default(true),

    // Estimate
    estimatedSystemKw: decimal("estimated_system_kw", { precision: 5, scale: 2 }),
    estimatedPanels: int("estimated_panels"),
    estimatedMonthlySavings: int("estimated_monthly_savings"), // dollars
    estimatedAnnualSavings: int("estimated_annual_savings"), // dollars
    estimatedRoi: decimal("estimated_roi", { precision: 5, scale: 2 }), // years
    preferredFinancing: mysqlEnum("preferred_financing", ["lease", "loan", "cash", "undecided"]),

    // Lead Scoring
    score: int("score").notNull().default(0),
    tier: mysqlEnum("tier", ["hot", "medium", "cold"]).notNull().default("cold"),

    // Status & Routing
    status: mysqlEnum("status", [
      "new",
      "contacted",
      "appointment_set",
      "quoted",
      "converted",
      "lost",
      "sold",
    ]).default("new"),
    assignedTo: varchar("assigned_to", { length: 100 }),
    appointmentAt: timestamp("appointment_at"),
    notes: text("notes"),

    // Monetization
    soldAt: timestamp("sold_at"),
    soldPrice: int("sold_price"), // cents
    soldTo: varchar("sold_to", { length: 255 }),
    commissionEarned: int("commission_earned"), // cents

    // Tracking
    utmSource: varchar("utm_source", { length: 100 }),
    utmMedium: varchar("utm_medium", { length: 100 }),
    utmCampaign: varchar("utm_campaign", { length: 100 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    referrer: text("referrer"),

    // Consent
    consentGiven: boolean("consent_given").default(true),
    consentText: text("consent_text"),

    // Webhooks
    webhookSent: boolean("webhook_sent").default(false),
    webhookSentAt: timestamp("webhook_sent_at"),
    webhookResponse: text("webhook_response"),

    createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
  },
  (table) => ({
    emailIdx: index("email_idx").on(table.email),
    zipIdx: index("zip_idx").on(table.zipCode),
    tierIdx: index("tier_idx").on(table.tier),
    statusIdx: index("status_idx").on(table.status),
    createdIdx: index("created_idx").on(table.createdAt),
  })
);

// ─── Lead Activity Log ────────────────────────────────────────────────────────
export const leadActivity = mysqlTable("lead_activity", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("lead_id").notNull(),
  type: mysqlEnum("type", [
    "created",
    "status_changed",
    "sms_sent",
    "email_sent",
    "call_made",
    "appointment_set",
    "note_added",
    "webhook_sent",
    "sold",
  ]).notNull(),
  description: text("description"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// ─── SMS / Email Drip Sequences ───────────────────────────────────────────────
export const dripMessages = mysqlTable("drip_messages", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("lead_id").notNull(),
  channel: mysqlEnum("channel", ["sms", "email"]).notNull(),
  sequenceStep: int("sequence_step").notNull().default(1),
  scheduledAt: timestamp("scheduled_at").notNull(),
  sentAt: timestamp("sent_at"),
  status: mysqlEnum("status", ["pending", "sent", "failed", "skipped"]).default("pending"),
  content: text("content"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// ─── Admin Users ──────────────────────────────────────────────────────────────
export const adminUsers = mysqlTable("admin_users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 100 }),
  role: mysqlEnum("role", ["superadmin", "admin", "viewer"]).default("viewer"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// ─── State Incentives ─────────────────────────────────────────────────────────
export const stateIncentives = mysqlTable("state_incentives", {
  id: int("id").autoincrement().primaryKey(),
  state: varchar("state", { length: 2 }).notNull().unique(),
  stateName: varchar("state_name", { length: 50 }),
  netMeteringAvailable: boolean("net_metering_available").default(true),
  stateRebate: int("state_rebate").default(0), // dollars
  srecAvailable: boolean("srec_available").default(false),
  additionalIncentives: text("additional_incentives"),
  avgElectricityCost: decimal("avg_electricity_cost", { precision: 5, scale: 4 }), // per kWh
  avgSunHours: decimal("avg_sun_hours", { precision: 4, scale: 2 }), // per day
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// ─── Zip Code Cache ───────────────────────────────────────────────────────────
export const zipCache = mysqlTable("zip_cache", {
  id: int("id").autoincrement().primaryKey(),
  zipCode: varchar("zip_code", { length: 10 }).notNull().unique(),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  lat: decimal("lat", { precision: 10, scale: 7 }),
  lng: decimal("lng", { precision: 10, scale: 7 }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// ─── Types ────────────────────────────────────────────────────────────────────
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type LeadActivity = typeof leadActivity.$inferSelect;
export type DripMessage = typeof dripMessages.$inferSelect;
export type AdminUser = typeof adminUsers.$inferSelect;
export type StateIncentive = typeof stateIncentives.$inferSelect;
