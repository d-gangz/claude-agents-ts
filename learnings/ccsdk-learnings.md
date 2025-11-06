<!--
Document Type: Learning Notes
Purpose: Document compatibility issues and solutions when using Claude Agent SDK
Context: Encountered runtime errors with Bun when setting up streaming Claude agent
Key Topics: Bun compatibility, Node.js vs Bun, Claude Agent SDK, runtime environments
Target Use: Reference guide for troubleshooting SDK setup issues
-->

# Claude Agent SDK (CCSDK) Learnings

## Bun vs Node.js Compatibility Issue

### Problem
When running Claude Agent SDK with Bun runtime, encountered the following error:
```
TypeError: undefined is not a function
    at <anonymous> (node:events:102:30)
    at createAbortController (/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs:6211:9)
```

### Root Cause
- The Claude Agent SDK internally uses `createAbortController()` which relies on Node.js-specific APIs
- Bun's implementation of Node.js compatibility APIs doesn't fully support this internal function
- Issue exists in both SDK versions tested:
  - `@anthropic-ai/claude-agent-sdk@0.1.28` (version used in working examples)
  - `@anthropic-ai/claude-agent-sdk@0.1.30` (latest at time of testing)

### Solution
**Use Node.js runtime instead of Bun for running the agent:**

```bash
# Using npx with tsx (TypeScript executor)
npx tsx app/api/chat/agent.ts

# Or add to package.json scripts:
"agent": "tsx app/api/chat/agent.ts"
```

**Note:** You can still use Bun for:
- Installing dependencies (`bun add`)
- Running other scripts (`bun run dev` for Next.js)
- The API route handler (since Next.js uses Node.js internally)

### What We Tried (Didn't Work)
❌ Explicitly setting `executable: "bun"` in options
❌ Providing `pathToClaudeCodeExecutable`
❌ Manually creating `abortController: new AbortController()`
❌ Downgrading to SDK v0.1.28
❌ Loading env with `dotenv/config`
❌ Removing `settingSources` config

### Configuration That Works

**Config (app/api/chat/config.ts):**
```typescript
import type { Options } from "@anthropic-ai/claude-agent-sdk";

export const agentOptions: Options = {
  maxTurns: 50,
  cwd: "/path/to/workspace",
  permissionMode: "bypassPermissions",
  model: "haiku",
  allowedTools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash"],
  systemPrompt: "Your custom prompt here",
  settingSources: ["local", "project"], // Optional: for loading .claude configs
};
```

**Agent Script (app/api/chat/agent.ts):**
```typescript
import "dotenv/config"; // Load env variables
import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { agentOptions } from "./config";

// Use streaming input mode with async generator
async function* generateMessages(): AsyncGenerator<SDKUserMessage, void, unknown> {
  // Your message generation logic
}

// Run query with streaming
for await (const message of query({
  prompt: generateMessages(),
  options: agentOptions,
})) {
  // Handle messages
}
```

### Key Takeaways
1. **Runtime matters:** The Claude Agent SDK has Node.js dependencies that Bun doesn't fully support
2. **SDK is a wrapper:** The Agent SDK spawns the Claude Code CLI process, which requires Node.js APIs
3. **Use tsx for TypeScript:** `npx tsx` is the easiest way to run TypeScript files with Node.js
4. **Environment setup:**
   - Set `ANTHROPIC_API_KEY` in `.env.local` (Bun auto-loads this)
   - Install peer dependency: `bun add @anthropic-ai/sdk`
   - Create workspace directory for agent operations

### Working Example Reference
- SDK Version: `@anthropic-ai/claude-agent-sdk@0.1.28`
- Runtime: Likely Node.js (despite `bun run` in scripts, may be spawning Node.js processes)
- Their setup uses `path.join(process.cwd(), 'agent')` for dynamic cwd paths

