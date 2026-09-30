import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import {
  boolean,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const marketplaceRoleEnum = pgEnum("marketplace_role", ["farmer", "buyer"]);
export const marketRequestStatusEnum = pgEnum("market_request_status", [
  "pending",
  "accepted",
  "declined",
]);

export const marketProfilesTable = pgTable("market_profiles", {
  userId: text("user_id").primaryKey(),
  role: marketplaceRoleEnum("role").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  district: text("district"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertMarketProfileSchema = createInsertSchema(marketProfilesTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertMarketProfile = z.infer<typeof insertMarketProfileSchema>;
export type MarketProfile = typeof marketProfilesTable.$inferSelect;

export const productsTable = pgTable("market_products", {
  id: serial("id").primaryKey(),
  farmerId: text("farmer_id")
    .notNull()
    .references(() => marketProfilesTable.userId, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull().default(""),
  pricePerKg: numeric("price_per_kg", { precision: 12, scale: 2, mode: "number" }).notNull(),
  quantityKg: integer("quantity_kg").notNull(),
  district: text("district").notNull(),
  unit: text("unit").notNull().default("kg"),
  imageUrl: text("image_url"),
  available: boolean("available").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type MarketProduct = typeof productsTable.$inferSelect;

export const marketRequestsTable = pgTable("market_requests", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => productsTable.id, { onDelete: "cascade" }),
  buyerId: text("buyer_id")
    .notNull()
    .references(() => marketProfilesTable.userId, { onDelete: "cascade" }),
  farmerId: text("farmer_id")
    .notNull()
    .references(() => marketProfilesTable.userId, { onDelete: "cascade" }),
  quantityKg: integer("quantity_kg").notNull(),
  message: text("message").notNull().default(""),
  status: marketRequestStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertMarketRequestSchema = createInsertSchema(marketRequestsTable).omit({
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMarketRequest = z.infer<typeof insertMarketRequestSchema>;
export type MarketRequestRecord = typeof marketRequestsTable.$inferSelect;