import { useEffect, useRef, useState, useCallback } from "react";
import type { Game } from "@workspace/api-client-react";

interface UseSocketProps {
  gameId: string;
  playerId: string;
  onGameUpdated?: (game: Game) => void;
  onError?: (error: string) => void;
}

type ServerMessage =
  | { type: "game-updated"; game: Game }
  | { type: "error"; message: string };

export function useSocket({
  gameId,
  playerId,
  onGameUpdated,
  onError,
}: UseSocketProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const onGameUpdatedRef = useRef(onGameUpdated);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onGameUpdatedRef.current = onGameUpdated;
  }, [onGameUpdated]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!gameId || !playerId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const apiHost = import.meta.env.VITE_API_HOST ?? "localhost:3000";
    const url = `${protocol}//${apiHost}/api/ws`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ type: "join-room", gameId, playerId }));
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = () => {
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === "game-updated") {
        onGameUpdatedRef.current?.(msg.game);
      } else if (msg.type === "error") {
        onErrorRef.current?.(msg.message);
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [gameId, playerId]);

  const makeMove = useCallback(
    (from: string, to: string, promotion?: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "make-move",
            gameId,
            playerId,
            from,
            to,
            promotion: promotion || "q",
          }),
        );
      }
    },
    [gameId, playerId],
  );

  const resign = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "resign", gameId, playerId }));
    }
  }, [gameId, playerId]);

  const sendTimeout = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "timeout", gameId, playerId }));
    }
  }, [gameId, playerId]);

  return { isConnected, makeMove, resign, sendTimeout };
}
