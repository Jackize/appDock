```markdown
# appDock Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns and conventions found in the `appDock` Go repository. It covers file organization, import/export styles, code formatting, and testing approaches. By following these guidelines, contributors can write code that is consistent with the existing codebase, making collaboration and maintenance easier.

## Coding Conventions

### File Naming
- Use **snake_case** for all file names.
  - Example: `user_service.go`, `database_utils.go`

### Import Style
- Use **alias imports** for packages.
  - Example:
    ```go
    import db "github.com/example/database"
    import log "github.com/sirupsen/logrus"
    ```

### Export Style
- Use **named exports** for functions, types, and variables that should be accessible outside the package.
  - Example:
    ```go
    // Exported function
    func StartServer() {
        // ...
    }

    // Exported type
    type AppConfig struct {
        // ...
    }
    ```

- Unexported (private) identifiers should start with a lowercase letter.
    ```go
    // Private function
    func connectDatabase() {
        // ...
    }
    ```

### Commit Patterns
- Commit messages are **freeform** and do not follow a strict prefix or type system.
- Average commit message length is around 57 characters.

## Workflows

### Adding a New Feature
**Trigger:** When you need to implement a new feature in the application  
**Command:** `/add-feature`

1. Create a new file using snake_case if needed (e.g., `feature_name.go`).
2. Use alias imports for any external packages.
3. Export any functions or types that need to be accessed by other packages.
4. Write corresponding tests in a `*.test.*` file.
5. Commit your changes with a clear, descriptive message.

### Fixing a Bug
**Trigger:** When you identify and fix a bug  
**Command:** `/fix-bug`

1. Locate the relevant file(s) using snake_case naming.
2. Apply the fix, following import and export conventions.
3. Update or add tests in the relevant `*.test.*` file.
4. Commit your fix with a descriptive message.

### Writing and Running Tests
**Trigger:** When you need to verify code correctness  
**Command:** `/run-tests`

1. Create or update test files matching the `*.test.*` pattern (e.g., `user_service.test.go`).
2. Write tests using Go's standard testing tools or any framework in use.
3. Run tests using the appropriate Go command:
    ```bash
    go test ./...
    ```
4. Review test results and address any failures.

## Testing Patterns

- Test files follow the `*.test.*` naming pattern (e.g., `module.test.go`).
- The specific testing framework is unknown, but Go's standard `testing` package is likely used.
- Example test file:
    ```go
    // user_service.test.go
    package user

    import "testing"

    func TestStartServer(t *testing.T) {
        // Test logic here
    }
    ```

## Commands
| Command       | Purpose                                      |
|---------------|----------------------------------------------|
| /add-feature  | Start the workflow for adding a new feature  |
| /fix-bug      | Start the workflow for fixing a bug          |
| /run-tests    | Run all tests in the repository              |
```
