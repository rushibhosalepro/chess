import { useEffect, useRef, useState, useCallback } from "react";
import type { Game } from "@workspace/api-client-react";

type MatchStatus = "idle" | "connecting" | "waiting" | "matched";

interface UseMatchmakingReturn {
  status: MatchStatus;
  findMatch: (playerId: string, playerName: string) => void;
  cancelMatch: (playerId: string) => void;
  matchedGame: Game | null;
  yourColor: "white" | "black" | null;
}

type ServerMessage =
  | { type: "waiting"; gameId: string }
  | { type: "game-started"; game: Game; yourColor: "white" | "black" }
  | { type: "match-cancelled" }
  | { type: "error"; message: string };

export function useMatchmaking(): UseMatchmakingReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<MatchStatus>("idle");
  const [matchedGame, setMatchedGame] = useState<Game | null>(null);
  const [yourColor, setYourColor] = useState<"white" | "black" | null>(null);

  const pendingMessageRef = useRef<object | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const apiHost = import.meta.env.VITE_API_HOST ?? "localhost:3000";
    const url = `${protocol}//${apiHost}/api/ws`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (pendingMessageRef.current) {
        ws.send(JSON.stringify(pendingMessageRef.current));
        pendingMessageRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === "waiting") {
        setStatus("waiting");
      } else if (msg.type === "game-started") {
        setMatchedGame(msg.game);
        setYourColor(msg.yourColor);
        setStatus("matched");
      } else if (msg.type === "match-cancelled") {
        setStatus("idle");
      }
    };

    ws.onclose = () => {
      if (status !== "matched") setStatus("idle");
    };

    ws.onerror = () => {
      setStatus("idle");
    };
  }, [status]);

  const findMatch = useCallback(
    (playerId: string, playerName: string) => {
      setStatus("connecting");
      const payload = { type: "find-match", playerId, playerName };

      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        pendingMessageRef.current = payload;
        connect();
      } else if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload));
      } else {
        pendingMessageRef.current = payload;
      }
    },
    [connect],
  );

  const cancelMatch = useCallback((playerId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "cancel-match", playerId }));
    }
    setStatus("idle");
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  return { status, findMatch, cancelMatch, matchedGame, yourColor };
}
