```markdown
# appDock Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches you the key development patterns and conventions used in the `appDock` TypeScript codebase. You'll learn how to name files, structure imports and exports, and write and run tests according to the project's established practices. This guide also provides suggested commands for common workflows to streamline your development process.

## Coding Conventions

### File Naming
- Use **camelCase** for filenames.
  - Example: `userProfile.ts`, `appConfig.ts`

### Import Style
- Both default and named imports are used; prefer clarity and consistency.
  - Example (named import):
    ```typescript
    import { fetchData } from './apiUtils';
    ```
  - Example (default import):
    ```typescript
    import appConfig from './appConfig';
    ```

### Export Style
- Prefer **named exports** for modules.
  - Example:
    ```typescript
    // In userProfile.ts
    export function getUserProfile(id: string) { ... }
    export const USER_ROLE = 'admin';
    ```

### General Code Style
- TypeScript is used throughout—leverage types and interfaces for clarity.
- Commit messages are freeform and concise (average 45 characters).

## Workflows

### Adding a New Module
**Trigger:** When you need to create a new feature or utility.
**Command:** `/add-module`

1. Create a new file using camelCase naming (e.g., `newFeature.ts`).
2. Implement your logic using TypeScript, favoring named exports.
3. Import dependencies using either named or default imports as needed.
4. Write corresponding tests in a file named `newFeature.test.ts`.
5. Commit your changes with a clear, concise message.

### Running Tests
**Trigger:** When you want to verify code correctness.
**Command:** `/run-tests`

1. Identify test files (`*.test.*`).
2. Use the project's test runner (framework is unknown; check package.json or docs).
3. Run all tests and review output for failures.
4. Fix any issues and rerun tests as needed.

### Refactoring Imports/Exports
**Trigger:** When reorganizing code or improving module structure.
**Command:** `/refactor-imports`

1. Update import statements to use named imports/exports where possible.
2. Ensure all exports in modules are named.
3. Adjust import paths for clarity and consistency.
4. Run tests to confirm nothing is broken.

## Testing Patterns

- Test files are named with the pattern `*.test.*` (e.g., `userProfile.test.ts`).
- The testing framework is not specified; check the project configuration for details.
- Place test files alongside the modules they test or in a dedicated `tests` directory.
- Example test file:
  ```typescript
  // userProfile.test.ts
  import { getUserProfile } from './userProfile';

  test('should fetch user profile by ID', () => {
    const profile = getUserProfile('123');
    expect(profile.id).toBe('123');
  });
  ```

## Commands
| Command         | Purpose                                      |
|-----------------|----------------------------------------------|
| /add-module     | Scaffold a new module with tests             |
| /run-tests      | Run all test files in the codebase           |
| /refactor-imports| Refactor imports and exports for consistency |
```
