```markdown
# appDock Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches you the core development patterns and workflows used in the **appDock** repository, a Go-based application with a React frontend. You'll learn the coding conventions, file organization, and step-by-step processes for adding features, enhancing installation scripts, updating CI/CD workflows, and extending the frontend UI. This guide is ideal for contributors aiming to maintain consistency and efficiency when working on appDock.

## Coding Conventions

### File Naming

- **Go files:** Use `camelCase` for filenames.
  - Example: `featureHandler.go`, `userService.go`
- **Frontend files:** Use `PascalCase` for React components/pages, `camelCase` for hooks and services.
  - Example: `Dashboard.tsx`, `useStats.ts`, `api.ts`

### Import Style

- **Go:** Use import aliases for clarity.
  ```go
  import (
      db "appDock/internal/database"
      models "appDock/internal/models"
  )
  ```

### Export Style

- **Go:** Use named exports for functions and structs.
  ```go
  // In featureHandler.go
  func HandleFeature(w http.ResponseWriter, r *http.Request) { ... }
  ```

- **Frontend (TypeScript):** Use named exports.
  ```tsx
  // In useStats.ts
  export function useStats() { ... }
  ```

### Example: Go Handler

```go
package handlers

import (
    "net/http"
    services "appDock/internal/services"
)

func HandleFeature(w http.ResponseWriter, r *http.Request) {
    // Handler logic
}
```

### Example: React Hook

```tsx
// frontend/src/hooks/useFeature.ts
import { useState, useEffect } from 'react';
import { getFeature } from '../services/api';

export function useFeature() {
    const [feature, setFeature] = useState(null);
    useEffect(() => {
        getFeature().then(setFeature);
    }, []);
    return feature;
}
```

---

## Workflows

### Add Backend API Endpoint and Frontend Integration

**Trigger:** When adding a new feature requiring backend and frontend changes (e.g., Nginx management, stats history, username change).  
**Command:** `/add-api-feature`

1. **Backend**
    1. Create or update handler:  
       `backend/internal/handlers/featureHandler.go`
    2. Create or update service:  
       `backend/internal/services/featureService.go`
    3. Update models if needed:  
       `backend/internal/models/feature.go`
    4. Register new routes/services in:  
       `backend/main.go`
2. **Frontend**
    1. Add or update page:  
       `frontend/src/pages/Feature.tsx`
    2. Add or update hook:  
       `frontend/src/hooks/useFeature.ts`
    3. Update API service:  
       `frontend/src/services/api.ts`
    4. Update types:  
       `frontend/src/types/index.ts`
    5. Update navigation/UI components as needed:  
       `frontend/src/components/Sidebar.tsx`, `frontend/src/App.tsx`

**Example:**  
_Adding a "Stats History" feature:_
- Backend: `statsHistoryHandler.go`, `statsHistoryService.go`, `statsHistory.go`
- Frontend: `StatsHistory.tsx`, `useStatsHistory.ts`, update `api.ts` and types

---

### Add or Enhance Installation Script

**Trigger:** When adding a new installation method or improving setup scripts.  
**Command:** `/add-install-script`

1. Create or update installation shell script:  
   `install.sh`, `install-docker.sh`, `install-agent.sh`
2. Update `README.md` with new instructions.
3. Optionally update `Makefile` or CI to reference new scripts.

**Example:**  
_Adding Docker installation:_
- Create `install-docker.sh`
- Update `README.md` with Docker instructions
- Update `Makefile` if needed

---

### CI/CD Workflow Update

**Trigger:** When improving or adding automation for building, testing, or releasing the project.  
**Command:** `/update-ci-cd`

1. Edit or add workflow YAML files:  
   `.github/workflows/*.yml`
2. Update `Makefile` or build scripts as needed.
3. Optionally update `README.md` to reflect CI/CD changes.

**Example:**  
_Adding a Docker publish workflow:_
- Create `.github/workflows/docker-publish.yml`
- Update `Makefile` with new targets
- Document in `README.md`

---

### Add or Enhance Frontend Feature or UI Component

**Trigger:** When adding a new UI page/component or enhancing an existing one (e.g., Dashboard charts, Settings page, Header stats).  
**Command:** `/add-ui-feature`

1. Create or update frontend page component:  
   `frontend/src/pages/*.tsx`
2. Create or update frontend hook:  
   `frontend/src/hooks/*.ts`
3. Update or add supporting UI components:  
   `frontend/src/components/*.tsx`
4. Update frontend types:  
   `frontend/src/types/index.ts`
5. Update API service if new endpoints are needed:  
   `frontend/src/services/api.ts`

**Example:**  
_Adding a "User Settings" page:_
- Create `UserSettings.tsx`
- Add `useUserSettings.ts`
- Update `api.ts` and types

---

## Testing Patterns

- **Framework:** Unknown (no explicit framework detected)
- **File Pattern:** Test files follow the `*.test.*` naming convention.
    - Example: `featureHandler.test.go`, `useFeature.test.ts`
- **General Approach:** Place test files alongside the code they test, using the same naming root with `.test.` inserted.

---

## Commands

| Command            | Purpose                                                        |
|--------------------|----------------------------------------------------------------|
| /add-api-feature   | Add a new backend API endpoint and integrate with frontend      |
| /add-install-script| Add or enhance installation/setup scripts                      |
| /update-ci-cd      | Update or add CI/CD GitHub Actions workflows                   |
| /add-ui-feature    | Add or enhance a frontend feature or UI component              |
```
