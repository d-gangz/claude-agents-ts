/**
 * Session logging system for Claude Agent SDK interactions, capturing exchanges in JSONL format.
 *
 * Input data sources: Claude Agent SDK streaming messages (system, assistant, user, result)
 * Output destinations: /sessions/*.jsonl files (one per session)
 * Dependencies: Node.js fs module, path module
 * Key exports: createSessionLogger()
 * Side effects: Creates JSONL files in sessions directory, appends to files
 */

import fs from "fs";
import path from "path";

/**
 * Options for configuring the session logger
 */
interface SessionLoggerOptions {
  sessionsDir?: string; // Default: "./sessions"
}

/**
 * Internal message structure stored in exchange buffer
 */
interface Message {
  source: "assistant" | "tool";
  type: "text" | "tool_use" | "result";
  ts: string;
  // Text message fields
  text?: string;
  // Tool use fields
  tool_use_id?: string;
  name?: string;
  input?: Record<string, unknown>;
  // Tool result fields
  is_error?: boolean;
  output?: string;
}

/**
 * SDK Message Types (flexible to handle all SDK message variants)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SDKMessage = any;

/**
 * Statistics for a single exchange
 */
interface ExchangeStats {
  num_turns: number;
  duration_ms: number;
  duration_api_ms?: number;
  tokens_in: number;
  tokens_out: number;
  cache_creation: number;
  cache_read: number;
  cost_usd: number;
}

/**
 * Create a session logger instance.
 *
 * @param options - Configuration options
 * @returns Logger object with methods to log SDK messages
 */