### Dependencies Required
```json
{
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "0.1.28",
    "@anthropic-ai/sdk": "^0.68.0",
    "dotenv": "^17.2.3",
    "chalk": "^5.x" // For terminal colors
  }
}
```

### Testing Confirmation
✅ Works with: `npx tsx app/api/chat/agent.ts`
❌ Fails with: `bun run app/api/chat/agent.ts`
⚠️ **Unconfirmed:** Next.js API routes with `bun run dev` (likely fails too - same runtime issue)

## Production Deployment Considerations

### ❌ Don't Use Bun for Production (with this SDK)

**Important:** The Bun runtime incompatibility affects ALL code that uses the Claude Agent SDK, including:
- Standalone CLI scripts (`agent.ts`)
- Next.js API routes (`/app/api/chat/route.ts`)
- Any server-side code that calls `query()` from the SDK

When you run `bun run dev`, Next.js is executed BY Bun, so API routes also run in Bun's runtime and will encounter the same `createAbortController` error.

### ✅ Use Node.js for Production

**For Next.js applications:**
```bash
# Build and run with Node.js (not Bun)
npm run build
npm run start

# Or use deployment platforms that default to Node.js
# - Vercel (uses Node.js by default)
# - Netlify (uses Node.js)
# - Railway, Render, etc.
```

**For standalone agent scripts:**
```bash
# Use tsx with Node.js
npx tsx app/api/chat/agent.ts

# Or add to package.json
{
  "scripts": {
    "agent": "tsx app/api/chat/agent.ts"
  }
}
```

### Can You Use Bun at All?

**Yes, for non-runtime tasks:**
```bash
✅ bun install              # Installing packages
✅ bun add package-name     # Adding dependencies
✅ bun remove package       # Removing dependencies
```

**No, for running the application:**
```bash
❌ bun run dev              # API routes will fail
❌ bun run start            # Production will fail
❌ bun run agent.ts         # Scripts will fail
```

### Why This Happens

The Claude Agent SDK is a **wrapper around the Claude Code CLI**, which spawns Node.js processes and uses Node.js-specific APIs. When you use Bun as the runtime:

1. **Bun executes your code** (TypeScript/JavaScript)
2. **Your code calls** `query()` from the SDK
3. **SDK tries to create** an AbortController using Node.js internals
4. **Bun's Node.js compatibility layer** doesn't fully support this specific API
5. **Error occurs** at the SDK's internal `createAbortController()` function

### Deployment Checklist

- [ ] Use Node.js for runtime (not Bun)
- [ ] Set `ANTHROPIC_API_KEY` environment variable
- [ ] Ensure `@anthropic-ai/sdk` peer dependency is installed
- [ ] Create workspace directory if using `cwd` option
- [ ] Test with `npm run build && npm run start` locally before deploying
- [ ] Use Node.js-based hosting platform or configure runtime to Node.js

### Alternative: Use Anthropic SDK Directly

If Bun support is critical, consider using the base `@anthropic-ai/sdk` instead of the Agent SDK, though you'll lose the agent capabilities (tools, streaming input, session management, etc.).

## How Session Continuity Works

### Overview: Three Ways to Achieve Session Continuity

The Claude Agent SDK provides **three mechanisms** for maintaining conversation context:

1. **`session_id: ""`** - Automatic within single `query()` call (CLI pattern)
2. **`continue: true`** - Resume most recent session globally (single-user only)
3. **`resume: sessionId`** - Resume specific session by ID (multi-user safe)

### 1. Streaming Mode Pattern: `session_id: ""`

**Use case:** CLI scripts with long-lived generator (single `query()` call for entire conversation)

#### How It Works

In the message yielded by the generator:

```typescript
yield {
  type: "user" as const,
  session_id: "",  // ← Empty string = "use current session"
  message: {
    role: "user" as const,
    content: userMessage,
  },
  parent_tool_use_id: null,
};
```

The **empty `session_id`** tells the SDK to use the current active session **within this `query()` call**.

