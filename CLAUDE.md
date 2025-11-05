# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Next.js application integrating Claude Agent SDK for AI agents with tool-calling capabilities. Supports both web-based (Next.js API routes) and CLI-based interfaces, with optional Braintrust tracing.

## Commands

```bash
# Development (use npm, NOT bun for running)
npm run dev

# Production
npm run build
npm run start

# CLI Agents (MUST use tsx/Node.js, NOT bun)
npx tsx app/api/chat/agent.ts              # Basic interactive agent
npx tsx app/api/chat/agent-braintrust.ts   # Agent with Braintrust tracing

# Linting
npm run lint
```

## Architecture

### High-Level Structure

1. **`app/api/chat/config.ts`** - Shared agent configuration
   - Used by both API routes and CLI scripts
   - Defines model, tools, permissions, working directory, system prompt

2. **`app/api/chat/route.ts`** - Next.js streaming API endpoint (`/api/chat`)
   - Accepts POST with messages array
   - Returns NDJSON streaming responses

3. **`app/api/chat/agent.ts`** - Basic CLI agent
   - Interactive terminal interface using readline
   - Multi-turn conversations with streaming responses

4. **`app/api/chat/agent-braintrust.ts`** - CLI agent with tracing
   - Same as agent.ts but wraps SDK with Braintrust for observability
   - Requires `BRAINTRUST_API_KEY` in `.env.local`

### Key Architectural Pattern

All implementations use **streaming input mode** with async generators that yield user messages and receive SDK responses. The generator maintains conversation state through `session_id: ""` (empty string = current session).

## Critical Requirements

### Runtime: Node.js Only (NOT Bun)

**The Claude Agent SDK is incompatible with Bun.** Always use Node.js runtime:
- CLI scripts: Use `npx tsx` (NOT `bun run`)
- Production: Use `npm run` (NOT `bun run`)
- Development: Prefer `npm run dev` for reliability

**Why?** SDK uses Node.js-specific APIs that Bun doesn't fully support. See `learnings/ccsdk-learnings.md` for details.

### Environment Variables

Required in `.env.local`:
- `ANTHROPIC_API_KEY` - Required for all agent operations
- `BRAINTRUST_API_KEY` - Required only for tracing variant

CLI scripts require explicit dotenv loading: `dotenv.config({ path: ".env.local" })`

### Agent Configuration

Modify `app/api/chat/config.ts` to change:
- Model selection (`haiku`, `sonnet`, `opus`)
- Allowed tools
- Permission mode (`default` or `bypassPermissions`)
- Working directory (agent writes files here)
- System prompt

## Reference

- SDK Documentation: https://docs.anthropic.com/claude/docs/agent-sdk/reference
- Troubleshooting: `learnings/ccsdk-learnings.md`
