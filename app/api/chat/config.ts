/**
 * Shared configuration for Claude Agent SDK query options used by both agent.ts and route.ts.
 *
 * Input data sources: None
 * Output destinations: Used by agent.ts and route.ts
 * Dependencies: @anthropic-ai/claude-agent-sdk types
 * Key exports: agentOptions
 * Side effects: None
 */

import type { Options } from "@anthropic-ai/claude-agent-sdk";

/**
 * Shared query options for Claude Agent
 * Reference: https://docs.anthropic.com/claude/docs/agent-sdk/reference
 */
const SYSTEM_PROMPT = `You are a helpful AI assistant. You can help with general questions and tasks.
    
    <Important>Always create new files in the working directory. Do not create in 'tmp' directory.</Important>`;

export const agentOptions: Options = {
  // Maximum conversation turns before stopping
  maxTurns: 50,

  // Working directory for agent operations
  cwd: "/Users/gang/git-projects/claude-agents-ts/app/api/chat/workspace",

  // Permission mode - bypass for non-interactive usage
  permissionMode: "default",

  // Model selection
  model: "haiku",

  // Limit which tools the agent can use
  allowedTools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash"],

  // Custom system prompt appended to Claude Code's default
  systemPrompt: SYSTEM_PROMPT,

  // Load filesystem settings from project
  settingSources: ["local"],

  // Pass environment explicitly for Next.js API routes (fixes spawn ENOENT)
  env: process.env,

  // Optional: Disable specific tools
  disallowedTools: ["NotebookEdit", "Skill", "SlashCommand"],

  // Optional: Maximum tokens for thinking process
  // maxThinkingTokens: 10000,

  // Optional: Include partial message events for streaming UI
  // includePartialMessages: false,

  // Optional: Configure MCP servers
  // mcpServers: {},

  // Optional: Define programmatic subagents
  // agents: {},
};