#### Session Lifecycle (Single Query Call):

1. **`query()` starts** → SDK creates a new session with unique ID (e.g., "ABC123")
2. **Generator yields with `session_id: ""`** → SDK interprets as "use ABC123"
3. **Message added to session history** → Context preserved
4. **Generator pauses at `yield`** → Stays alive, doesn't close
5. **SDK processes message, gets response**
6. **SDK needs next input** → Resumes generator from pause point
7. **Loop continues (`while (true)`)** → Back to step 2

```
query() → Session ABC123 created
            ↓
Generator: { session_id: "" } → SDK: "Use ABC123"
            ↓ (pause at yield)
SDK processes message...
            ↓ (resume generator)
Generator: { session_id: "" } → SDK: "Still ABC123"
            ↓ (pause at yield)
SDK processes message...
            ↓ (resume generator)
...continues indefinitely
```

**Key limitation:** `session_id: ""` only works within a **single `query()` call**. Once `query()` ends, the session context is lost unless you use `continue` or `resume`.

#### Why Generators Don't Close After Yielding

**Key concept:** Unlike regular functions that `return` and end, generators **pause** at `yield`:

```typescript
// Regular function (closes after return)
function getMessage() {
  return userInput;  // Function ENDS
}

// Generator (pauses at yield)
async function* generateMessages() {
  while (true) {
    const input = await getUserInput();
    yield input;  // Function PAUSES, stays alive
    // Execution resumes HERE when SDK calls generator.next()
  }
}
```

#### Two Loops Working Together

There are actually **two loops** in streaming mode:

1. **Inner loop (in `generateMessages`)**:
   - Keeps asking user for input
   - Yields messages one at a time
   - Maintains the `while (true)` to continuously provide messages

2. **Outer loop (in `main`)**:
   - Iterates over messages FROM the SDK
   - Receives system, assistant, result messages
   - NOT the same as user input messages

```typescript
// Outer loop: iterating SDK responses
for await (const message of query({
  prompt: generateMessages(),  // Inner loop: generates user input
  options: agentOptions,
})) {
  console.log(message);  // Displays SDK messages
}
```

### 2. Global Resume Pattern: `continue: true`

**Use case:** Single-user applications where you want to automatically resume the most recent conversation

**⚠️ Warning:** NOT suitable for multi-user applications!

#### How It Works

```typescript
// Config with continue: true
export const agentOptions: Options = {
  // ... other options
  continue: true,  // Resume most recent session
};

// Each query() call automatically resumes the last session
for await (const message of query({
  prompt: generateMessages(),
  options: agentOptions,
})) { ... }
```

#### Limitations

❌ **Global scope** - Always resumes THE most recent session on the system
❌ **Multi-user conflicts** - User B's request resumes User A's session
❌ **Page refresh issues** - UI clears but backend remembers old context

**Example of multi-user conflict:**
```
1. User A sends "My name is Alice" → Creates session ABC
2. User B sends "My name is Bob" → Creates session XYZ (most recent)
3. User A sends "What's my name?" → Resumes XYZ → Agent says "Bob" ❌
```

### 3. Specific Resume Pattern: `resume: sessionId`

**Use case:** Multi-user applications with proper session isolation

**✅ Recommended** for production deployments!

#### How It Works

```typescript
// Backend extracts sessionId from request
const { messages, sessionId } = await req.json();

// Use resume with specific session ID
const options = {
  ...agentOptions,
  ...(sessionId && { resume: sessionId }),  // Resume this specific session
};

for await (const message of query({
  prompt: generateMessages(),
  options,
})) { ... }
```

#### Benefits

✅ **Per-user isolation** - Each user has their own session ID
✅ **Multi-user safe** - No cross-user session interference
✅ **Controlled state** - Frontend decides when to start fresh vs continue
✅ **Clean page refresh** - No sessionId in state = new conversation

