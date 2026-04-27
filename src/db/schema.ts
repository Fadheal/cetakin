import { pgTable, text, timestamp, uuid, integer } from 'drizzle-orm/pg-core';

export const admins = pgTable('admins', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  submissionId: text('submission_id').unique(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  address: text('address').notNull(),
  deliveryTime: text('delivery_time').notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const printSettings = pgTable('print_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
  mode: text('mode').notNull(),
  color: text('color').notNull(),
  sidedness: text('sidedness').notNull(),
  copies: integer('copies').notNull().default(1),
  quality: text('quality'),
  paperType: text('paper_type'),
  paperWeight: text('paper_weight'),
  cutting: text('cutting'),
  layout: text('layout'),
  binding: text('binding'),
  notes: text('notes'),
});

export const orderFiles = pgTable('order_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  pages: integer('pages').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
