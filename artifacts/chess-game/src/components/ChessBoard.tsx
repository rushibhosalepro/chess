import React, { useState, useEffect, useMemo } from 'react';
import { Chess, Square, Move } from 'chess.js';
import { cn } from '@/lib/utils';

interface ChessBoardProps {
  fen: string;
  onMove: (from: string, to: string) => void;
  playerColor: 'white' | 'black' | 'spectator';
  isMyTurn: boolean;
  lastMove?: string; // PGN or basic representation to extract last move squares
}

const COLUMNS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const ROWS = ['8', '7', '6', '5', '4', '3', '2', '1'];

// Unicode map
const PIECE_SYMBOLS: Record<string, string> = {
  'p': '♟', 'n': '♞', 'b': '♝', 'r': '♜', 'q': '♛', 'k': '♚',
  'P': '♙', 'N': '♘', 'B': '♗', 'R': '♖', 'Q': '♕', 'K': '♔'
};

export function ChessBoard({ fen, onMove, playerColor, isMyTurn }: ChessBoardProps) {
  const [chess, setChess] = useState(new Chess());
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [validMoves, setValidMoves] = useState<Move[]>([]);

  // Initialize or update local chess.js instance when fen changes from server
  useEffect(() => {
    try {
      const newChess = new Chess();
      if (fen) newChess.load(fen);
      setChess(newChess);
      
      // Clear selection if fen updates (opponent moved or we synced)
      setSelectedSquare(null);
      setValidMoves([]);
    } catch (e) {
      console.error("Invalid FEN:", fen);
    }
  }, [fen]);

  // Determine board orientation
  const isFlipped = playerColor === 'black';
  
  const displayRows = isFlipped ? [...ROWS].reverse() : ROWS;
  const displayCols = isFlipped ? [...COLUMNS].reverse() : COLUMNS;

  const handleSquareClick = (square: Square) => {
    if (playerColor === 'spectator' || !isMyTurn) return;

    const piece = chess.get(square);
    const isPlayerPiece = piece && piece.color === (playerColor === 'white' ? 'w' : 'b');

    // If we have a selected square and click a valid destination
    if (selectedSquare) {
      const move = validMoves.find(m => m.to === square);
      if (move) {
        // Optimistically make the move locally for immediate feedback
        try {
          chess.move(move);
          setChess(new Chess(chess.fen()));
        } catch (e) {
          console.error(e);
        }
        
        onMove(selectedSquare, square);
        setSelectedSquare(null);
        setValidMoves([]);
        return;
      }
    }

    // If we clicked our own piece, select it
    if (isPlayerPiece) {
      setSelectedSquare(square);
      setValidMoves(chess.moves({ square, verbose: true }) as Move[]);
    } else {
      // Clicked elsewhere, clear selection
      setSelectedSquare(null);
      setValidMoves([]);
    }
  };

  return (
    <div className="relative w-full max-w-[600px] aspect-square rounded-xl overflow-hidden shadow-2xl shadow-black/50 border-4 border-border/80">
      {/* Board Grid */}
      <div className="w-full h-full grid grid-cols-8 grid-rows-8">
        {displayRows.map((row, rowIndex) => (
          displayCols.map((col, colIndex) => {
            const square = (col + row) as Square;
            const piece = chess.get(square);
            const isLight = (rowIndex + colIndex) % 2 === 0;
            
            const isSelected = selectedSquare === square;
            const isValidMove = validMoves.some(m => m.to === square);
            const isCapture = isValidMove && piece;

            return (
              <div
                key={square}
                onClick={() => handleSquareClick(square)}
                className={cn(
                  "relative flex items-center justify-center text-4xl sm:text-5xl md:text-6xl cursor-pointer select-none transition-colors duration-200",
                  isLight ? "bg-board-light" : "bg-board-dark",
                  isSelected && "bg-board-highlight/70 shadow-[inset_0_0_20px_rgba(0,0,0,0.3)]",
                  !isSelected && isValidMove && !isCapture && "after:absolute after:w-1/4 after:h-1/4 after:bg-board-highlight/50 after:rounded-full",
                  !isSelected && isCapture && "after:absolute after:w-full after:h-full after:border-8 after:border-board-highlight/50 after:rounded-full",
                )}
              >
                {/* Coordinates (only on edges) */}
                {colIndex === 0 && (
                  <span className={cn(
                    "absolute top-1 left-1 text-[10px] sm:text-xs font-bold font-sans",
                    isLight ? "text-board-dark/80" : "text-board-light/80"
                  )}>
                    {row}
                  </span>
                )}
                {rowIndex === 7 && (
                  <span className={cn(
                    "absolute bottom-1 right-1 text-[10px] sm:text-xs font-bold font-sans",
                    isLight ? "text-board-dark/80" : "text-board-light/80"
                  )}>
                    {col}
                  </span>
                )}

                {/* Piece */}
                {piece && (
                  <div
                    className={cn(
                      "transition-transform duration-200 relative z-10",
                      isSelected && "scale-110 -translate-y-1",
                      piece.color === 'w' ? "chess-piece-white" : "chess-piece-black"
                    )}
                  >
                    {PIECE_SYMBOLS[piece.color === 'w' ? piece.type.toUpperCase() : piece.type]}
                  </div>
                )}
              </div>
            );
          })
        ))}
      </div>
    </div>
  );
}