**Example of multi-user safety:**
```
1. User A sends "My name is Alice" → Session ABC created, frontend stores ABC
2. User B sends "My name is Bob" → Session XYZ created, frontend stores XYZ
3. User A sends "What's my name?" → Frontend sends ABC → Agent says "Alice" ✅
4. User B sends "What's my name?" → Frontend sends XYZ → Agent says "Bob" ✅
```

### Comparison: Which Approach to Use?

| Feature | `session_id: ""` | `continue: true` | `resume: sessionId` |
|---------|------------------|------------------|---------------------|
| **Scope** | Within single `query()` | Global most recent | Specific session |
| **Use case** | CLI scripts | Single-user apps | Multi-user apps |
| **Session tracking** | Automatic | Automatic | Manual (frontend) |
| **Multi-user safe?** | N/A | ❌ No | ✅ Yes |
| **Page refresh behavior** | N/A | ❌ Remembers old | ✅ Fresh start |
| **Implementation complexity** | Simple | Simple | Moderate |
| **Production ready?** | For CLI only | Single-user only | ✅ Yes |

### Decision Guide

**Choose `session_id: ""` when:**
- Building CLI tools with interactive terminal input
- Single `query()` call handles entire conversation
- Example: `app/api/chat/agent.ts`

**Choose `continue: true` when:**
- Single-user application (personal tools, desktop apps)
- You want automatic session resume without tracking IDs
- No multiple concurrent users

**Choose `resume: sessionId` when:**
- ✅ Building web applications with multiple users
- ✅ Need explicit control over session lifecycle
- ✅ Want page refresh to start fresh conversations
- ✅ Production deployment

### Quick Implementation Reference

**CLI Pattern (session_id: ""):**
```typescript
async function* generateMessages() {
  while (true) {
    const input = await readline.question("You: ");
    yield { session_id: "", message: { role: "user", content: input } };
  }
}

for await (const msg of query({ prompt: generateMessages(), options })) {
  console.log(msg);
}
```

**API Pattern (resume: sessionId):**
```typescript
// Frontend
const [sessionId, setSessionId] = useState<string | null>(null);
if (msg.type === "system" && !sessionId) setSessionId(msg.session_id);

// Backend
const options = { ...agentOptions, ...(sessionId && { resume: sessionId }) };
```

### Related Documentation
- See `SDKUserMessage` type in reference.md (line 412-424)
- See "Streaming Input Mode" guide in reference.md (line 1801-2095)
- See "Session Continuity in API Routes vs CLI" section below for detailed multi-user implementation

## Working Directory (`cwd`) Configuration

### Why You Must Specify a Working Directory

The `cwd` (current working directory) option is **critical** for file operations. Without it, the agent might attempt to write to protected system directories.

#### The Problem: Read-Only Filesystem Error

When attempting to write files without proper `cwd` configuration, you'll encounter:

```
EROFS: read-only file system, open '/chix.md'
```

**EROFS** = "Read-Only File System" - The root directory (`/`) on Unix-like systems (macOS, Linux) is protected and read-only.

#### Example from Real Usage

```typescript
// Agent tries to create a file at root
Write("/chix.md", "content")
// ❌ Error: EROFS: read-only file system, open '/chix.md'

// With proper cwd, agent creates in working directory
// Current directory: /Users/gang/git-projects/claude-agents/app/api/chat/workspace
Write("chix.md", "content")
// ✅ Success: File created at workspace/chix.md
```

#### Security Context

**Why root is read-only:**
- Unix-like systems protect the root filesystem (`/`) for security
- Prevents accidental modification of critical system directories
- Only certain directories have write permissions for regular users:
  - Home directory (`~/`)
  - Project directories
  - Temporary directories (`/tmp`)
  - Application-specific directories

#### Proper Configuration

**In your config (see app/api/chat/config.ts:26):**

