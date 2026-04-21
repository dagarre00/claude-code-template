---
title: Project Requirements
updated: 2026-04-06
---

# Project Requirements

## Status: Draft

## Vision

A personal finance dashboard that aggregates bank transactions via Plaid API, categorizes spending automatically, and surfaces monthly insights. Target: solo users who want a self-hosted alternative to Mint.

## User Stories

- As a user, I can connect my bank accounts via Plaid Link
- As a user, I can see all transactions in a unified feed with search and filters
- As a user, I can see auto-categorized spending (food, transport, housing, etc.)
- As a user, I can override a transaction's category and the system learns from it
- As a user, I can view monthly spending breakdown as charts
- As a user, I can set budget limits per category and get alerts
- As a user, I can export transactions to CSV

## Functional Requirements

- Auth: email/password with JWT, no OAuth for v1
- Plaid integration: Link flow, transaction sync (webhook-based), balance fetch
- Categorization engine: rule-based first, ML classifier as v2 stretch goal
- Dashboard: monthly summary, category breakdown (pie + bar), trend line (6 months)
- Budgets: per-category monthly limits, visual progress bar, email alert at 80% and 100%
- Export: CSV download filtered by date range and category

## Non-Functional Requirements

- Stack: Python (FastAPI) backend, React + TypeScript frontend, PostgreSQL, Redis for caching
- API response time < 200ms for cached data, < 2s for Plaid sync
- Mobile-responsive (not native)
- Docker Compose for local dev, single `docker compose up` to start everything
- Test coverage > 80% for backend, > 60% for frontend
- CI: GitHub Actions — lint, test, build on every PR

## Constraints

- Plaid sandbox only for v1 (no production credentials yet)
- No paid infrastructure — must run on a single VPS or local machine
- Single-user only for v1 (no multi-tenancy)
- Budget: 0 — all tools/services must be free tier or open source

## Out of Scope

- Mobile native apps
- Multi-currency support
- Investment tracking
- Shared/family accounts
- Bank write operations (transfers, payments)
