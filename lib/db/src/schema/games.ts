import { pgTable, text, timestamp, json, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gamesTable = pgTable("games", {
  id: text("id").primaryKey(),
  status: text("status", { enum: ["waiting", "active", "finished"] }).notNull().default("waiting"),
  whitePlayerId: text("white_player_id").notNull(),
  whitePlayerName: text("white_player_name").notNull(),
  blackPlayerId: text("black_player_id"),
  blackPlayerName: text("black_player_name"),
  fen: text("fen").notNull().default("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
  pgn: text("pgn").notNull().default(""),
  winner: text("winner", { enum: ["white", "black", "draw"] }),
  moves: json("moves").$type<string[]>().notNull().default([]),
  whiteTimeMs: integer("white_time_ms").notNull().default(600000),
  blackTimeMs: integer("black_time_ms").notNull().default(600000),
  lastMoveAt: timestamp("last_move_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertGameSchema = createInsertSchema(gamesTable).omit({ createdAt: true, updatedAt: true });
export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof gamesTable.$inferSelect;
