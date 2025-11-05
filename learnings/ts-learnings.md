<!--
Document Type: Learning Notes
Purpose: Document npm, npx, and TypeScript execution patterns
Context: Understanding package managers and script execution in Node.js/TypeScript projects
Key Topics: npm vs npx, running TypeScript, package.json scripts, tsx
Target Use: Reference guide for understanding Node.js tooling
-->

# TypeScript & Node.js Tooling Learnings

## npm vs npx - Key Differences

### `npm` (Node Package Manager)
**Purpose:** Install and manage packages

```bash
# Install packages
npm install package-name           # Install to node_modules
npm install -g package-name        # Install globally
npm install --save-dev package     # Install as dev dependency

# Run scripts from package.json
npm run build                      # Runs "build" script
npm run dev                        # Runs "dev" script
npm run start                      # Runs "start" script
```

### `npx` (Node Package eXecute)
**Purpose:** Execute packages/binaries directly

```bash
# Run installed packages from node_modules/.bin/
npx tsx file.ts                    # Run TypeScript file
npx eslint .                       # Run ESLint

# Run packages without installing permanently
npx create-next-app                # Temporarily downloads, runs, deletes
npx cowsay "Hello"                 # One-time execution

# Run specific versions
npx react@18 --version             # Run specific version
npx package@latest                 # Always use latest
```

**Key Difference:**
- `npm` = Install and keep
- `npx` = Execute (install temporarily if needed, then clean up)

## package.json Scripts

Scripts are defined in `package.json` and run with `npm run <script-name>`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "agent": "tsx app/api/chat/agent.ts"
  }
}
```

```bash
# Running scripts
npm run dev      # Runs "next dev"
npm run build    # Runs "next build"
npm run agent    # Runs "tsx app/api/chat/agent.ts"

# Also works with Bun or other package managers
bun run dev
pnpm run dev
yarn dev
```

## Running TypeScript Files

### Option 1: Using `tsx` (Recommended for direct execution)
```bash
# Direct execution with npx
npx tsx file.ts

# Or install and use
npm install -D tsx
npx tsx file.ts
```

### Option 2: Compile then run
```bash
# Compile TypeScript to JavaScript
npx tsc file.ts

# Run the compiled JavaScript
node file.js
```

### Option 3: Using `ts-node`
```bash
npx ts-node file.ts
```

**Why tsx?**
- Faster than ts-node
- Better ESM support
- Simpler configuration
- Direct execution without compilation step

## Common Patterns

### Development
```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server
```

### Running One-off Scripts
```bash
npx tsx script.ts        # Run TypeScript script once
npx prettier --write .   # Format code
npx eslint --fix .       # Lint and fix
```

### Using Specific Versions
```bash
npx typescript@latest tsc --version
npx create-next-app@14 my-app
```

## npx Use Cases

 **When to use npx:**
- Running CLI tools you don't need installed globally
- Running one-off commands
- Testing different versions of tools
- Running executables from node_modules/.bin/
- Executing TypeScript files directly

L **When NOT to use npx:**
- Installing packages (use `npm install`)
- Running package.json scripts (use `npm run`)
- For frequently used global tools (install with `npm install -g`)

## Quick Reference Table

| Command | Purpose | Example |
|---------|---------|---------|
| `npm install` | Install packages | `npm install next` |
| `npm install -g` | Install globally | `npm install -g typescript` |
| `npm run <script>` | Run package.json script | `npm run build` |
| `npx <package>` | Execute package | `npx tsx file.ts` |
| `npx <package>@<version>` | Execute specific version | `npx typescript@5.0.0` |

## TypeScript Execution Comparison

| Method | Speed | Setup | Use Case |
|--------|-------|-------|----------|
| `tsx` | ¡¡¡ Fast | Minimal | Development, scripts |
| `ts-node` | ¡¡ Moderate | Minimal | Legacy projects |
| `tsc + node` | ¡ Slower | More setup | Production builds |
| `bun` | ¡¡¡ Fast | Minimal | Alternative runtime |

## Important Notes

1. **npx doesn't replace npm** - They serve different purposes
2. **npm run is for scripts** - Use it for project-specific commands
3. **npx is for executables** - Use it to run tools and binaries
4. **tsx is ideal for development** - Fast TypeScript execution without compilation
5. **Always check package.json** - See what scripts are available with `npm run`

---

*Last Updated: 2025-11-05*
