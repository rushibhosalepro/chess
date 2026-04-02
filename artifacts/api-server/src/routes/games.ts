import { Router, type IRouter } from "express";
import { db, gamesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

const router: IRouter = Router();

router.get("/games", async (req, res) => {
  try {
    const games = await db
      .select()
      .from(gamesTable)
      .where(eq(gamesTable.status, "waiting"))
      .orderBy(desc(gamesTable.createdAt))
      .limit(20);

    const summaries = games.map((g) => ({
      id: g.id,
      status: g.status,
      whitePlayerName: g.whitePlayerName,
      blackPlayerName: g.blackPlayerName,
      createdAt: g.createdAt.toISOString(),
    }));

    res.json(summaries);
  } catch (err) {
    req.log.error({ err }, "Failed to list games");
    res.status(500).json({ error: "Failed to list games" });
  }
});

router.post("/games", async (req, res) => {
  try {
    const { playerName } = req.body as { playerName: string };
    if (!playerName) {
      res.status(400).json({ error: "playerName is required" });
      return;
    }

    const whitePlayerId = randomUUID();
    const gameId = randomUUID().slice(0, 8).toUpperCase();

    const [game] = await db
      .insert(gamesTable)
      .values({
        id: gameId,
        whitePlayerId,
        whitePlayerName: playerName,
        status: "waiting",
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        pgn: "",
        moves: [],
      })
      .returning();

    res.status(201).json(formatGame(game));
  } catch (err) {
    req.log.error({ err }, "Failed to create game");
    res.status(500).json({ error: "Failed to create game" });
  }
});

router.get("/games/:gameId", async (req, res) => {
  try {
    const { gameId } = req.params;
    const [game] = await db
      .select()
      .from(gamesTable)
      .where(eq(gamesTable.id, gameId));

    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    res.json(formatGame(game));
  } catch (err) {
    req.log.error({ err }, "Failed to get game");
    res.status(500).json({ error: "Failed to get game" });
  }
});

router.post("/games/:gameId/join", async (req, res) => {
  try {
    const { gameId } = req.params;
    const { playerName } = req.body as { playerName: string };

    if (!playerName) {
      res.status(400).json({ error: "playerName is required" });
      return;
    }

    const [game] = await db
      .select()
      .from(gamesTable)
      .where(eq(gamesTable.id, gameId));

    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    if (game.status !== "waiting") {
      res.status(400).json({ error: "Game is not available to join" });
      return;
    }

    const blackPlayerId = randomUUID();
    const [updated] = await db
      .update(gamesTable)
      .set({
        blackPlayerId,
        blackPlayerName: playerName,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(gamesTable.id, gameId))
      .returning();

    res.json(formatGame(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to join game");
    res.status(500).json({ error: "Failed to join game" });
  }
});

function formatGame(game: typeof gamesTable.$inferSelect) {
  return {
    id: game.id,
    status: game.status,
    whitePlayerId: game.whitePlayerId,
    whitePlayerName: game.whitePlayerName,
    blackPlayerId: game.blackPlayerId,
    blackPlayerName: game.blackPlayerName,
    fen: game.fen,
    pgn: game.pgn,
    winner: game.winner,
    moves: game.moves,
    whiteTimeMs: game.whiteTimeMs,
    blackTimeMs: game.blackTimeMs,
    lastMoveAt: game.lastMoveAt ? game.lastMoveAt.toISOString() : null,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
  };
}

export default router;