```typescript
export const agentOptions: Options = {
  // Working directory for agent operations
  cwd: "/Users/gang/git-projects/claude-agents/app/api/chat/workspace",

  // ... other options
};
```

#### Best Practices

✅ **Do:**
- Create a dedicated workspace directory for the agent
- Use absolute paths for `cwd`
- Ensure the directory exists before starting the agent
- Keep workspace separate from source code (add to `.gitignore`)
- Use project-relative paths like `path.join(process.cwd(), 'workspace')`

```typescript
import path from "path";

export const agentOptions: Options = {
  cwd: path.join(process.cwd(), "app/api/chat/workspace"),
  // Dynamically resolves to your project's workspace directory
};
```

❌ **Don't:**
- Use root directory (`/`) as cwd
- Use system directories (`/usr`, `/etc`, `/var`)
- Leave `cwd` undefined (defaults to process.cwd())
- Use relative paths without understanding the base directory

#### Creating the Workspace Directory

Before running the agent, ensure the workspace exists:

```bash
# Create workspace directory
mkdir -p app/api/chat/workspace

# Or in your setup script
node -e "require('fs').mkdirSync('app/api/chat/workspace', { recursive: true })"
```

#### Workspace Directory Structure

```
claude-agents/
├── app/
│   └── api/
│       └── chat/
│           ├── agent.ts
│           ├── config.ts
│           └── workspace/      ← Agent working directory
│               ├── .gitignore  ← Ignore generated files
│               └── (files created by agent appear here)
```

#### .gitignore for Workspace

Add to your `.gitignore`:

```gitignore
# Agent workspace - ignore generated files
app/api/chat/workspace/*
!app/api/chat/workspace/.gitignore
```

#### Permissions Check

Verify your workspace has proper permissions:

```bash
# Check permissions
ls -ld app/api/chat/workspace
# Should show: drwxr-xr-x (owner has write permission)

# Fix if needed
chmod 755 app/api/chat/workspace
```

#### What Happens Without `cwd`

If you don't specify `cwd`, the SDK defaults to `process.cwd()` (where Node.js was started):

```typescript
// If you run: npx tsx app/api/chat/agent.ts
// Default cwd = /Users/gang/git-projects/claude-agents

// Agent tries to write: Write("output.txt", "...")
// Creates: /Users/gang/git-projects/claude-agents/output.txt
// This might pollute your project root!
```

#### System Prompt Integration

Your system prompt should guide the agent to use the working directory (see config.ts:17-19):

```typescript
const SYSTEM_PROMPT = `You are a helpful AI assistant.

<Important>Always create new files in the working directory.
Do not create in 'tmp' directory or system directories.</Important>`;
```

### Key Takeaway

**The `cwd` option sandboxes the agent's file operations**, ensuring:
- Files are created in a controlled location
- No accidental writes to system directories
- Clear separation between source code and generated content
- Proper security boundaries

---

## Next.js API Route Environment Issue

### Problem

When integrating the Claude Agent SDK into a Next.js API route (`/app/api/chat/route.ts`), the endpoint returned an error:

```json
{
  "type": "error",
  "error": "Failed to spawn Claude Code process: spawn node ENOENT"
}
```

**Context:**
- Route configured with `export const runtime = "nodejs"`
- Same config worked perfectly in CLI scripts (`agent.ts`)
- API route could start but SDK failed to spawn subprocess

### Root Cause

Next.js API routes run in a **different execution context** than CLI scripts, with a more restricted environment. The SDK's subprocess spawn mechanism couldn't find the `node` binary or other required executables because:

1. **Environment inheritance**: API routes don't automatically inherit the full shell environment
2. **PATH availability**: The `PATH` variable may not be fully populated in serverless-like contexts
3. **Process spawning**: The SDK spawns the Claude Code CLI as a subprocess, which requires access to system binaries

