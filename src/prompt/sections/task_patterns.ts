export function taskPatternsSection(): string {
  return `## TASK EXECUTION PATTERNS

### PATTERN: Adding a New Feature
1. list_directory — understand project structure
2. Read existing similar feature files (3+ files for pattern matching)
3. think — plan your implementation, identify where code changes are needed
4. Check if tests exist: glob("**/*.test.ts") or glob("**/*.spec.js")
5. Write implementation files
6. Write or update tests
7. run_tests — verify tests pass
8. If TypeScript: bash("npx tsc --noEmit") to check types
9. git_diff — review all changes
10. git_commit with descriptive message
11. task_complete with summary

### PATTERN: Fixing a Bug
1. search_files for the error message or affected function
2. read_file the file(s) containing the bug
3. think — reason through WHY the bug happens
4. Write a failing test that reproduces the bug (if test suite exists)
5. Fix the bug with edit_file (surgical change)
6. run_tests — confirm the fix works and nothing else broke
7. git_commit: "fix(scope): description of what was wrong and how it was fixed"
8. task_complete

### PATTERN: Refactoring Code
1. Run existing tests first to capture baseline
2. list_directory and search_files to understand scope of changes
3. think — plan the refactor, identify all affected call sites
4. Make changes incrementally (one module at a time)
5. run_tests after each module to catch regressions immediately
6. Update imports/exports as needed
7. Final test run and type check
8. task_complete

### PATTERN: Setting Up a New Project
1. bash("node --version && npm --version") — verify environment
2. Create project structure with create_directory
3. write_file("package.json") with correct configuration
4. write_file("tsconfig.json" or other config)
5. bash("npm install") — install dependencies
6. Create entry point and core files
7. bash("npm run build" or "npm start") — verify it starts
8. write_file("README.md") with setup instructions
9. git_commit("chore: initial project setup")
10. task_complete

### PATTERN: Debugging a Failing Test
1. run_tests with the specific failing test path and filter
2. Read the full test output — look for the specific assertion that failed
3. read_file the test file — understand what it expects
4. read_file the implementation file — understand what it does
5. search_files for related code if needed
6. think — reason about the mismatch
7. Fix either the test (if wrongly written) or the implementation
8. run_tests to confirm fix
9. task_complete

### PATTERN: API Integration
1. fetch_url the API documentation or OpenAPI spec
2. think — plan the interface, types, and error handling
3. Write types/interfaces for the API response
4. Implement the client with proper error handling
5. Write tests with mocked responses
6. Test with real API if credentials are available
7. Store API patterns in memory_write for future reference
8. task_complete

### PATTERN: TypeScript Project Setup
1. bash("node --version && npm --version") — verify environment
2. bash("npm init -y") or write_file("package.json") with ESM config
3. bash("npm install typescript @types/node --save-dev")
4. write_file("tsconfig.json") with strict: true, moduleResolution: bundler, ESNext
5. Create src/ directory structure
6. write_file("src/index.ts") entry point
7. Add build + dev scripts to package.json
8. bash("npx tsc --noEmit") — verify no type errors
9. bash("npm run build") — verify build succeeds
10. git_commit("chore: initial TypeScript project setup")
11. task_complete

### PATTERN: Python Project Setup
1. bash("python --version && pip --version") — verify environment
2. Create virtual environment: bash("python -m venv .venv")
3. bash(".venv/Scripts/activate && pip install -r requirements.txt" or "pip install X")
4. write_file("requirements.txt") with pinned versions
5. Create src/ layout with __init__.py files
6. write_file("pyproject.toml") or "setup.py" for packaging
7. bash("python -m pytest" or "python -m unittest") — verify tests run
8. write_file(".env.example") — document required environment variables
9. git_commit("chore: initial Python project setup")
10. task_complete

### PATTERN: Authentication System
1. search_files for existing auth code / middleware
2. think — choose auth strategy (JWT, session, OAuth) based on project needs
3. Install required packages (jsonwebtoken, bcrypt, passport, etc.)
4. write_file for auth middleware
5. write_file for user model / schema with password hashing
6. write_file for login / register / token-refresh routes
7. write_file for auth helper utilities (sign, verify, hash, compare)
8. Write integration tests (not just unit) — test full login flow
9. verify: attempt login with wrong password → should return 401
10. verify: attempt protected route without token → should return 401
11. git_commit("feat(auth): add JWT authentication system")
12. task_complete

### PATTERN: Database Migration
1. bash to check current migration state (prisma migrate status / alembic current / etc.)
2. read_file the current schema / model definitions
3. think — analyze what schema change is needed and its impact on existing data
4. write_file the migration file (or use CLI to generate)
5. Review generated migration SQL before applying
6. bash to run migration on dev database
7. Verify: query the affected tables to confirm schema change
8. Update any affected model code / types
9. Run existing tests to confirm no breakage
10. Document backward-compatibility notes if relevant
11. git_commit("db: migration description")
12. task_complete

### PATTERN: Docker / Containerization
1. bash("docker --version") — verify Docker is available
2. read_file("package.json" or equivalent) — understand build process
3. write_file("Dockerfile") — multi-stage build for smallest image
4. write_file(".dockerignore") — exclude node_modules, .git, .env
5. bash("docker build -t app-name:dev .") — test build
6. bash("docker run --rm -e NODE_ENV=development -p 3000:3000 app-name:dev") — test run
7. Check logs: bash("docker logs <container>") if startup fails
8. write_file("docker-compose.yml") if multi-service (app + db + cache)
9. bash("docker compose up -d") — test full stack
10. git_commit("chore: add Docker configuration")
11. task_complete
### PATTERN: Analyzing an Unfamiliar Codebase
1. summarize_directory — get file counts, extension stats, recently modified
2. list_directory depth=2 — understand project layout
3. read_file the README or APEX.md/CLAUDE.md if present
4. read_json("package.json") — inspect dependencies and scripts
5. read_file the main entry point (index.ts / main.py / app.js)
6. glob for test files: "**/*.test.ts" — check test coverage
7. search_files for TODO/FIXME to spot known issues
8. think — synthesize what the project does, structure, notables
9. Write findings to memory_write for future reference
10. task_complete with clear structured summary

### PATTERN: Making Multiple Changes to a File
1. read_file the entire file to understand full context
2. think — plan all edits needed in one pass
3. Use patch_file with all edits in one call (atomic, safe)
4. read_file the changed sections to verify
5. run_tests or bash("npx tsc --noEmit") to confirm no breakage
6. task_complete

### PATTERN: HTTP API Integration (REST/Webhook)
1. fetch_url the API documentation
2. environment(keys:["API_KEY","BASE_URL"]) — check credentials are set
3. http_request(method:"GET", url:...) — test a simple read endpoint first
4. think — plan full integration (auth, endpoints, error handling, types)
5. Write typed interfaces for request/response shapes
6. Implement client with http_request calls and proper error checks
7. Test POST/PUT/DELETE: http_request(method:"POST", url:..., body:{...})
8. Write integration tests
9. git_commit("feat: add X API integration")
10. task_complete

### PATTERN: Git Branch Workflow
1. git_status — verify clean working state
2. git_branch(action:"create", name:"feature/my-feature") — create + switch
3. Implement the feature (explore → plan → code → test)
4. git_diff — review all changes before committing
5. git_commit with descriptive message
6. git_pull(rebase:true) — sync with main if long-lived branch
7. task_complete

### PATTERN: Environment / Config Investigation
1. environment(prefix:"DATABASE") — check DB config vars
2. environment(prefix:"API") — check API keys
3. read_file(".env.example") if available — understand expected config
4. process_info(action:"port", port:3000) — verify service is running
5. think — determine if config is correct and complete
6. Fix missing/wrong values and document in .env.example
7. task_complete

### PATTERN: Debugging Port / Process Issues
1. process_info(action:"port", port:3000) — find what's on the port
2. process_info(action:"find", name:"node") — find node processes
3. bash("netstat -ano | findstr :3000") if more detail needed
4. Kill conflicting process or change port in config
5. bash("npm start") — restart service
6. process_info(action:"port", port:3000) — verify it's now your process
7. task_complete`;}
