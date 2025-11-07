<!--
Document Type: Implementation Plan
Purpose: Session logging system for Claude Agent SDK interactions in TypeScript
Context: Created for tracking multi-exchange agent conversations with detailed exchange-level and session-level statistics
Key Topics: JSONL storage format, TypeScript SDK message types, session tracking, CLI and Web API integration, exchange vs turn terminology
Target Use: Implementation guide for adding session logging to both CLI and web-based agents
-->

# Session Logger Implementation Plan

## Overview

Create a reusable session logging system that captures Claude Agent SDK interactions in JSONL format. The system will work for both CLI agent (`agent.ts`) and web API route (`route.ts`) with minimal integration effort.

### Terminology Clarification

- **Exchange**: One complete user interaction (user input → AI processing → result). This is the user-facing unit.
- **Turn**: Internal AI processing cycle within an exchange. One exchange can have multiple turns (shown in `num_turns` field).
- Example: User asks "write a poem" → Turn 1: AI thinks → Turn 2: AI uses Write tool → Turn 3: AI confirms = 1 Exchange with 3 Turns

---

## 1. Raw Data Structure (What We're Capturing)

### Current Output From TypeScript SDK

The SDK returns different message types during a conversation:

```typescript
// Session initialization
{
  "type": "system",
  "subtype": "init",
  "session_id": "1f320356-a178-418e-a692-69ce6e1e657c",
  "model": "claude-haiku-4-5-20251001",
  "cwd": "/Users/gang/git-projects/claude-agents-ts/app/api/chat/workspace",
  "tools": ["Task", "Bash", "Read", "Write", ...]
}

// Assistant text response
{
  "type": "assistant",
  "session_id": "1f320356-a178-418e-a692-69ce6e1e657c",
  "message": {
    "model": "claude-haiku-4-5-20251001",
    "id": "msg_014SwosscSLqkfa4m2UANuGM",
    "role": "assistant",
    "content": [
      {
        "type": "text",
        "text": "I'll help you write a poem and save it as poem.md..."
      }
    ],
    "usage": {
      "input_tokens": 3,
      "cache_creation_input_tokens": 11530,
      "cache_read_input_tokens": 0,
      "output_tokens": 1
    }
  }
}

// Assistant tool use
{
  "type": "assistant",
  "message": {
    "content": [
      {
        "type": "tool_use",
        "id": "toolu_017MwgSsKgEc9rWGrcFKvhAs",
        "name": "Write",
        "input": {
          "file_path": "...",
          "content": "..."
        }
      }
    ]
  }
}

// Tool result
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {
        "tool_use_id": "toolu_017MwgSsKgEc9rWGrcFKvhAs",
        "type": "tool_result",
        "content": "File created successfully..."
      }
    ]
  }
}

// Exchange completion (result message)
{
  "type": "result",
  "subtype": "success",
  "is_error": false,
  "duration_ms": 6901,
  "duration_api_ms": 14317,
  "num_turns": 2,              // Number of internal turns within this exchange
  "result": "Perfect! I've created a poem...",
  "session_id": "1f320356-a178-418e-a692-69ce6e1e657c",
  "total_cost_usd": 0.004965,
  "usage": {
    "input_tokens": 9,
    "cache_creation_input_tokens": 11903,
    "cache_read_input_tokens": 11530,
    "output_tokens": 444
  }
}
```

---

## 2. JSONL Format (Hybrid Exchange-Based Structure)

### File Structure

```
claude-agents-ts/
├── sessions/                    # Sessions storage
│   ├── .gitkeep                # Keep folder in repo
│   ├── 20251107_084532_1f320356.jsonl
│   └── 20251107_091245_8a9e4f21.jsonl
├── lib/
│   └── session-logger.ts       # Shared session logging library
└── app/api/chat/
    ├── agent.ts                # CLI agent (uses logger)
    └── route.ts                # Web API (uses logger)
```

