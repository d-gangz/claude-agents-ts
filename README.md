# Claude Agents

Next.js application integrating the [Claude Agent SDK](https://docs.anthropic.com/claude/docs/agent-sdk) for building AI agents with tool-calling capabilities.

## Features

- 🤖 **Interactive CLI Agent** - Terminal-based agent interface with streaming responses
- 🌐 **Next.js API Route** - Streaming API endpoint for web-based agent interactions
- 📊 **Braintrust Integration** - Optional observability and tracing for agent operations
- 🔧 **Configurable Tools** - Restrict agent capabilities (Read, Write, Edit, Grep, Glob, Bash)
- 💬 **Multi-turn Conversations** - Automatic session management and history tracking

## Quick Start

### Prerequisites

- Node.js 18+ (required - Bun runtime is not supported)
- Anthropic API key

### Setup

1. Clone and install dependencies:
```bash
npm install
# or
bun install  # For package management only
```

2. Create `.env.local` with your API keys:
```bash
ANTHROPIC_API_KEY=sk-ant-...
BRAINTRUST_API_KEY=sk-...  # Optional, for tracing
```

3. Create the agent workspace directory:
```bash
mkdir -p app/api/chat/workspace
```

## Usage

### Web Application

Start the Next.js development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and use the API endpoint at `/api/chat`.

### CLI Agent

Run the interactive terminal agent:
```bash
# Basic agent
npx tsx app/api/chat/agent.ts

# Agent with Braintrust tracing
npx tsx app/api/chat/agent-braintrust.ts
```

Type your messages and press Enter. Type `exit` or `quit` to end the conversation.

## Configuration

Agent behavior is configured in `app/api/chat/config.ts`:

- **model**: Claude model to use (`haiku`, `sonnet`, `opus`)
- **allowedTools**: Which tools the agent can access
- **permissionMode**: `default` (interactive) or `bypassPermissions` (auto-approve)
- **systemPrompt**: Custom instructions for agent behavior
- **cwd**: Working directory for file operations

## Important: Runtime Compatibility

⚠️ **Use Node.js, not Bun** for running the application:

```bash
# ✅ Correct
npm run dev
npx tsx app/api/chat/agent.ts

# ❌ Incorrect (will fail with SDK errors)
bun run dev
bun run app/api/chat/agent.ts
```

The Claude Agent SDK requires Node.js-specific APIs. Bun can be used for package management (`bun install`, `bun add`) but not for execution.

## Project Structure

```
claude-agents/
├── app/
│   ├── api/
│   │   └── chat/
│   │       ├── config.ts           # Shared agent configuration
│   │       ├── route.ts            # Next.js streaming API endpoint
│   │       ├── agent.ts            # CLI agent (basic)
│   │       ├── agent-braintrust.ts # CLI agent with tracing
│   │       └── workspace/          # Agent working directory
│   ├── layout.tsx
│   └── page.tsx
├── learnings/
│   └── ccsdk-learnings.md          # SDK troubleshooting guide
└── CLAUDE.md                       # Development guide
```

## Learn More

- [Claude Agent SDK Documentation](https://docs.anthropic.com/claude/docs/agent-sdk)
- [Next.js Documentation](https://nextjs.org/docs)
- [Braintrust Documentation](https://www.braintrust.dev/docs)

## Troubleshooting

See `learnings/ccsdk-learnings.md` for common issues and solutions, including:
- Bun vs Node.js compatibility
- Session continuity in streaming mode
- Working directory configuration
- Environment variable setup
