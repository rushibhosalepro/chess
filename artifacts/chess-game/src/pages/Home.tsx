import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayer } from '@/hooks/use-player';
import { useMatchmaking } from '@/hooks/use-matchmaking';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Crown, X, Loader2 } from 'lucide-react';

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { playerId, playerName, updatePlayerName } = usePlayer();
  const [inputName, setInputName] = useState('');

  const { status, findMatch, cancelMatch, matchedGame, yourColor } = useMatchmaking();

  // Sync stored name into input on mount
  useEffect(() => {
    if (playerName) setInputName(playerName);
  }, [playerName]);

  // When matched, store color and navigate to game room
  useEffect(() => {
    if (status === 'matched' && matchedGame && yourColor) {
      localStorage.setItem('chess_your_color', yourColor);
      localStorage.setItem('chess_game_player_id', playerId);
      setLocation(`/game/${matchedGame.id}`);
    }
  }, [status, matchedGame, yourColor, playerId, setLocation]);

  const handleFindMatch = () => {
    if (!inputName.trim()) {
      toast({ title: "Name required", description: "Please enter your name before playing.", variant: "destructive" });
      return;
    }
    updatePlayerName(inputName.trim());
    findMatch(playerId, inputName.trim());
  };

  const handleCancel = () => {
    cancelMatch(playerId);
  };

  const isSearching = status === 'connecting' || status === 'waiting';

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 relative overflow-hidden">

      {/* Subtle bg grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 63px,white 63px,white 64px),repeating-linear-gradient(90deg,transparent,transparent 63px,white 63px,white 64px)' }}
      />

      <motion.div
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-14 z-10"
      >
        <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-full mb-6 shadow-[0_0_40px_rgba(212,175,55,0.15)]">
          <Crown size={36} strokeWidth={1.5} className="text-primary" />
        </div>
        <h1 className="text-6xl md:text-8xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50 mb-4 tracking-tight">
          Grandmaster
        </h1>
        <p className="text-lg text-muted-foreground max-w-sm mx-auto">
          Premium real-time chess. Enter your name and get matched instantly.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-sm z-10"
      >
        <div className="bg-card/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <AnimatePresence mode="wait">
            {!isSearching ? (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-5"
              >
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                    Your Name
                  </label>
                  <Input
                    placeholder="Enter your alias..."
                    value={inputName}
                    onChange={(e) => setInputName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFindMatch()}
                    className="text-base h-12"
                    autoFocus
                  />
                </div>

                <Button
                  className="w-full h-12 text-base font-semibold"
                  size="lg"
                  onClick={handleFindMatch}
                  disabled={!playerId}
                >
                  <Crown size={18} className="mr-2" />
                  Find Match
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="searching"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center text-center py-4 space-y-6"
              >
                {/* Pulsing board icon */}
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center shadow-[0_0_40px_rgba(212,175,55,0.2)]">
                    <Crown size={36} strokeWidth={1.5} className="text-primary" />
                  </div>
                  <div className="absolute inset-0 rounded-2xl border border-primary/30 animate-ping" />
                </div>

                <div>
                  <h3 className="text-xl font-display font-bold mb-1">Looking for opponent...</h3>
                  <p className="text-sm text-muted-foreground">
                    You'll be matched as soon as another player is ready.
                  </p>
                </div>

                {/* Animated dots */}
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full bg-primary"
                      animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={14} className="mr-1.5" /> Cancel
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Tip */}
        <AnimatePresence>
          {!isSearching && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-xs text-muted-foreground mt-4"
            >
              Open this page in two tabs to play against yourself
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
