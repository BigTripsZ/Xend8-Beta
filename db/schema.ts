import {
  mysqlTable,
  serial,
  varchar,
  text,
  timestamp,
  boolean,
  int,
  json,
} from "drizzle-orm/mysql-core";

// SMTP Configuration table
export const smtpConfigs = mysqlTable("smtp_configs", {
  id: serial("id").primaryKey(),
  host: varchar("host", { length: 255 }).notNull(),
  port: int("port").notNull(),
  username: varchar("username", { length: 255 }).notNull(),
  password: varchar("password", { length: 255 }).notNull(),
  secure: boolean("secure").notNull().default(false),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Broadcast messages table
export const broadcastMessages = mysqlTable("broadcast_messages", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  buttonText: varchar("button_text", { length: 255 }),
  buttonLink: varchar("button_link", { length: 500 }),
  sentBy: varchar("sent_by", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Email logs table
export const emailLogs = mysqlTable("email_logs", {
  id: serial("id").primaryKey(),
  recipient: varchar("recipient", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 500 }),
  senderName: varchar("sender_name", { length: 255 }),
  status: varchar("status", { length: 50 }).notNull(),
  messageId: varchar("message_id", { length: 255 }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Checker results table
export const checkerResults = mysqlTable("checker_results", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  password: varchar("password", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  name: varchar("name", { length: 255 }),
  country: varchar("country", { length: 255 }),
  linkedServices: text("linked_services"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Bot sessions table (for persistent storage)
export const botSessions = mysqlTable("bot_sessions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 50 }).notNull().unique(),
  firstName: varchar("first_name", { length: 255 }),
  isValid: boolean("is_valid").notNull().default(false),
  smtpConfig: json("smtp_config"),
  sessionData: json("session_data"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