export function createSessionLogger(options?: SessionLoggerOptions) {
  // Private state via closures
  const sessionsDir = options?.sessionsDir || "./sessions";
  let sessionId = "";
  let filePath = "";
  let exchangeCount = 0;
  let currentMessages: Message[] = [];
  let currentUserInput = "";
  let exchangeStartTs = "";

  // Session-level aggregation
  let totalDurationMs = 0;
  let totalDurationApiMs = 0;
  let totalCostUsd = 0;
  let lastExchangeTokens = {
    input: 0,
    output: 0,
    cache_creation: 0,
    cache_read: 0,
  };
  const toolsUsed: Record<string, number> = {};

  // Session metadata
  let sessionModel = "";
  let sessionCwd = "";
  let sessionTools: string[] = [];
  let sessionPermissionMode = "default";

  /**
   * Ensure sessions directory exists
   */
  function ensureSessionsDir() {
    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
    }
  }

  /**
   * Append a line to the JSONL file
   */
  function appendLine(data: Record<string, unknown>) {
    if (!filePath) return;
    const line = JSON.stringify(data) + "\n";
    fs.appendFileSync(filePath, line, "utf-8");
  }

  /**
   * Generate ISO timestamp
   */
  function getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Find existing session file by session_id
   */
  function findExistingSessionFile(sessionId: string): string | null {
    ensureSessionsDir();
    const files = fs.readdirSync(sessionsDir);
    const sessionIdShort = sessionId.substring(0, 8);

    // Look for files matching pattern: *_<sessionid_short>.jsonl
    for (const file of files) {
      if (file.endsWith(`_${sessionIdShort}.jsonl`)) {
        return path.join(sessionsDir, file);
      }
    }
    return null;
  }

  /**
   * Read the last exchange number from an existing file
   */
  function getLastExchangeNumber(filePath: string): number {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.trim().split("\n");

      let maxExchange = 0;
      for (const line of lines) {
        const parsed = JSON.parse(line);
        if (parsed.type === "exchange" && parsed.exchange) {
          maxExchange = Math.max(maxExchange, parsed.exchange);
        }
      }
      return maxExchange;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Load previous session stats from existing file
   */
  function loadPreviousSessionStats(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.trim().split("\n");

      // Find the last session_end line to get accumulated stats
      for (let i = lines.length - 1; i >= 0; i--) {
        const parsed = JSON.parse(lines[i]);
        if (parsed.type === "session_end") {
          // Load accumulated stats
          totalDurationMs = parsed.total_duration_ms || 0;
          totalDurationApiMs = parsed.total_duration_api_ms || 0;
          totalCostUsd = parsed.total_cost_usd || 0;
          lastExchangeTokens = parsed.total_tokens || { input: 0, output: 0, cache_creation: 0, cache_read: 0 };

          // Load tools_used
          if (parsed.tools_used) {
            Object.assign(toolsUsed, parsed.tools_used);
          }
          break;
        }
      }
    } catch {
      // Ignore errors, start fresh
    }
  }

  /**
   * Handle system initialization message
   */
  function handleSystemMessage(message: SDKMessage) {
    sessionId = message.session_id || "";
    sessionModel = message.model || "";
    sessionCwd = message.cwd || "";
    sessionTools = message.tools || [];
    sessionPermissionMode = message.permissionMode || "default";

    ensureSessionsDir();

    // Check if a file already exists for this session_id
    const existingFile = findExistingSessionFile(sessionId);

    if (existingFile) {
      // Use existing file (append mode - don't write session_start again)
      filePath = existingFile;
      // Continue from the last exchange number
      exchangeCount = getLastExchangeNumber(existingFile);
      // Load previous stats to continue accumulating
      loadPreviousSessionStats(existingFile);
      // Remove the old session_end so we can append new exchanges
      removeLastSessionEnd();
    } else {
      // Create new file with timestamp
      const timestamp = new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .replace("T", "_")
        .substring(0, 15); // "20251107_084532"
      const sessionIdShort = sessionId.substring(0, 8);
      const filename = `${timestamp}_${sessionIdShort}.jsonl`;

      filePath = path.join(sessionsDir, filename);

      // Write session_start line only for new files
      appendLine({
        type: "session_start",
        session_id: sessionId,
        ts: getTimestamp(),
        model: sessionModel,
        cwd: sessionCwd,
        tools_available: sessionTools,
        permission_mode: sessionPermissionMode,
      });
    }
  }

  /**
   * Handle assistant message (text or tool use)
   */
  function handleAssistantMessage(message: SDKMessage) {
    if (!message.message?.content) return;

    const content = message.message.content;
    const ts = getTimestamp();

    for (const block of content) {
      if (block.type === "text" && block.text) {
        // Text block
        currentMessages.push({
          source: "assistant",
          type: "text",
          text: block.text,
          ts,
        });
      } else if (block.type === "tool_use" && block.id && block.name) {
        // Tool use block
        currentMessages.push({
          source: "assistant",
          type: "tool_use",
          tool_use_id: block.id,
          name: block.name,
          input: block.input,
          ts,
        });

        // Track tool usage
        if (!toolsUsed[block.name]) {
          toolsUsed[block.name] = 0;
        }
        toolsUsed[block.name]++;
      }
    }
  }

  /**
   * Handle user message (tool results)
   */
  function handleUserMessage(message: SDKMessage) {
    if (!message.message?.content) return;

    const content = message.message.content;
    const ts = getTimestamp();

    for (const block of content) {
      if (block.type === "tool_result" && block.tool_use_id) {
        currentMessages.push({
          source: "tool",
          type: "result",
          tool_use_id: block.tool_use_id,
          is_error: block.is_error || false,
          output: typeof block.content === "string" ? block.content : JSON.stringify(block.content),
          ts,
        });
      }
    }
  }

  /**
   * Handle result message (exchange completion)
   */
  function handleResultMessage(message: SDKMessage) {
    const tsEnd = getTimestamp();

    // Extract stats
    const stats: ExchangeStats = {
      num_turns: message.num_turns || 0,
      duration_ms: message.duration_ms || 0,
      duration_api_ms: message.duration_api_ms,
      tokens_in: message.usage?.input_tokens || 0,
      tokens_out: message.usage?.output_tokens || 0,
      cache_creation: message.usage?.cache_creation_input_tokens || 0,
      cache_read: message.usage?.cache_read_input_tokens || 0,
      cost_usd: message.total_cost_usd || 0,
    };

    // Build exchange object
    const exchange = {
      type: "exchange",
      session_id: sessionId,
      exchange: exchangeCount,
      ts_start: exchangeStartTs,
      ts_end: tsEnd,
      user_input: currentUserInput,
      messages: currentMessages,
      stats,
    };

    // Write exchange to JSONL
    appendLine(exchange);

    // Aggregate session stats
    totalDurationMs += stats.duration_ms;
    totalDurationApiMs += stats.duration_api_ms || 0;
    totalCostUsd += stats.cost_usd;

    // Replace tokens with last exchange (not summed)
    lastExchangeTokens = {
      input: stats.tokens_in,
      output: stats.tokens_out,
      cache_creation: stats.cache_creation,
      cache_read: stats.cache_read,
    };

    // Reset exchange buffer
    currentMessages = [];
    currentUserInput = "";
    exchangeStartTs = "";
  }

  /**
   * Public API: Log any message from the SDK
   */
  function log(message: SDKMessage): void {
    if (!message || !message.type) return;

    switch (message.type) {
      case "system":
        if (message.subtype === "init") {
          handleSystemMessage(message);
        }
        break;

      case "assistant":
        handleAssistantMessage(message);
        break;

      case "user":
        handleUserMessage(message);
        break;

      case "result":
        handleResultMessage(message);
        break;

      default:
        // Ignore unknown message types
        break;
    }
  }

  /**
   * Public API: Log user input to start a new exchange
   */
  function logUserInput(userText: string): void {
    exchangeCount++;
    exchangeStartTs = getTimestamp();
    currentUserInput = userText;
  }

  /**
   * Remove the last session_end line if it exists
   */
  function removeLastSessionEnd(): void {
    if (!filePath || !fs.existsSync(filePath)) return;

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.trim().split("\n");

      // Check if last line is session_end
      if (lines.length > 0) {
        const lastLine = lines[lines.length - 1];
        const parsed = JSON.parse(lastLine);

        if (parsed.type === "session_end") {
          // Remove the last line and rewrite the file
          const newContent = lines.slice(0, -1).join("\n") + "\n";
          fs.writeFileSync(filePath, newContent, "utf-8");
        }
      }
    } catch {
      // Ignore errors, just append new session_end
    }
  }

  /**
   * Public API: Close the session and write session_end
   */
  function close(): void {
    if (!filePath) return;

    // Append new session_end with latest stats
    appendLine({
      type: "session_end",
      session_id: sessionId,
      ts: getTimestamp(),
      total_exchanges: exchangeCount,
      total_duration_ms: totalDurationMs,
      total_duration_api_ms: totalDurationApiMs,
      total_cost_usd: totalCostUsd,
      total_tokens: lastExchangeTokens,
      tools_used: toolsUsed,
    });
  }

  // Return public API
  return {
    log,
    logUserInput,
    close,
  };
}