This is related to [GitHub Issue #4383](https://github.com/anthropics/claude-code/issues/4383) - SDK spawn issues in containerized/restricted environments.

### What We Tried (Didn't Work)

❌ **Manually setting PATH with specific directories**
```typescript
env: {
  ...process.env,
  PATH: `/Users/gang/.local/bin:${process.env.PATH || "/usr/local/bin:/usr/bin:/bin"}`,
}
```

❌ **Adding explicit node path**
```typescript
env: {
  ...process.env,
  NODE: "/usr/local/bin/node",
}
```

❌ **Specifying Claude Code executable path**
```typescript
pathToClaudeCodeExecutable: "/Users/gang/.local/bin/claude",
// Also tried with resolved symlink path
pathToClaudeCodeExecutable: "/Users/gang/.local/share/claude/versions/2.0.34",
```

❌ **Setting executable option**
```typescript
executable: "node",
```

### Solution

**Simply pass the entire `process.env` to the SDK options:**

```typescript
// app/api/chat/config.ts
import type { Options } from "@anthropic-ai/claude-agent-sdk";

export const agentOptions: Options = {
  maxTurns: 50,
  cwd: "/path/to/workspace",
  permissionMode: "default",
  model: "haiku",
  allowedTools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash"],
  systemPrompt: SYSTEM_PROMPT,
  settingSources: ["local"],

  // ✅ The fix: Pass full environment
  env: process.env,
};
```

**Why this works:**
- Ensures SDK subprocess inherits ALL environment variables
- Includes proper PATH, HOME, USER, and other system variables
- Matches the environment that CLI scripts have access to
- No need to manually specify individual paths

### Testing & Validation

Created a test script to validate the NDJSON streaming endpoint:

```typescript
// test-chat-stream.ts
async function testChatStream() {
  const response = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'List files in current directory' }]
    })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        const message = JSON.parse(line);
        console.log('Message:', message.type);
      }
    }
  }
}
```

**Test Results (✅ Success):**
```
✓ Response status: 200
✓ Content-Type: application/x-ndjson

[Message 1] Type: system (init with session ID)
[Message 2] Type: assistant (tool use - Bash command)
[Message 3] Type: user (tool result)
[Message 4] Type: assistant (formatted response)
[Message 5] Type: result (success with cost/tokens)

Duration: 4789ms
Cost: $0.0012
Tokens: 9 input / 102 output
```

### Message Flow

The NDJSON stream returns these message types in sequence:

1. **`system` (init)**: Session ID, model, available tools
2. **`assistant`**: Agent's response with tool uses or text
3. **`user`**: Tool results fed back as user messages (internal)
4. **`assistant`**: Final formatted response
5. **`result`**: Completion status with usage stats

### Key Takeaways

✅ **API routes need explicit environment passing** - Don't assume `process.env` is automatically available to spawned subprocesses

✅ **Keep config simple** - Passing full `process.env` is more reliable than manually constructing PATH

✅ **Test with streaming script** - Validate NDJSON parsing before building frontend

✅ **Session management works automatically** - SDK maintains session context across messages with `session_id: ""`

### Frontend Integration Notes

With the backend working, the frontend can:
- Send only the new user message (not full history)
- Parse NDJSON line-by-line with buffer accumulation
- Display messages in real-time as they stream
- Detect completion with `message.type === 'result'`

**Example NDJSON parsing:**
```typescript
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() || ''; // Keep incomplete line

  for (const line of lines) {
    if (line.trim()) {
      const message = JSON.parse(line);
      // Handle message
      if (message.type === 'result') break;
    }
  }
}
```

### Comparison with CLI Scripts

| Aspect | CLI Scripts | Next.js API Routes |
|--------|-------------|-------------------|
| **Runtime** | Node.js via `npx tsx` | Node.js (Next.js server) |
| **Environment** | Full shell environment | Restricted serverless context |
| **Config needed** | Standard options | Must include `env: process.env` |
| **Works with** | `settingSources`, basic options | Same + explicit env passing |

### Related Issues

- [GitHub Issue #4383](https://github.com/anthropics/claude-code/issues/4383) - SDK spawn ENOENT in Docker/restricted environments
- Similar issues occur in containerized environments, CI/CD pipelines, and serverless functions

### Configuration Reference

**Working Next.js API Route Setup:**

```typescript
// app/api/chat/route.ts
export const runtime = "nodejs";  // Required
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      async function* generateMessages() {
        for (const msg of body.messages) {
          if (msg.role === "user") {
            yield {
              type: "user" as const,
              session_id: "",  // Empty = current session
              message: {
                role: "user" as const,
                content: msg.content,
              },
              parent_tool_use_id: null,
            };
          }
        }
      }

      for await (const message of query({
        prompt: generateMessages(),
        options: agentOptions,  // Includes env: process.env
      })) {
        const chunk = JSON.stringify(message) + "\n";
        controller.enqueue(encoder.encode(chunk));

        if (message.type === "result") break;
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
```

---

## Session Continuity in API Routes vs CLI

### Problem

When building a web-based chat interface that calls the API route with each new user message, the agent doesn't remember previous conversation context. Each request appears to start a fresh session.

**Example:**
```
User: "My name is Gang"
Agent: "Nice to meet you, Gang!"

User: "What is my name?"
Agent: "I don't have access to information about your name..."
```

### Root Cause

There's a critical difference in how sessions work between CLI and API route implementations:

**CLI Script (agent.ts) - Single Query Call:**
```typescript
// ONE query() call for the ENTIRE conversation
for await (const message of query({
  prompt: generateMessages(),  // Generator keeps yielding messages
  options: agentOptions,
})) {
  // All messages share the same session automatically
}
```

The async generator keeps yielding new user messages within a single `query()` call. The SDK creates one session and `session_id: ""` maintains that session throughout.

**API Route (route.ts) - Multiple Query Calls:**
```typescript
// Each HTTP POST request creates a NEW query() call
export async function POST(req: NextRequest) {
  for await (const message of query({  // ❌ New session every time!
    prompt: generateMessages(),
    options: agentOptions,
  })) { ... }
}
```

Each HTTP request triggers a new `query()` call, which by default creates a **brand new session**, losing all previous context.

### Solution: Use `resume` with Session ID Management

**❌ Wrong Approach: `continue: true`**

The `continue: true` option resumes **the most recent session globally**, not per-user:
- User A sends message → session "ABC" created
- User B sends message → session "XYZ" created (most recent)
- User A sends another → resumes "XYZ" (User B's session!) ❌
- Page refresh still remembers old conversation (UI/backend mismatch) ❌

**✅ Correct Approach: `resume` with explicit session ID**

The `resume` option resumes a **specific session by ID**, perfect for multi-user scenarios:

**1. Extract session ID from first message:**
```typescript
// Frontend: components/chat-interface.tsx
const [sessionId, setSessionId] = useState<string | null>(null);

// When parsing NDJSON stream
if (message.type === "system" && message.subtype === "init" && !sessionId) {
  setSessionId(message.session_id);  // Store in state
}
```

**2. Include session ID in subsequent requests:**
```typescript
// Frontend: send sessionId if available
const requestBody = {
  messages: [{ role: "user", content: userMessage }],
  ...(sessionId && { sessionId }),  // Include if exists
};
```

**3. Use resume in backend:**
```typescript
// Backend: app/api/chat/route.ts
const { messages, sessionId } = await req.json();

const options = {
  ...agentOptions,
  ...(sessionId && { resume: sessionId }),  // Resume specific session
};

for await (const message of query({
  prompt: generateMessages(),
  options,
})) { ... }
```

**How it works:**
1. First request (no sessionId): SDK creates new session "ABC123"
2. Frontend extracts and stores "ABC123" in React state
3. Second request: Frontend sends `sessionId: "ABC123"`
4. Backend uses `resume: "ABC123"` to continue that specific session
5. Page refresh: State clears → new session created (fresh start)

### Why This Pattern Differs

| Aspect | CLI Script | API Route with `continue: true` | API Route with `resume` |
|--------|-----------|--------------------------------|------------------------|
| **Query calls** | Single `query()` for entire conversation | New `query()` per HTTP request | New `query()` per HTTP request |
| **Session scope** | One session, local to process | Global "most recent" session | Specific session by ID |
| **Multi-user safety** | N/A (single user CLI) | ❌ Users interfere | ✅ Isolated per user |
| **Page refresh behavior** | N/A | ❌ Resumes old session | ✅ Starts fresh |
| **Context preservation** | Automatic via `session_id: ""` | Automatic but global | Manual per-user tracking |

### Key Takeaway

**For production multi-user apps, use `resume` with explicit session IDs:**

- ❌ **`continue: true`** - Global, single-user only, page refresh issues
- ✅ **`resume: sessionId`** - Per-user, multi-user safe, clean state management

**Implementation pattern:**
1. Frontend stores session ID in React state
2. Backend uses `resume` when session ID provided
3. Page refresh clears state → new session (UI matches backend)

### Validation

Test the session management in the browser:

1. **Test session continuity:**
   - Navigate to http://localhost:3000/chat
   - Send: "My name is Gang"
   - Send: "What is my name?"
   - ✅ Should remember your name

2. **Test page refresh (fresh session):**
   - Refresh the page
   - Send: "What is my name?"
   - ✅ Should say it doesn't know (new session)

3. **Test multi-user isolation** (open two browser windows):
   - Window A: "My name is Alice"
   - Window B: "My name is Bob"
   - Window A: "What is my name?"
   - ✅ Should say "Alice" (not "Bob")

### Related Configuration

For reference, here's the complete working configuration:

**Backend config (app/api/chat/config.ts):**
```typescript
import type { Options } from "@anthropic-ai/claude-agent-sdk";

const SYSTEM_PROMPT = `You are a helpful AI assistant.`;

export const agentOptions: Options = {
  maxTurns: 50,
  cwd: "/Users/gang/git-projects/claude-agents-ts/app/api/chat/workspace",
  permissionMode: "default",
  model: "haiku",
  allowedTools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash"],
  systemPrompt: SYSTEM_PROMPT,
  settingSources: ["local"],
  env: process.env,  // Required for Next.js API routes
  // Note: Do NOT use continue: true for multi-user apps
};
```

**Backend API route (app/api/chat/route.ts):**
```typescript
const { messages, sessionId } = await req.json();

const options = {
  ...agentOptions,
  ...(sessionId && { resume: sessionId }),  // Resume specific session
};
```

**Frontend (components/chat-interface.tsx):**
```typescript
const [sessionId, setSessionId] = useState<string | null>(null);

// Extract from first system message
if (message.type === "system" && message.subtype === "init" && !sessionId) {
  setSessionId(message.session_id);
}

// Send with sessionId
const requestBody = {
  messages: [{ role: "user", content: userInput }],
  ...(sessionId && { sessionId }),
};
```

### Production Considerations

For production deployment with persistent sessions across page reloads:

1. **Store session ID in database** instead of React state:
   ```typescript
   // After extracting session_id
   await db.saveSession(userId, sessionId);
   ```

2. **Load session ID on page load:**
   ```typescript
   useEffect(() => {
     const loadSession = async () => {
       const savedSessionId = await db.getSession(userId);
       setSessionId(savedSessionId);
     };
     loadSession();
   }, [userId]);
   ```

3. **Implement session management:**
   - Store multiple sessions per user (conversation history)
   - Allow users to create new conversations
   - Implement session cleanup/expiration
   - Add "Clear conversation" button to create fresh session

---

*Last Updated: 2025-11-06*