### JSONL Schema (Each line is one JSON object)

**Line 1: Session Start**

```json
{
  "type": "session_start",
  "session_id": "1f320356-a178-418e-a692-69ce6e1e657c",
  "ts": "2025-11-07T08:45:32Z",
  "model": "claude-haiku-4-5-20251001",
  "cwd": "/Users/gang/git-projects/claude-agents-ts/app/api/chat/workspace",
  "tools_available": ["Bash", "Read", "Write", "Edit", "Task"],
  "permission_mode": "default"
}
```

**Line 2+: Each Exchange**

```json
{
  "type": "exchange",
  "session_id": "1f320356-a178-418e-a692-69ce6e1e657c",
  "exchange": 1,
  "ts_start": "2025-11-07T08:45:35Z",
  "ts_end": "2025-11-07T08:45:42Z",
  "user_input": "help me write a poem and name the file as poem.md",
  "messages": [
    {
      "source": "assistant",
      "type": "text",
      "text": "I'll help you write a poem and save it as poem.md...",
      "ts": "2025-11-07T08:45:36Z"
    },
    {
      "source": "assistant",
      "type": "tool_use",
      "tool_use_id": "toolu_017Mw",
      "name": "Write",
      "input": {
        "file_path": "poem.md",
        "content": "# A Poem..."
      },
      "ts": "2025-11-07T08:45:37Z"
    },
    {
      "source": "tool",
      "type": "result",
      "tool_use_id": "toolu_017Mw",
      "is_error": false,
      "output": "File created successfully...",
      "ts": "2025-11-07T08:45:40Z"
    },
    {
      "source": "assistant",
      "type": "text",
      "text": "Perfect! I've created a poem for you...",
      "ts": "2025-11-07T08:45:42Z"
    }
  ],
  "stats": {
    "num_turns": 2,
    "duration_ms": 6901,
    "duration_api_ms": 14317,
    "tokens_in": 9,
    "tokens_out": 444,
    "cache_creation": 11903,
    "cache_read": 11530,
    "cost_usd": 0.004965
  }
}
```

**Last Line: Session End**

```json
{
  "type": "session_end",
  "session_id": "1f320356-a178-418e-a692-69ce6e1e657c",
  "ts": "2025-11-07T08:50:15Z",
  "total_exchanges": 3,
  "total_duration_ms": 18250,
  "total_duration_api_ms": 35480,
  "total_cost_usd": 0.012845,
  "total_tokens": {
    "input": 25,
    "output": 1250,
    "cache_creation": 23500,
    "cache_read": 45600
  },
  "tools_used": {
    "Write": 2,
    "Read": 1,
    "Bash": 3
  }
}
```

**Session Aggregation Strategy:**

