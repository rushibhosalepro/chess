# Grandmaster

A monorepo for a multiplayer chess game.

## Packages

- `artifacts/api-server` - API server and socket backend.
- `artifacts/chess-game` - Frontend application for the chess game.
- `artifacts/mockup-sandbox` - UI mockup sandbox.
- `lib/api-client-react` - Shared API client.
- `lib/api-spec` - OpenAPI specification and generator config.
- `lib/api-zod` - Zod-based API type definitions.
- `lib/db` - Database schema and Drizzle configuration.
- `scripts` - helper scripts for workspace tooling.

## Getting Started

Install dependencies:

```bash
pnpm install
```

Run the workspace packages with the appropriate package manager commands in each package directory.

## Structure

The repository uses a pnpm workspace with separate frontend, backend, and shared libraries.

## Notes

- `package.json` and `pnpm-workspace.yaml` define workspace package boundaries.
- `tsconfig.json` files are used for TypeScript configuration across packages.
- The frontend and backend are organized under `artifacts/`.
