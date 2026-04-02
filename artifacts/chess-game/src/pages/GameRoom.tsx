import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Chess } from "chess.js";
import { useGetGame } from "@workspace/api-client-react";
import { usePlayer } from "@/hooks/use-player";
import { useSocket } from "@/hooks/use-socket";
import { useToast } from "@/hooks/use-toast";
import { ChessBoard } from "@/components/ChessBoard";
import { PlayerInfo } from "@/components/PlayerInfo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, Copy, Flag, Check, Loader2, Trophy } from "lucide-react";
import type { Game } from "@workspace/api-client-react";

export default function GameRoom() {
  const [, params] = useRoute("/game/:id");
  const [, setLocation] = useLocation();
  const gameId = params?.id || "";
  const { toast } = useToast();

  const { playerId } = usePlayer();

  // REST API fetch for initial state
  const { data: initialGame, isLoading, error } = useGetGame(gameId);

  // Local state for real-time updates
  const [game, setGame] = useState<Game | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialGame && !game) {
      setGame(initialGame);
    }
  }, [initialGame]);

  // ── Client-side clock ────────────────────────────────────────────
  const [whiteDisplayMs, setWhiteDisplayMs] = useState<number>(600_000);
  const [blackDisplayMs, setBlackDisplayMs] = useState<number>(600_000);
  const timeoutSentRef = useRef(false);

  // Sync display times from server state
  useEffect(() => {
    if (!game) return;
    setWhiteDisplayMs(game.whiteTimeMs ?? 600_000);
    setBlackDisplayMs(game.blackTimeMs ?? 600_000);
    timeoutSentRef.current = false;
  }, [game?.id, game?.moves?.length]);

  // Tick interval
  const gameRef = useRef<Game | null>(null);
  gameRef.current = game;

  const sendTimeoutRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const g = gameRef.current;
      const moves = g?.moves ?? [];
      if (!g || g.status !== "active" || !g.lastMoveAt || moves.length === 0)
        return;

      const chess = new Chess(g.fen);
      const isWhiteTurn = chess.turn() === "w";
      const elapsed = Date.now() - new Date(g.lastMoveAt).getTime();

      if (isWhiteTurn) {
        const remaining = Math.max(0, (g.whiteTimeMs ?? 0) - elapsed);
        setWhiteDisplayMs(remaining);
        if (remaining === 0 && !timeoutSentRef.current) {
          timeoutSentRef.current = true;
          sendTimeoutRef.current?.();
        }
      } else {
        const remaining = Math.max(0, (g.blackTimeMs ?? 0) - elapsed);
        setBlackDisplayMs(remaining);
        if (remaining === 0 && !timeoutSentRef.current) {
          timeoutSentRef.current = true;
          sendTimeoutRef.current?.();
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Socket connection
  const { isConnected, makeMove, resign, sendTimeout } = useSocket({
    gameId,
    playerId,
    onGameUpdated: (updatedGame) => {
      setGame(updatedGame);
    },
    onError: (err) => {
      toast({
        title: "Action failed",
        description: err,
        variant: "destructive",
      });
    },
  });

  // Keep sendTimeout in a ref so the interval can use it
  sendTimeoutRef.current = sendTimeout;

  const handleCopy = () => {
    navigator.clipboard.writeText(gameId);
    setCopied(true);
    toast({ title: "Copied!", description: "Game code copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMove = (from: string, to: string) => {
    makeMove(from, to);
  };

  if (isLoading || !game) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-primary w-12 h-12 mb-4" />
        <h2 className="text-xl font-display text-muted-foreground">
          Loading match...
        </h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-3xl font-display text-destructive mb-2">
          Game Not Found
        </h2>
        <p className="text-muted-foreground mb-8">
          This match doesn't exist or has expired.
        </p>
        <Button onClick={() => setLocation("/")}>Return Home</Button>
      </div>
    );
  }

  // Determine roles and turn
  const isWhite = game.whitePlayerId === playerId;
  const isBlack = game.blackPlayerId === playerId;
  const isSpectator = !isWhite && !isBlack;

  const playerColor = isWhite ? "white" : isBlack ? "black" : "spectator";

  const chess = new Chess(game.fen);
  const turnColor = chess.turn() === "w" ? "white" : "black";
  const isMyTurn = playerColor === turnColor && game.status === "active";

  // Render variables
  const opponentColor = playerColor === "white" ? "black" : "white";
  const opponentName =
    playerColor === "white" ? game.blackPlayerName : game.whitePlayerName;
  const myName =
    playerColor === "white" ? game.whitePlayerName : game.blackPlayerName;
  const moveHistory = game.moves ?? [];

  // Always show clocks (spectators see white=bottom, black=top)
  const myTimeMs = isBlack ? blackDisplayMs : whiteDisplayMs;
  const opponentTimeMs = isBlack ? whiteDisplayMs : blackDisplayMs;

  return (
    <div className="min-h-screen bg-background flex flex-col pt-6 pb-12 px-4">
      {/* Top Header */}
      <div className="max-w-5xl mx-auto w-full flex items-center justify-between mb-8 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/")}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 w-4 h-4" /> Exit
        </Button>

        <div className="flex items-center gap-3 bg-card border border-border rounded-full py-1.5 px-2 pl-4 shadow-md">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Match
          </span>
          <span className="font-mono text-sm text-primary bg-primary/10 px-3 py-1 rounded-full">
            {gameId}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full ml-1"
            onClick={handleCopy}
          >
            {copied ? (
              <Check size={14} className="text-green-500" />
            ) : (
              <Copy size={14} />
            )}
          </Button>
        </div>

        <div className="w-[88px]" />
      </div>

      {/* Main Game Area */}
      <div className="flex-1 w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Side: Game Status (Desktop) */}
        <div className="hidden lg:flex lg:col-span-3 flex-col h-[600px] justify-between">
          <div className="space-y-6">
            <div>
              <h3 className="font-display text-2xl font-bold text-foreground">
                Status
              </h3>
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary border border-border text-sm">
                <span
                  className={cn(
                    "w-2 h-2 rounded-full",
                    isConnected
                      ? "bg-green-500 shadow-[0_0_10px_#22c55e]"
                      : "bg-red-500",
                  )}
                />
                {isConnected ? "Connected" : "Reconnecting..."}
              </div>
            </div>

            {game.status === "waiting" && (
              <div className="bg-primary/10 border border-primary/30 p-4 rounded-2xl">
                <p className="text-sm text-primary font-medium">
                  Waiting for opponent...
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Share the match code to invite a friend.
                </p>
              </div>
            )}

            {game.status === "finished" && (
              <div className="bg-gradient-to-br from-card to-background border border-primary/50 p-6 rounded-3xl shadow-xl text-center">
                <Trophy className="w-12 h-12 text-primary mx-auto mb-3" />
                <h3 className="font-display text-xl font-bold mb-1">
                  Match Over
                </h3>
                <p className="text-muted-foreground">
                  {game.winner === "draw"
                    ? "It's a draw!"
                    : `${game.winner === "white" ? game.whitePlayerName : game.blackPlayerName} wins!`}
                </p>
              </div>
            )}
          </div>

          {!isSpectator && game.status === "active" && (
            <Button
              variant="outline"
              className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
              onClick={resign}
            >
              <Flag className="w-4 h-4 mr-2" /> Resign
            </Button>
          )}
        </div>

        {/* Center: The Board */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center gap-4">
          {/* Opponent Info */}
          <div className="w-full max-w-[600px]">
            <PlayerInfo
              name={opponentName}
              color={opponentColor}
              isActiveTurn={
                turnColor === opponentColor && game.status === "active"
              }
              isMe={false}
              timeMs={opponentTimeMs}
              isTicking={game.status === "active"}
            />
          </div>

          {/* The Board */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full flex justify-center"
          >
            <ChessBoard
              fen={game.fen}
              onMove={handleMove}
              playerColor={playerColor}
              isMyTurn={isMyTurn}
            />
          </motion.div>

          {/* My Info */}
          <div className="w-full max-w-[600px]">
            <PlayerInfo
              name={isSpectator ? "Spectator" : myName}
              color={isSpectator ? "white" : (playerColor as "white" | "black")}
              isActiveTurn={
                turnColor === playerColor && game.status === "active"
              }
              isMe={!isSpectator}
              timeMs={myTimeMs}
              isTicking={game.status === "active"}
            />
          </div>
        </div>

        {/* Right Side: Move History */}
        <div className="lg:col-span-3 bg-card border border-border rounded-3xl p-5 h-[600px] flex flex-col shadow-xl">
          <h3 className="font-display text-xl font-bold mb-4 border-b border-border pb-4">
            Move History
          </h3>
          <div className="flex-1 overflow-y-auto pr-2 font-mono text-sm space-y-1">
            {moveHistory.length === 0 ? (
              <p className="text-muted-foreground text-center mt-10">
                No moves yet
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {moveHistory
                  .reduce((result: string[][], move, index) => {
                    if (index % 2 === 0) result.push([move]);
                    else result[result.length - 1].push(move);
                    return result;
                  }, [])
                  .map((pair, i) => (
                    <React.Fragment key={i}>
                      <div className="flex gap-3">
                        <span className="text-muted-foreground w-6 text-right">
                          {i + 1}.
                        </span>
                        <span className="font-semibold">{pair[0]}</span>
                      </div>
                      <div className="font-semibold">{pair[1] || ""}</div>
                    </React.Fragment>
                  ))}
              </div>
            )}
          </div>

          {/* Mobile controls */}
          <div className="mt-4 pt-4 border-t border-border lg:hidden space-y-4">
            {game.status === "finished" && (
              <div className="text-center mb-4">
                <span className="font-bold text-primary">Game Over</span>:{" "}
                {game.winner === "draw" ? "Draw" : `${game.winner} wins`}
              </div>
            )}
            {!isSpectator && game.status === "active" && (
              <Button
                variant="outline"
                className="w-full border-destructive/50 text-destructive"
                onClick={resign}
              >
                <Flag className="w-4 h-4 mr-2" /> Resign
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
