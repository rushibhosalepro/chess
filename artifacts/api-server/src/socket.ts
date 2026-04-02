import { WebSocketServer, WebSocket } from "ws";
import type { Server as HTTPServer } from "http";
import type { IncomingMessage } from "http";
import { db, gamesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Chess } from "chess.js";
import { randomUUID } from "crypto";
import { logger } from "./lib/logger";

type ClientMessage =
  | { type: "find-match"; playerId: string; playerName: string }
  | { type: "cancel-match"; playerId: string }
  | { type: "join-room"; gameId: string; playerId: string }
  | {
      type: "make-move";
      gameId: string;
      playerId: string;
      from: string;
      to: string;
      promotion?: string;
    }
  | { type: "resign"; gameId: string; playerId: string }
  | { type: "timeout"; gameId: string; playerId: string };

interface PendingPlayer {
  ws: WebSocket;
  playerId: string;
  playerName: string;
  gameId: string;
}

// In-memory matchmaking queue — one pending player at a time
let pendingPlayer: PendingPlayer | null = null;

// Map of gameId -> set of WebSocket clients in that room
const rooms = new Map<string, Set<WebSocket>>();

function sendTo(ws: WebSocket, data: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcastToRoom(gameId: string, data: unknown) {
  const clients = rooms.get(gameId);
  if (!clients) return;
  const payload = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

const INITIAL_TIME_MS = 10 * 60 * 1000; // 10 minutes

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

export function setupWebSocket(httpServer: HTTPServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request: IncomingMessage, socket, head) => {
    const pathname = new URL(request.url!, `http://${request.headers.host}`)
      .pathname;
    console.log(pathname);
    if (pathname === "/api/ws") {
      console.log("yser connted");
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (ws: WebSocket) => {
    logger.info("WebSocket client connected");
    let joinedRooms: string[] = [];
    let myPlayerId: string | null = null;

    ws.on("message", async (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        sendTo(ws, { type: "error", message: "Invalid JSON" });
        return;
      }

      try {
        // ── MATCHMAKING ──────────────────────────────────────────────
        if (msg.type === "find-match") {
          const { playerId, playerName } = msg;
          myPlayerId = playerId;

          // If the pending slot is taken but that WS is dead, clear it
          if (pendingPlayer && pendingPlayer.ws.readyState !== WebSocket.OPEN) {
            pendingPlayer = null;
          }

          // Same player clicking again — already waiting
          if (pendingPlayer && pendingPlayer.playerId === playerId) {
            sendTo(ws, { type: "waiting" });
            return;
          }

          if (!pendingPlayer) {
            // First player — create a game and wait
            const gameId = randomUUID().slice(0, 8).toUpperCase();
            const [game] = await db
              .insert(gamesTable)
              .values({
                id: gameId,
                whitePlayerId: playerId,
                whitePlayerName: playerName,
                status: "waiting",
                fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                pgn: "",
                moves: [],
              })
              .returning();

            pendingPlayer = { ws, playerId, playerName, gameId };

            // Add to room so we can broadcast when second player joins
            rooms.set(gameId, new Set([ws]));
            joinedRooms.push(gameId);

            sendTo(ws, { type: "waiting", gameId });
            logger.info(
              { gameId, playerId },
              "Player queued, waiting for opponent",
            );
          } else {
            // Second player — match found! Join the pending game
            const {
              gameId,
              ws: whiteWs,
              playerId: whitePlayerId,
            } = pendingPlayer;
            pendingPlayer = null;

            const [updated] = await db
              .update(gamesTable)
              .set({
                blackPlayerId: playerId,
                blackPlayerName: playerName,
                status: "active",
                updatedAt: new Date(),
              })
              .where(eq(gamesTable.id, gameId))
              .returning();

            // Add black player's WS to the room
            if (!rooms.has(gameId)) rooms.set(gameId, new Set());
            rooms.get(gameId)!.add(ws);
            joinedRooms.push(gameId);

            const formattedGame = formatGame(updated);

            sendTo(whiteWs, {
              type: "game-started",
              game: formattedGame,
              yourColor: "white",
            });
            sendTo(ws, {
              type: "game-started",
              game: formattedGame,
              yourColor: "black",
            });
            logger.info(
              { gameId, whitePlayerId, blackPlayerId: playerId },
              "Match found! Game started",
            );
          }
        } else if (msg.type === "cancel-match") {
          if (pendingPlayer && pendingPlayer.playerId === msg.playerId) {
            // Delete the waiting game from DB
            await db
              .delete(gamesTable)
              .where(eq(gamesTable.id, pendingPlayer.gameId));
            rooms.delete(pendingPlayer.gameId);
            pendingPlayer = null;
          }
          sendTo(ws, { type: "match-cancelled" });

          // ── IN-GAME ──────────────────────────────────────────────────
        } else if (msg.type === "join-room") {
          const { gameId, playerId } = msg;
          const [game] = await db
            .select()
            .from(gamesTable)
            .where(eq(gamesTable.id, gameId));

          if (!game) {
            sendTo(ws, { type: "error", message: "Game not found" });
            return;
          }

          if (!rooms.has(gameId)) rooms.set(gameId, new Set());
          rooms.get(gameId)!.add(ws);
          joinedRooms.push(gameId);

          sendTo(ws, { type: "game-updated", game: formatGame(game) });
          logger.info({ gameId, playerId }, "Player joined room");
        } else if (msg.type === "make-move") {
          const { gameId, playerId, from, to, promotion } = msg;
          const [game] = await db
            .select()
            .from(gamesTable)
            .where(eq(gamesTable.id, gameId));

          if (!game) {
            sendTo(ws, { type: "error", message: "Game not found" });
            return;
          }
          if (game.status !== "active") {
            sendTo(ws, { type: "error", message: "Game is not active" });
            return;
          }

          const chess = new Chess(game.fen);
          const isWhiteTurn = chess.turn() === "w";
          const isWhitePlayer = game.whitePlayerId === playerId;
          const isBlackPlayer = game.blackPlayerId === playerId;

          if (isWhiteTurn && !isWhitePlayer) {
            sendTo(ws, { type: "error", message: "It's not your turn" });
            return;
          }
          if (!isWhiteTurn && !isBlackPlayer) {
            sendTo(ws, { type: "error", message: "It's not your turn" });
            return;
          }

          // ── Time tracking ───────────────────────────────────────────
          const now = new Date();
          let whiteTimeMs = game.whiteTimeMs;
          let blackTimeMs = game.blackTimeMs;

          if (game.lastMoveAt && game.moves.length > 0) {
            const elapsed = now.getTime() - game.lastMoveAt.getTime();
            if (isWhiteTurn) {
              whiteTimeMs = Math.max(0, whiteTimeMs - elapsed);
            } else {
              blackTimeMs = Math.max(0, blackTimeMs - elapsed);
            }
          }

          // Check if the player timed out before their move arrived
          if (isWhiteTurn && whiteTimeMs <= 0) {
            const [updated] = await db
              .update(gamesTable)
              .set({
                status: "finished",
                winner: "black",
                whiteTimeMs: 0,
                updatedAt: now,
              })
              .where(eq(gamesTable.id, gameId))
              .returning();
            broadcastToRoom(gameId, {
              type: "game-updated",
              game: formatGame(updated),
            });
            return;
          }
          if (!isWhiteTurn && blackTimeMs <= 0) {
            const [updated] = await db
              .update(gamesTable)
              .set({
                status: "finished",
                winner: "white",
                blackTimeMs: 0,
                updatedAt: now,
              })
              .where(eq(gamesTable.id, gameId))
              .returning();
            broadcastToRoom(gameId, {
              type: "game-updated",
              game: formatGame(updated),
            });
            return;
          }
          // ────────────────────────────────────────────────────────────

          const move = chess.move({ from, to, promotion: promotion || "q" });
          if (!move) {
            sendTo(ws, { type: "error", message: "Invalid move" });
            return;
          }

          const newMoves = [...(game.moves as string[]), move.san];
          let newStatus: "waiting" | "active" | "finished" = "active";
          let winner: "white" | "black" | "draw" | null = null;

          if (chess.isCheckmate()) {
            newStatus = "finished";
            winner = chess.turn() === "w" ? "black" : "white";
          } else if (
            chess.isDraw() ||
            chess.isStalemate() ||
            chess.isThreefoldRepetition()
          ) {
            newStatus = "finished";
            winner = "draw";
          }

          const [updated] = await db
            .update(gamesTable)
            .set({
              fen: chess.fen(),
              pgn: chess.pgn(),
              moves: newMoves,
              status: newStatus,
              winner: winner ?? undefined,
              whiteTimeMs,
              blackTimeMs,
              lastMoveAt: now,
              updatedAt: now,
            })
            .where(eq(gamesTable.id, gameId))
            .returning();

          broadcastToRoom(gameId, {
            type: "game-updated",
            game: formatGame(updated),
          });
        } else if (msg.type === "timeout") {
          const { gameId, playerId } = msg;
          const [game] = await db
            .select()
            .from(gamesTable)
            .where(eq(gamesTable.id, gameId));

          if (!game) {
            sendTo(ws, { type: "error", message: "Game not found" });
            return;
          }
          if (game.status !== "active") return; // already ended

          // Validate server-side that the player really did run out of time
          const now = new Date();
          const isWhitePlayer = game.whitePlayerId === playerId;
          const isBlackPlayer = game.blackPlayerId === playerId;

          if (!isWhitePlayer && !isBlackPlayer) return;

          const chess = new Chess(game.fen);
          const isWhiteTurn = chess.turn() === "w";
          const isTheirTurn =
            (isWhitePlayer && isWhiteTurn) || (isBlackPlayer && !isWhiteTurn);

          if (!isTheirTurn) return; // only the player whose turn it is can time out

          let timeLeft = isWhitePlayer ? game.whiteTimeMs : game.blackTimeMs;
          if (game.lastMoveAt && game.moves.length > 0) {
            timeLeft -= now.getTime() - game.lastMoveAt.getTime();
          }

          if (timeLeft > 2000) {
            // More than 2s remaining — client is lying, ignore
            return;
          }

          const winner: "white" | "black" = isWhitePlayer ? "black" : "white";
          const newTimeMs = isWhitePlayer
            ? { whiteTimeMs: 0 }
            : { blackTimeMs: 0 };

          const [updated] = await db
            .update(gamesTable)
            .set({ status: "finished", winner, ...newTimeMs, updatedAt: now })
            .where(eq(gamesTable.id, gameId))
            .returning();

          broadcastToRoom(gameId, {
            type: "game-updated",
            game: formatGame(updated),
          });
          logger.info({ gameId, playerId, winner }, "Player timed out");
        } else if (msg.type === "resign") {
          const { gameId, playerId } = msg;
          const [game] = await db
            .select()
            .from(gamesTable)
            .where(eq(gamesTable.id, gameId));

          if (!game) {
            sendTo(ws, { type: "error", message: "Game not found" });
            return;
          }
          if (game.status !== "active") {
            sendTo(ws, { type: "error", message: "Game is not active" });
            return;
          }

          const winner: "white" | "black" =
            game.whitePlayerId === playerId ? "black" : "white";

          const [updated] = await db
            .update(gamesTable)
            .set({ status: "finished", winner, updatedAt: new Date() })
            .where(eq(gamesTable.id, gameId))
            .returning();

          broadcastToRoom(gameId, {
            type: "game-updated",
            game: formatGame(updated),
          });
        }
      } catch (err) {
        logger.error({ err }, "WebSocket message error");
        sendTo(ws, { type: "error", message: "Internal server error" });
      }
    });

    ws.on("close", () => {
      // If this player was the pending one, clear them
      if (
        pendingPlayer &&
        (pendingPlayer.ws === ws ||
          (myPlayerId && pendingPlayer.playerId === myPlayerId))
      ) {
        db.delete(gamesTable)
          .where(eq(gamesTable.id, pendingPlayer.gameId))
          .catch(() => {});
        rooms.delete(pendingPlayer.gameId);
        pendingPlayer = null;
      }
      for (const gameId of joinedRooms) {
        rooms.get(gameId)?.delete(ws);
        if (rooms.get(gameId)?.size === 0) rooms.delete(gameId);
      }
      logger.info("WebSocket client disconnected");
    });

    ws.on("error", (err) => {
      logger.error({ err }, "WebSocket error");
    });
  });

  return wss;
}
