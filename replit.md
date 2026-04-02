# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5 + Socket.IO
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)
- **Frontend**: React + Vite, Tailwind CSS, Wouter routing

## Project: Multiplayer Chess Game

A real-time multiplayer chess platform called **Grandmaster**.

### Features
- Create a game room and share a game ID with a friend
- Join existing games by entering the game ID or from the lobby
- Real-time gameplay via Socket.IO WebSockets
- Full chess rule validation using chess.js
- Move history (PGN notation), resign button, check/checkmate/draw detection
- Beautiful dark elegant UI with gold accents

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server + Socket.IO
│   └── chess-game/         # React frontend (chess game)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 + Socket.IO API server. Routes in `src/routes/`, Socket.IO setup in `src/socket.ts`.

- `GET /api/games` — list open game lobbies
- `POST /api/games` — create a new game
- `GET /api/games/:gameId` — get game by ID
- `POST /api/games/:gameId/join` — join a game as black player

Socket.IO events (path: `/api/socket.io/`):
- `join-room` → `{gameId, playerId}` — enter a room
- `make-move` → `{gameId, playerId, from, to, promotion?}` — make a move
- `resign` → `{gameId, playerId}` — resign
- `game-updated` ← full game object broadcast to room

### `artifacts/chess-game` (`@workspace/chess-game`)

React + Vite frontend. Pages: Home (lobby) and GameRoom (chess board).

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

Schema:
- `games` — id, status, whitePlayerId/Name, blackPlayerId/Name, fen, pgn, winner, moves, timestamps

Run migrations: `pnpm --filter @workspace/db run push`

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec. Run codegen: `pnpm --filter @workspace/api-spec run codegen`