- `total_exchanges`: Count of user interactions (taken from last exchange's `num_turns` or tracked internally)
- `total_duration_ms`: **Sum** of all exchanges' `duration_ms`
- `total_duration_api_ms`: **Sum** of all exchanges' `duration_api_ms`
- `total_cost_usd`: **Sum** of all exchanges' `cost_usd`
- `total_tokens`: **From LAST exchange ONLY** (not summed, because SDK maintains conversation history and later exchanges include context from earlier ones via cache_read)
- `tools_used`: **Cumulative** count across all exchanges

---

## 3. Implementation Components

### 3.1 Create `lib/session-logger.ts`

**Location:** `/lib/session-logger.ts`

**Purpose:** Reusable session logging that works for any agent. The logger automatically buffers messages and writes complete exchanges to JSONL.

**Core Design Philosophy:**

- **Simple API**: Just call `logger.log(message)` for every message from the SDK
- **Manual user input**: Call `logger.logUserInput(text)` before sending to SDK
- **Auto-detection**: Logger automatically detects exchange boundaries (when `ResultMessage` arrives)
- **Exchange-based JSONL**: Each JSONL row represents one complete exchange (user input → AI processing with N turns → result)
- **No manual tracking**: Logger handles all buffering and aggregation internally

**Key TypeScript Types:**

```typescript
interface SessionLoggerOptions {
  sessionsDir?: string; // Default: "./sessions"
}

interface Message {
  source: "assistant" | "tool";
  type: "text" | "tool_use" | "result";
  ts: string;
  // Type-specific fields
  text?: string;
  tool_use_id?: string;
  name?: string;
  input?: any;
  is_error?: boolean;
  output?: string;
}

interface ExchangeStats {
  num_turns: number;        // Number of internal turns within this exchange
  duration_ms: number;
  duration_api_ms?: number;
  tokens_in: number;
  tokens_out: number;
  cache_creation: number;
  cache_read: number;
  cost_usd: number;
}
```

**Key Class Methods:**

```typescript
class SessionLogger {
  /**
   * Initialize logger.
   *
   * @param options - Configuration options
   */
  constructor(options?: SessionLoggerOptions);

  /**
   * Log any message from the SDK. Automatically handles exchange boundaries.
   *
   * This is the main method you call from agent code!
   *
   * @param message - Any message type from claude-agent-sdk
   */
  log(message: any): void;

  /**
   * Manually log user input to start a new exchange.
   *
   * Call this right before sending the message to the SDK.
   *
   * @param userText - The user's input text
   */
  logUserInput(userText: string): void;

  /**
   * Call when session ends to write session_end line.
   */
  close(): void;
}
```

**Internal Implementation Logic:**

1. **Session Initialization (`type: "system"`)**
   - Extract `session_id`, `model`, `cwd`, `tools`
   - Create file: `sessions/YYYYMMDD_HHMMSS_<sessionid>.jsonl`
   - Write `session_start` line

2. **User Input (Manual `logUserInput()` call)**
   - Start new exchange tracking
   - Increment exchange counter
   - Set `exchange_start_ts`
   - Buffer user input text

3. **Assistant Message (`type: "assistant"`)**
   - Parse `message.content` array
   - For `TextBlock`: Add text message to buffer
   - For `ToolUseBlock`: Add tool_use message to buffer, track tool usage
   - Buffer all messages within the current exchange

4. **Tool Result (`type: "user"` with `ToolResultBlock`)**
   - Parse tool results from `message.content`
   - Buffer as tool result messages

5. **Exchange Completion (`type: "result"`)**
   - Extract stats: `duration_ms`, `duration_api_ms`, `num_turns`, `total_cost_usd`, `usage`
   - Build complete exchange object with all buffered messages
   - Write exchange to JSONL
   - Aggregate session-level totals:
     - Sum: `duration_ms`, `duration_api_ms`, `cost_usd`
     - Replace: `total_tokens` (use current exchange's tokens)
     - Accumulate: `tools_used` counts
   - Reset exchange buffer

6. **Session Close (`close()` method)**
   - Write `session_end` line with aggregated stats

**File Naming:**

```typescript
// Format: YYYYMMDD_HHMMSS_<session_id_short>.jsonl
const timestamp = new Date().toISOString()
  .replace(/[-:]/g, '')
  .replace('T', '_')
  .substring(0, 15); // "20251107_084532"
const sessionIdShort = sessionId.substring(0, 8);
const filename = `${timestamp}_${sessionIdShort}.jsonl`;
```

### 3.2 Integration in `app/api/chat/agent.ts`

**Simple Integration Pattern:**

```typescript
import { SessionLogger } from "@/lib/session-logger";

async function main() {
  // Initialize logger (only once at start)
  const logger = new SessionLogger();

  try {
    // Start the streaming agent
    for await (const message of query({
      prompt: generateMessages(),
      options: agentOptions,
    })) {
      // Log every message
      logger.log(message);

      // Display to console
      console.log(chalk.cyan("\n═══════════ MESSAGE ═══════════"));
      console.log(JSON.stringify(message, null, 2));
      console.log(chalk.cyan("═══════════════════════════════════\n"));
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    // Always close logger
    logger.close();
  }
}

// In the generateMessages() function:
async function* generateMessages(): AsyncGenerator<SDKUserMessage, void, unknown> {
  while (true) {
    const userMessage = await new Promise<string>((resolve) => {
      rl.question(`\n${chalk.cyan.bold("You:")} `, (answer) => {
        resolve(answer);
      });
    });

    // Check for exit
    if (userMessage.toLowerCase() === "exit" || userMessage.toLowerCase() === "quit") {
      console.log(`\n${chalk.yellow("Goodbye!")}\n`);
      rl.close();
      process.exit(0);
    }

    // Skip empty
    if (!userMessage.trim()) {
      continue;
    }

    // Log user input BEFORE yielding
    logger.logUserInput(userMessage);

    // Yield the message
    yield {
      type: "user" as const,
      session_id: "",
      message: {
        role: "user" as const,
        content: userMessage,
      },
      parent_tool_use_id: null,
    };
  }
}
```

**Key Points:**
- Initialize logger once before the main loop
- Call `logger.logUserInput()` before yielding user message
- Call `logger.log()` for every streamed message
- Call `logger.close()` in finally block

### 3.3 Integration in `app/api/chat/route.ts`

**Integration Pattern:**

```typescript
import { SessionLogger } from "@/lib/session-logger";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequestBody;

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Initialize logger
        const logger = new SessionLogger();

        try {
          // Async generator for messages
          async function* generateMessages(): AsyncGenerator<SDKUserMessage, void, unknown> {
            // Yield all user messages from the request
            for (const msg of body.messages) {
              if (msg.role === "user") {
                // Log user input BEFORE yielding
                logger.logUserInput(msg.content);

                yield {
                  type: "user" as const,
                  session_id: "",
                  message: {
                    role: "user" as const,
                    content: msg.content,
                  },
                  parent_tool_use_id: null,
                };
              }
            }
          }

          // Build options with optional session resume
          const options = {
            ...agentOptions,
            ...(body.sessionId && { resume: body.sessionId }),
          };

          // Stream Claude Agent responses
          for await (const message of query({
            prompt: generateMessages(),
            options,
          })) {
            // Log every message
            logger.log(message);

            // Stream to client
            const chunk = JSON.stringify(message) + "\n";
            controller.enqueue(encoder.encode(chunk));

            // Complete on result message
            if (message.type === "result") {
              break;
            }
          }

          // Close logger
          logger.close();
          controller.close();
        } catch (error) {
          logger.close(); // Always close on error
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: "error", error: errorMessage }) + "\n")
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    // Handle outer errors
  }
}
```

**Key Points:**
- Initialize logger inside the `start()` function
- Call `logger.logUserInput()` before yielding each user message
- Call `logger.log()` for every streamed message
- Call `logger.close()` in both success and error paths

### 3.4 Create `/sessions/.gitkeep`

Create an empty `.gitkeep` file to ensure the sessions directory exists in the repo.

### 3.5 Update `/.gitignore`

Add the following line to ignore actual session logs:

```
# Session logs
/sessions/*.jsonl
```

This ensures the `/sessions` folder exists but actual log files are not committed.

---

## 4. Message Type Parsing Details

### System Message (`type: "system"`)

```typescript
interface SystemMessage {
  type: "system";
  subtype: "init";
  session_id: string;
  model: string;
  cwd: string;
  tools: string[];
  permissionMode?: string;
  // ... other fields
}
```

**Handler:**
- Extract session metadata
- Create session file with timestamp prefix
- Write `session_start` line

### Assistant Message (`type: "assistant"`)

```typescript
interface AssistantMessage {
  type: "assistant";
  session_id: string;
  message: {
    model: string;
    id: string;
    role: "assistant";
    content: Array<TextBlock | ToolUseBlock>;
    usage: {
      input_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
      output_tokens: number;
      // ... other fields
    };
  };
}

interface TextBlock {
  type: "text";
  text: string;
}

interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: any;
}
```

**Handler:**
- Iterate through `message.content` array
- For `TextBlock`: Create text exchange
- For `ToolUseBlock`: Create tool_use exchange, increment `tools_used[name]`
- Buffer all exchanges with timestamps

### User Message (`type: "user"`)

```typescript
interface UserMessage {
  type: "user";
  session_id: string;
  message: {
    role: "user";
    content: Array<ToolResultBlock>;
  };
}

interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
}
```

**Handler:**
- Iterate through `message.content` array
- For `ToolResultBlock`: Create tool result exchange
- Buffer exchanges

### Result Message (`type: "result"`)

```typescript
interface ResultMessage {
  type: "result";
  subtype: "success" | "error";
  is_error: boolean;
  duration_ms: number;
  duration_api_ms?: number;
  num_turns: number;
  session_id: string;
  total_cost_usd: number;
  usage: {
    input_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
    output_tokens: number;
  };
}
```

**Handler:**
- Extract exchange stats including `num_turns`
- Build exchange data object with buffered messages
- Write exchange line to JSONL
- Aggregate session totals (sum durations/costs, replace tokens, accumulate tool counts)
- Reset exchange buffer

---

## 5. Cost Calculation

Based on Claude pricing (adjust rates as needed):

```typescript
function calculateCost(usage: any): number {
  const inputTokens = usage.input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;
  const cacheCreation = usage.cache_creation_input_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;

  // Example rates (USD per 1M tokens)
  const RATE_INPUT = 3.00 / 1_000_000;      // $3 per 1M
  const RATE_OUTPUT = 15.00 / 1_000_000;    // $15 per 1M
  const RATE_CACHE_WRITE = 3.75 / 1_000_000; // 25% markup
  const RATE_CACHE_READ = 0.30 / 1_000_000;  // 10% of input

  return (
    inputTokens * RATE_INPUT +
    outputTokens * RATE_OUTPUT +
    cacheCreation * RATE_CACHE_WRITE +
    cacheRead * RATE_CACHE_READ
  );
}
```

Note: The TypeScript SDK already provides `total_cost_usd` in the `result` message, so we can use that directly instead of calculating manually.

---

## 6. Usage Examples

### Starting a Session (Automatic)

When a user starts chatting, `SessionLogger` automatically:
1. Detects session start from first `type: "system"` message
2. Creates file: `sessions/20251107_084532_1f320356.jsonl`
3. Writes `session_start` line

### Logging During Conversation

```typescript
// User types: "help me write a poem"
logger.logUserInput("help me write a poem");

// SDK streams messages
for await (const message of query(...)) {
  logger.log(message); // Buffers messages within exchange

  if (message.type === "result") {
    // Logger auto-writes complete exchange to JSONL
    // Exchange may contain multiple turns (shown in num_turns field)
  }
}
```

### Ending a Session

```typescript
// User types: "exit"
logger.close(); // Writes session_end line
```

### Expected JSONL Output

```jsonl
{"type":"session_start","session_id":"1f320356-a178-418e-a692-69ce6e1e657c","ts":"2025-11-07T08:45:32Z","model":"claude-haiku-4-5-20251001","cwd":"/Users/gang/git-projects/claude-agents-ts/app/api/chat/workspace","tools_available":["Bash","Read","Write"],"permission_mode":"default"}
{"type":"exchange","session_id":"1f320356-a178-418e-a692-69ce6e1e657c","exchange":1,"ts_start":"2025-11-07T08:45:35Z","ts_end":"2025-11-07T08:45:42Z","user_input":"help me write a poem","messages":[{"source":"assistant","type":"text","text":"I'll help you...","ts":"2025-11-07T08:45:36Z"},{"source":"assistant","type":"tool_use","tool_use_id":"toolu_017Mw","name":"Write","input":{...},"ts":"2025-11-07T08:45:37Z"}],"stats":{"num_turns":2,"duration_ms":6901,"duration_api_ms":14317,"tokens_in":9,"tokens_out":444,"cache_creation":11903,"cache_read":11530,"cost_usd":0.004965}}
{"type":"session_end","session_id":"1f320356-a178-418e-a692-69ce6e1e657c","ts":"2025-11-07T08:50:15Z","total_exchanges":3,"total_duration_ms":18250,"total_duration_api_ms":35480,"total_cost_usd":0.012845,"total_tokens":{"input":25,"output":1250,"cache_creation":23500,"cache_read":45600},"tools_used":{"Write":2,"Bash":1}}
```

---

## 7. Implementation Checklist

- [ ] Create `/lib/session-logger.ts` with `SessionLogger` class
- [ ] Implement message type handlers (system, assistant, user, result)
- [ ] Implement exchange buffering and JSONL writing
- [ ] Implement session-level aggregation with correct strategy:
  - [ ] Sum: `duration_ms`, `duration_api_ms`, `cost_usd`
  - [ ] Replace with last: `total_tokens`
  - [ ] Accumulate: `tools_used`
  - [ ] Track: `total_exchanges` counter
- [ ] Add TypeScript type definitions (`Message`, `ExchangeStats`)
- [ ] Update `/app/api/chat/agent.ts` to use logger
- [ ] Update `/app/api/chat/route.ts` to use logger
- [ ] Create `/sessions/.gitkeep`
- [ ] Update `/.gitignore` to ignore session logs
- [ ] Test with CLI agent
- [ ] Test with web API
- [ ] Verify JSONL format matches schema (type: "exchange", "messages" array, "num_turns" in stats)

---

## 8. Unresolved Questions

1. **Cost calculation rates**: Use SDK-provided `total_cost_usd` (simpler, more accurate) ✓
2. **Braintrust variant**: Should `app/api/chat/agent-braintrust.ts` use the same logger or separate handling?
3. **Session resume**: When `body.sessionId` is provided in web API, should we append to existing session file or create new file?
4. **Error handling**: How should we handle file I/O errors during logging? Silent fail, console.error, or throw?
5. **Timestamp format**: Stick with ISO 8601 (`2025-11-07T08:45:32Z`) ✓

## 9. Key Design Decisions (Confirmed)

### Exchange vs Turn Terminology
- **Exchange**: User-facing interaction unit (user input → AI completes task → result)
- **Turn**: Internal AI processing cycles within an exchange (tracked in `num_turns` field)
- JSONL uses `type: "exchange"` with `exchange` counter
- Each exchange's `stats.num_turns` shows internal turn count

### Session Aggregation Strategy
```typescript
// At session end:
{
  total_exchanges: number,           // Count of user interactions
  total_duration_ms: sum(all exchanges),
  total_duration_api_ms: sum(all exchanges),
  total_cost_usd: sum(all exchanges),
  total_tokens: lastExchange.tokens,  // NOT summed! (avoids double-counting context)
  tools_used: cumulative              // Sum across all exchanges
}
```

**Why `total_tokens` is NOT summed:**
The Claude Agent SDK is stateful and maintains conversation history. Later exchanges include earlier messages via `cache_read_input_tokens`. Summing would double/triple count the same tokens. The last exchange's token usage reflects the full context window size.

---

## 10. Next Steps

1. Review plan and answer remaining unresolved questions
2. Implement `/lib/session-logger.ts` with:
   - Exchange-based buffering (not turn-based)
   - Correct session aggregation (sum durations/costs, last exchange's tokens only)
   - `Message` interface for buffered content
   - `ExchangeStats` interface with `num_turns` field
3. Integrate into CLI agent (`app/api/chat/agent.ts`)
4. Integrate into web API (`app/api/chat/route.ts`)
5. Test end-to-end with real conversations
6. Verify JSONL output matches schema
7. Optional: Add viewer utility later if needed
