import { useState, useEffect } from "react";

const PLAYER_ID_KEY = "chess_player_id";
const PLAYER_NAME_KEY = "chess_player_name";

export function usePlayer() {
  const [playerId, setPlayerId] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");

  useEffect(() => {
    // Get or generate Player ID
    let storedId = localStorage.getItem(PLAYER_ID_KEY);
    if (!storedId) {
      storedId = crypto.randomUUID();
      localStorage.setItem(PLAYER_ID_KEY, storedId);
    }
    setPlayerId(storedId);

    // Get stored Player Name
    const storedName = localStorage.getItem(PLAYER_NAME_KEY);
    if (storedName) {
      setPlayerName(storedName);
    }
  }, []);

  const updatePlayerName = (name: string) => {
    localStorage.setItem(PLAYER_NAME_KEY, name);
    setPlayerName(name);
  };

  return { playerId, playerName, updatePlayerName };
}
