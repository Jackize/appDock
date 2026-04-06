---
name: add-backend-api-endpoint-and-frontend-integration
description: Workflow command scaffold for add-backend-api-endpoint-and-frontend-integration in appDock.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-backend-api-endpoint-and-frontend-integration

Use this workflow when working on **add-backend-api-endpoint-and-frontend-integration** in `appDock`.

## Goal

Adds a new backend API endpoint/service and integrates it with the frontend UI, including new hooks, pages, and type updates.

## Common Files

- `backend/internal/handlers/*.go`
- `backend/internal/services/*.go`
- `backend/internal/models/*.go`
- `backend/main.go`
- `frontend/src/pages/*.tsx`
- `frontend/src/hooks/*.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create or update backend handler (backend/internal/handlers/feature_handler.go)
- Create or update backend service (backend/internal/services/feature_service.go)
- Update backend models if needed (backend/internal/models/feature.go)
- Update backend/main.go to register new routes or services
- Update or add frontend page (frontend/src/pages/Feature.tsx)

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.