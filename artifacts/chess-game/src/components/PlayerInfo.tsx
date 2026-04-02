import React from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, Crown, Clock } from 'lucide-react';

interface PlayerInfoProps {
  name: string | null | undefined;
  color: 'white' | 'black';
  isActiveTurn: boolean;
  isMe: boolean;
  timeMs?: number;
  isTicking?: boolean;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function PlayerInfo({ name, color, isActiveTurn, isMe, timeMs, isTicking }: PlayerInfoProps) {
  const isWhite = color === 'white';
  const isLowTime = timeMs !== undefined && timeMs < 60_000;
  const isCritical = timeMs !== undefined && timeMs < 10_000;

  return (
    <div className={cn(
      "flex items-center gap-4 p-4 rounded-2xl transition-all duration-300",
      isActiveTurn ? "bg-primary/10 border-2 border-primary/30 shadow-[0_0_20px_rgba(212,175,55,0.1)]" : "bg-card border-2 border-transparent opacity-80"
    )}>
      <div className="relative">
        <Avatar className={cn(
          "w-12 h-12 border-2",
          isWhite ? "border-white bg-neutral-200" : "border-neutral-800 bg-neutral-900"
        )}>
          <AvatarFallback className="bg-transparent">
            {isWhite ? <User className="text-neutral-800" /> : <User className="text-white" />}
          </AvatarFallback>
        </Avatar>
        {isActiveTurn && (
          <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-1 shadow-lg animate-pulse">
            <Crown size={14} />
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        <span className="font-display font-bold text-lg text-foreground flex items-center gap-2 truncate">
          {name || 'Waiting...'}
          {isMe && (
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-sans uppercase tracking-wider shrink-0">
              You
            </span>
          )}
        </span>
        <span className="text-sm text-muted-foreground capitalize flex items-center gap-1.5">
          <div className={cn("w-3 h-3 rounded-sm border shrink-0", isWhite ? "bg-white border-neutral-400" : "bg-neutral-900 border-neutral-600")} />
          {color}
        </span>
      </div>

      {/* Clock */}
      {timeMs !== undefined && (
        <div className={cn(
          "flex items-center gap-1.5 px-3 py-2 rounded-xl font-mono font-bold text-lg tabular-nums shrink-0 transition-colors duration-300",
          isCritical
            ? "bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse"
            : isLowTime
            ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
            : isActiveTurn
            ? "bg-primary/15 text-primary border border-primary/20"
            : "bg-secondary text-muted-foreground border border-border"
        )}>
          <Clock size={14} className={isTicking && isActiveTurn ? "animate-spin" : ""} style={{ animationDuration: '2s' }} />
          {formatTime(timeMs)}
        </div>
      )}
    </div>
  );
}
