# TFT2 Backend (Node.js)

This repository contains a backend-first implementation for TFT History Manager.

See `apps/api/README.md` for setup, startup lifecycle, Flyway usage, and test commands.

## Quick Start (PowerShell / VS Code)

1. `pnpm run db:up` to start PostgreSQL and auto-apply Flyway migrations + seed data via Docker.
2. `pnpm run start` to run the backend API.
