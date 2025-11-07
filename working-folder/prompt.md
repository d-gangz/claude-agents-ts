My goal is to be able to log all the responses of the messages output from the agent itself so that I can craft my own log of what happened within the session itself (like all the user input and the message responses) so I can use it for my analysis down the road.

so would need your help to create like a logger script/functions for it. It should be simple where I just need to import it into my agent script (e.g in `app/api/chat/agent.ts`) and it should start logging it. So all the sessions should be logged in a /sessions folder which is located in the root directory. maybe the logger code you can put it in the /lib folder.

I have implemented this logger but in python before. so here was the reference plan used to implement for my python version. ignore the frontend part. Just do the backend will do which is the logging part.

I also provided the python logger code for your reference.

Refer to `reference/output.md` for how the output looks like for the raw messages based on what I've printed from the claude agent SDK

Analyse all the details, have a discussion conversation with me first. then finally, write the plan into the `.claude/plan folder`.

<reference plan>
<!--
Document Type: Implementation Plan
Purpose: Session logging and viewer implementation for agent interactions
Context: Created for tracking multi-turn agent conversations with detailed turn-level and session-level statistics
Key Topics: JSONL storage format, session tracking, viewer rendering, multi-agent support
Target Use: Implementation guide for junior engineers
-->

# Session Logging & Viewer Implementation Plan

## Overview

Create a reusable session logging system that captures agent interactions in JSONL format and provides a viewer to display conversation history. The system should work across multiple agents (process_agent, future agent2, etc.) with minimal configuration.

---

## 1. Raw Data Structure (What We're Capturing)

### Current Output From Agent

This is what the SDK currently returns:

```python
SystemMessage(
    subtype='init',
    data={
        'session_id': '37d7852b-8630-4c40-a315-c814b90635ec',
        'model': 'claude-haiku-4-5-20251001',
        'cwd': '/Users/gang/git-projects/alixp-agents/process_agent/working-dir',
        'tools': ['Task', 'Bash', 'Read', 'Write', 'Edit']
    }
)

UserMessage(content="maybe u can try running the query.py script?")

AssistantMessage(
    content=[TextBlock(text="I'll try to run the query.py script for you!")],
    model='claude-haiku-4-5-20251001'
)

AssistantMessage(
    content=[
        ToolUseBlock(
            id='toolu_01RyD9nyTaoqb1rzMj8Bj25u',
            name='Bash',
            input={'command': 'python query.py', 'description': 'Run the query.py script'}
        )
    ]
)

UserMessage(
    content=[
        ToolResultBlock(
            tool_use_id='toolu_01RyD9nyTaoqb1rzMj8Bj25u',
            content="Exit code 2\ncan't open file...",
            is_error=True
        )
    ]
)

AssistantMessage(
    content=[TextBlock(text="Looks like the query.py script wasn't found...")]
)

ResultMessage(
    subtype='success',
    duration_ms=8038,
    total_cost_usd=0.00683,
    num_turns=3,
    usage={
        'input_tokens': 16,
        'cache_creation_input_tokens': 752,
        'cache_read_input_tokens': 39582,
        'output_tokens': 364
    }
)
```

---

## 2. Recommended JSONL Format (Option C - Hybrid)

### File Structure

```
alixp-agents/
├── process_agent/
│   ├── agent.py
│   ├── config.py
│   └── sessions/              # Sessions for process_agent
│       ├── 37d7852b.jsonl
│       └── 8a9e4f21.jsonl
├── agent2/                    # Future agent
│   ├── agent.py
│   └── sessions/              # Sessions for agent2
│       └── *.jsonl
├── session.py                 # Shared session logging library
└── viewer.py                  # Session viewer CLI
```

### JSONL Schema (Each line is one JSON object)

**Line 1: Session Start**

```json
{
  "type": "session_start",
  "session_id": "37d7852b-8630-4c40-a315-c814b90635ec",
  "ts": "2025-11-05T08:44:00Z",
  "agent_name": "process_agent",
  "model": "claude-haiku-4-5-20251001",
  "cwd": "/Users/gang/git-projects/alixp-agents/process_agent/working-dir",
  "tools_available": ["Bash", "Read", "Write", "Edit"]
}
```

**Line 2+: Each Turn**

```json
{
  "type": "turn",
  "session_id": "37d7852b-8630-4c40-a315-c814b90635ec",
  "turn": 1,
  "ts_start": "2025-11-05T08:44:05Z",
  "ts_end": "2025-11-05T08:44:09Z",
  "user_input": "maybe u can try running the query.py script?",
  "exchanges": [
    {
      "source": "assistant",
      "type": "text",
      "text": "I'll try to run the query.py script for you!",
      "ts": "2025-11-05T08:44:06Z"
    },
    {
      "source": "assistant",
      "type": "tool_use",
      "tool_use_id": "toolu_01Ry",
      "name": "Bash",
      "input": {
        "command": "python query.py",
        "description": "Run the query.py script"
      },
      "ts": "2025-11-05T08:44:06Z"
    },
    {
      "source": "tool",
      "type": "result",
      "tool_use_id": "toolu_01Ry",
      "is_error": true,
      "output": "Exit code 2\ncan't open file 'query.py': [Errno 2] No such file or directory",
      "ts": "2025-11-05T08:44:08Z"
    },
    {
      "source": "assistant",
      "type": "text",
      "text": "Looks like the query.py script wasn't found in the current directory. Let me check what files are available...",
      "ts": "2025-11-05T08:44:09Z"
    }
  ],
  "stats": {
    "duration_ms": 4000,
    "tokens_in": 16,
    "tokens_out": 120,
    "cost_usd": 0.002
  }
}
```

**Last Line: Session End**

```json
{
  "type": "session_end",
  "session_id": "37d7852b-8630-4c40-a315-c814b90635ec",
  "ts": "2025-11-05T08:44:15Z",
  "total_turns": 3,
  "total_duration_ms": 8038,
  "total_cost_usd": 0.00683,
  "total_tokens": {
    "input": 16,
    "output": 364,
    "cache_creation": 752,
    "cache_read": 39582
  },
  "tools_used": { "Bash": 2, "Read": 1 }
}
```

### Pretty-Printed Example (For Reference Only - Actual Storage is One Line Per Object)

```json
{
  "type": "turn",
  "session_id": "37d7852b-8630-4c40-a315-c814b90635ec",
  "turn": 1,
  "ts_start": "2025-11-05T08:44:05Z",
  "ts_end": "2025-11-05T08:44:09Z",
  "user_input": "maybe u can try running the query.py script?",
  "exchanges": [
    {
      "source": "assistant",
      "type": "text",
      "text": "I'll try to run the query.py script for you!",
      "ts": "2025-11-05T08:44:06Z"
    },
    {
      "source": "assistant",
      "type": "tool_use",
      "tool_use_id": "toolu_01Ry",
      "name": "Bash",
      "input": {
        "command": "python query.py",
        "description": "Run the query.py script"
      },
      "ts": "2025-11-05T08:44:06Z"
    },
    {
      "source": "tool",
      "type": "result",
      "tool_use_id": "toolu_01Ry",
      "is_error": true,
      "output": "Exit code 2\ncan't open file 'query.py'",
      "ts": "2025-11-05T08:44:08Z"
    },
    {
      "source": "assistant",
      "type": "text",
      "text": "Looks like the query.py script wasn't found...",
      "ts": "2025-11-05T08:44:09Z"
    }
  ],
  "stats": {
    "duration_ms": 4000,
    "tokens_in": 16,
    "tokens_out": 120,
    "cost_usd": 0.002
  }
}
```

---

## 3. Implementation Components

### 3.1 Create `session.py` (Shared Library)

**Location:** `/Users/gang/git-projects/alixp-agents/session.py`

**Purpose:** Reusable session logging that works for any agent. The logger automatically buffers messages and writes complete turns to JSONL.

**Core Design Philosophy:**

- **Simple API**: Just call `logger.log(message)` for every message from the SDK
- **Auto-detection**: Logger automatically detects turn boundaries (when `ResultMessage` arrives)
- **Turn-based JSONL**: Each JSONL row represents one complete turn
- **No manual tracking**: Logger handles all buffering and aggregation internally

**Key Class to Implement:**

```python
from pathlib import Path
from datetime import datetime
import json
from typing import Optional
from claude_agent_sdk import (
    SystemMessage,
    UserMessage,
    AssistantMessage,
    ResultMessage,
    TextBlock,
    ToolUseBlock,
    ToolResultBlock
)


class SessionLogger:
    """
    Automatically logs agent interactions to JSONL files.

    Each JSONL row represents one complete turn (user input → agent responses → tool executions).

    Usage (Super Simple!):
        logger = SessionLogger(agent_name="process_agent", base_dir=Path(__file__).parent)

        # Just log every message as it streams in
        async for message in client.receive_response():
            console.print(message)
            logger.log(message)  # That's it!

        # When session ends
        logger.close()
    """

    def __init__(self, agent_name: str, base_dir: Path = None):
        """
        Initialize logger.

        Args:
            agent_name: Name of the agent (e.g., "process_agent")
            base_dir: Base directory for the agent (defaults to CWD/agent_name)
        """
        self.agent_name = agent_name
        self.base_dir = base_dir or Path.cwd() / agent_name

        # Session tracking
        self.session_id: Optional[str] = None
        self.session_file: Optional[Path] = None
        self.session_metadata: dict = {}

        # Turn buffering
        self.current_turn = 0
        self.turn_buffer: list[dict] = []  # Buffered exchanges for current turn
        self.turn_start_ts: Optional[str] = None
        self.user_input_buffer: Optional[str] = None

        # Session-level aggregation
        self.session_start_ts: Optional[str] = None
        self.total_duration_ms = 0
        self.total_cost_usd = 0.0
        self.total_tokens = {"input": 0, "output": 0, "cache_creation": 0, "cache_read": 0}
        self.tools_used: dict[str, int] = {}

    def log(self, message):
        """
        Log any message from the SDK. Automatically handles turn boundaries.

        This is the ONLY method you need to call from agent.py!

        Args:
            message: Any message type from claude_agent_sdk
        """
        if isinstance(message, SystemMessage):
            self._handle_system_message(message)

        elif isinstance(message, UserMessage):
            # UserMessage with ToolResultBlock = tool result
            if message.content and isinstance(message.content[0], ToolResultBlock):
                self._handle_tool_result(message)
            # UserMessage with string content = user input (start of new turn)
            else:
                self._handle_user_input(message)

        elif isinstance(message, AssistantMessage):
            self._handle_assistant_message(message)

        elif isinstance(message, ResultMessage):
            self._handle_result_message(message)

    def close(self):
        """
        Call when session ends to write session_end line.
        """
        if not self.session_file:
            return

        session_end_data = {
            "type": "session_end",
            "session_id": self.session_id,
            "ts": datetime.now().isoformat(),
            "total_turns": self.current_turn,
            "total_duration_ms": self.total_duration_ms,
            "total_cost_usd": round(self.total_cost_usd, 6),
            "total_tokens": self.total_tokens,
            "tools_used": self.tools_used
        }

        self._append_line(session_end_data)

    # ========== Internal Methods ==========

    def _handle_system_message(self, message: SystemMessage):
        """Initialize session on first SystemMessage."""
        self.session_id = message.data['session_id']
        self.session_metadata = message.data
        self.session_start_ts = datetime.now().isoformat()

        # Create session file
        self._ensure_session_file()

        # Write session_start line
        session_start_data = {
            "type": "session_start",
            "session_id": self.session_id,
            "ts": self.session_start_ts,
            "agent_name": self.agent_name,
            "model": message.data.get('model', 'unknown'),
            "cwd": message.data.get('cwd', ''),
            "tools_available": message.data.get('tools', [])
        }

        self._append_line(session_start_data)

    def _handle_user_input(self, message: UserMessage):
        """Handle user's input message (start of new turn)."""
        # Extract user input text
        if isinstance(message.content, str):
            user_text = message.content
        elif isinstance(message.content, list) and message.content:
            # Get text from first block if it exists
            user_text = str(message.content[0])
        else:
            user_text = str(message.content)

        # Start new turn
        self.current_turn += 1
        self.user_input_buffer = user_text
        self.turn_start_ts = datetime.now().isoformat()
        self.turn_buffer = []

    def _handle_assistant_message(self, message: AssistantMessage):
        """Parse and buffer assistant message blocks."""
        for block in message.content:
            exchange = {
                "source": "assistant",
                "ts": datetime.now().isoformat()
            }

            if isinstance(block, TextBlock):
                exchange["type"] = "text"
                exchange["text"] = block.text

            elif isinstance(block, ToolUseBlock):
                exchange["type"] = "tool_use"
                exchange["tool_use_id"] = block.id
                exchange["name"] = block.name
                exchange["input"] = block.input

                # Track tool usage
                self.tools_used[block.name] = self.tools_used.get(block.name, 0) + 1

            self.turn_buffer.append(exchange)

    def _handle_tool_result(self, message: UserMessage):
        """Parse and buffer tool result."""
        for block in message.content:
            if isinstance(block, ToolResultBlock):
                exchange = {
                    "source": "tool",
                    "type": "result",
                    "tool_use_id": block.tool_use_id,
                    "is_error": block.is_error,
                    "output": block.content,
                    "ts": datetime.now().isoformat()
                }

                self.turn_buffer.append(exchange)

    def _handle_result_message(self, message: ResultMessage):
        """Turn complete! Write buffered turn to file."""
        # Extract stats
        usage = message.usage or {}
        duration_ms = message.duration_ms or 0

        tokens_in = usage.get('input_tokens', 0)
        tokens_out = usage.get('output_tokens', 0)
        cache_creation = usage.get('cache_creation_input_tokens', 0)
        cache_read = usage.get('cache_read_input_tokens', 0)

        # Calculate cost (rough estimate based on Claude pricing)
        # Adjust these rates based on actual model pricing
        cost_usd = (
            tokens_in * 0.000003 +  # Input: $3 per 1M tokens
            tokens_out * 0.000015 +  # Output: $15 per 1M tokens
            cache_creation * 0.00000375 +  # Cache write: 25% of input cost
            cache_read * 0.0000003  # Cache read: 10% of input cost
        )

        # Aggregate session totals
        self.total_duration_ms += duration_ms
        self.total_cost_usd += cost_usd
        self.total_tokens["input"] += tokens_in
        self.total_tokens["output"] += tokens_out
        self.total_tokens["cache_creation"] += cache_creation
        self.total_tokens["cache_read"] += cache_read

        # Build turn data
        turn_data = {
            "type": "turn",
            "session_id": self.session_id,
            "turn": self.current_turn,
            "ts_start": self.turn_start_ts,
            "ts_end": datetime.now().isoformat(),
            "user_input": self.user_input_buffer or "",
            "exchanges": self.turn_buffer,
            "stats": {
                "duration_ms": duration_ms,
                "tokens_in": tokens_in,
                "tokens_out": tokens_out,
                "cache_creation": cache_creation,
                "cache_read": cache_read,
                "cost_usd": round(cost_usd, 6)
            }
        }

        # Write turn to file
        self._append_line(turn_data)

        # Reset turn buffer
        self.turn_buffer = []
        self.user_input_buffer = None

    def _ensure_session_file(self):
        """Create sessions/ directory and session file path."""
        session_dir = self.base_dir / "sessions"
        session_dir.mkdir(parents=True, exist_ok=True)

        # Use first 8 chars of session ID for filename
        session_id_short = self.session_id[:8] if self.session_id else "unknown"
        self.session_file = session_dir / f"{session_id_short}.jsonl"

    def _append_line(self, data: dict):
        """Append a JSON line to the session file."""
        if not self.session_file:
            return

        with open(self.session_file, 'a') as f:
            f.write(json.dumps(data) + '\n')
```

**File Path Logic:**

```python
# For process_agent with session_id "37d7852b-8630-4c40-a315-c814b90635ec":
# File: process_agent/sessions/37d7852b.jsonl

base_dir = Path(__file__).parent  # /path/to/process_agent
session_dir = base_dir / "sessions"
session_file = session_dir / "37d7852b.jsonl"
```

### 3.2 Integration in `process_agent/agent.py`

**Super Simple Integration!** Just 3 lines of code:

```python
# At the top
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from session import SessionLogger

async def run_agent():
    console = Console()

    # Initialize logger (only once at start)
    logger = SessionLogger(agent_name="process_agent", base_dir=Path(__file__).parent)

    async with ClaudeSDKClient(options=AGENT_OPTIONS) as client:
        turn_count = 0

        while True:
            user_input = console.input(f"You (Turn {turn_count + 1}): ")

            if user_input.lower() in ["exit", "quit"]:
                logger.close()  # Write session_end line
                console.print("\n[yellow]Ending session. Goodbye![/yellow]")
                break

            if user_input.lower() == "new":
                logger.close()  # End current session
                await client.disconnect()
                await client.connect()
                logger = SessionLogger(agent_name="process_agent", base_dir=Path(__file__).parent)
                turn_count = 0
                console.print("\n[yellow]Started new conversation[/yellow]")
                continue

            if not user_input.strip():
                continue

            # Send query
            await client.query(user_input)
            turn_count += 1

            # Display and log response
            console.print()
            console.print("[bold blue]Agent[/bold blue]:", end=" ")

            # Just log every message!
            async for message in client.receive_response():
                console.print(message)
                logger.log(message)  # <-- That's it! Logger handles everything

            console.print()
```

**That's literally all you need!** The logger:

- Auto-detects session start from `SystemMessage`
- Auto-detects turn boundaries from `ResultMessage`
- Auto-buffers all exchanges within a turn
- Auto-writes complete turns as single JSONL rows
- Auto-aggregates session-level stats

### 3.3 Create `viewer.py` (CLI Viewer)

**Location:** `/Users/gang/git-projects/alixp-agents/viewer.py`

**Purpose:** Display session history in a readable format

**Implementation:**

```python
"""
Session viewer CLI for displaying agent conversation history.

Input data sources: JSONL session files in agent/sessions/
Output destinations: Terminal console with rich formatting
Dependencies: rich for terminal UI
Key exports: view_session(), list_sessions(), main()
Side effects: Reads session files, displays to console
"""

import json
from pathlib import Path
from datetime import datetime
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.syntax import Syntax


def load_session(session_file: Path) -> dict:
    """
    Load session data from JSONL file.

    Returns:
        {
            "metadata": {...},  # session_start data
            "turns": [...],     # List of turn objects
            "summary": {...}    # session_end data
        }
    """
    session = {"metadata": {}, "turns": [], "summary": {}}

    with open(session_file) as f:
        for line in f:
            entry = json.loads(line)

            if entry["type"] == "session_start":
                session["metadata"] = entry
            elif entry["type"] == "turn":
                session["turns"].append(entry)
            elif entry["type"] == "session_end":
                session["summary"] = entry

    return session


def render_exchange(exchange: dict, console: Console):
    """Render a single exchange (assistant text, tool call, or tool result)."""
    if exchange["source"] == "assistant":
        if exchange["type"] == "text":
            console.print(f"[bold blue]Assistant:[/bold blue] {exchange['text']}")
        elif exchange["type"] == "tool_use":
            console.print(
                f"[bold cyan]🔧 Tool Call:[/bold cyan] {exchange['name']}"
            )
            console.print(
                Syntax(
                    json.dumps(exchange['input'], indent=2),
                    "json",
                    theme="monokai",
                    line_numbers=False
                )
            )

    elif exchange["source"] == "tool":
        status = "❌ Error" if exchange.get("is_error") else "✅ Success"
        console.print(f"[bold yellow]{status}:[/bold yellow]")

        # Truncate long outputs
        output = exchange["output"]
        if len(output) > 500:
            output = output[:500] + "\n... (truncated)"

        console.print(f"[dim]{output}[/dim]")


def render_turn(turn: dict, console: Console):
    """Render a complete turn."""
    # Turn header
    console.print()
    console.print(
        Panel(
            f"[bold green]You:[/bold green] {turn['user_input']}\n\n"
            f"[dim]Duration: {turn['stats']['duration_ms']}ms | "
            f"Cost: ${turn['stats']['cost_usd']:.4f} | "
            f"Tokens: {turn['stats']['tokens_in']} in / {turn['stats']['tokens_out']} out[/dim]",
            title=f"Turn {turn['turn']}",
            border_style="green"
        )
    )

    # Render all exchanges
    for exchange in turn["exchanges"]:
        render_exchange(exchange, console)


def view_session(session_file: Path):
    """Display a session in the terminal."""
    console = Console()
    session = load_session(session_file)

    # Session header
    metadata = session["metadata"]
    console.print(
        Panel.fit(
            f"[bold cyan]Session: {metadata['session_id'][:8]}[/bold cyan]\n\n"
            f"Agent: {metadata['agent_name']}\n"
            f"Model: {metadata['model']}\n"
            f"Started: {metadata['ts']}\n"
            f"Working Directory: {metadata['cwd']}",
            border_style="cyan"
        )
    )

    # Render all turns
    for turn in session["turns"]:
        render_turn(turn, console)

    # Session summary
    if session["summary"]:
        summary = session["summary"]
        console.print()
        console.print(
            Panel.fit(
                f"Total Turns: {summary['total_turns']}\n"
                f"Total Duration: {summary['total_duration_ms']}ms\n"
                f"Total Cost: ${summary['total_cost_usd']:.4f}\n"
                f"Tools Used: {', '.join(f'{k} ({v}x)' for k, v in summary['tools_used'].items())}",
                title="Session Summary",
                border_style="yellow"
            )
        )


def list_sessions(agent_name: str = None):
    """List all available sessions."""
    console = Console()

    # Find all session files
    base_dir = Path(__file__).parent

    if agent_name:
        search_pattern = f"{agent_name}/sessions/**/*.jsonl"
    else:
        search_pattern = "*/sessions/**/*.jsonl"

    session_files = list(base_dir.glob(search_pattern))

    if not session_files:
        console.print("[yellow]No sessions found.[/yellow]")
        return

    # Create table
    table = Table(title="Available Sessions")
    table.add_column("Agent", style="cyan")
    table.add_column("Created", style="green")
    table.add_column("Session ID", style="blue")
    table.add_column("File Path", style="dim")

    for file in sorted(session_files, reverse=True):
        parts = file.parts
        agent = parts[-3]  # agent_name/sessions/file
        session_id = file.stem  # Filename is the session ID

        # Get creation date from file
        from datetime import datetime
        created = datetime.fromtimestamp(file.stat().st_ctime).strftime("%Y-%m-%d %H:%M")

        table.add_row(agent, created, session_id, str(file.relative_to(base_dir)))

    console.print(table)


def main():
    """CLI entry point."""
    import sys

    if len(sys.argv) < 2:
        print("Usage:")
        print("  python viewer.py list [agent_name]")
        print("  python viewer.py view <session_file_path>")
        print("  python viewer.py view <session_id>  # Searches for session")
        return

    command = sys.argv[1]

    if command == "list":
        agent_name = sys.argv[2] if len(sys.argv) > 2 else None
        list_sessions(agent_name)

    elif command == "view":
        if len(sys.argv) < 3:
            print("Error: Please provide session file path or session ID")
            return

        session_arg = sys.argv[2]

        # Try as direct path first
        session_file = Path(session_arg)

        # If not a file, search for session ID
        if not session_file.exists():
            base_dir = Path(__file__).parent
            matches = list(base_dir.glob(f"*/sessions/**/*{session_arg}*.jsonl"))

            if not matches:
                print(f"Error: Session not found: {session_arg}")
                return
            elif len(matches) > 1:
                print(f"Error: Multiple sessions match '{session_arg}':")
                for match in matches:
                    print(f"  - {match}")
                return

            session_file = matches[0]

        view_session(session_file)


if __name__ == "__main__":
    main()
```

---

## 4. Usage Examples

### Starting a Session (Automatic in agent.py)

```python
# When user starts chatting, SessionLogger automatically creates:
# process_agent/sessions/37d7852b.jsonl
```

### Viewing a Session

```bash
# List all sessions
python viewer.py list

# List sessions for specific agent
python viewer.py list process_agent

# View by session ID (partial match works)
python viewer.py view 37d7852b

# View by full path
python viewer.py view process_agent/sessions/37d7852b.jsonl
```

### Expected Output

```
┌─────────────────────────────────────────────────────┐
│ Session: 37d7852b                                   │
│                                                     │
│ Agent: process_agent                                │
│ Model: claude-haiku-4-5-20251001                    │
│ Started: 2025-11-05T08:44:00Z                       │
│ Working Directory: /path/to/working-dir             │
└─────────────────────────────────────────────────────┘

┌─ Turn 1 ────────────────────────────────────────────┐
│ You: maybe u can try running the query.py script?  │
│                                                     │
│ Duration: 4000ms | Cost: $0.0020 | Tokens: 16/120  │
└─────────────────────────────────────────────────────┘
</reference plan>

<python logger code>
"""
Session logging library that captures agent interactions in JSONL format.

Input data sources: Messages from claude_agent_sdk (SystemMessage, UserMessage, AssistantMessage, ResultMessage)
Output destinations: agent_name/sessions/*.jsonl files
Dependencies: claude_agent_sdk, Python standard library (json, pathlib, datetime)
Key exports: SessionLogger
Side effects: Creates session directories and JSONL files
"""

from pathlib import Path
from datetime import datetime
import json
from typing import Optional
from claude_agent_sdk import (
    SystemMessage,
    UserMessage,
    AssistantMessage,
    ResultMessage,
    TextBlock,
    ToolUseBlock,
    ToolResultBlock
)


class SessionLogger:
    """
    Automatically logs agent interactions to JSONL files.

    Each JSONL row represents one complete turn (user input → agent responses → tool executions).

    Usage (Super Simple!):
        logger = SessionLogger(agent_name="process_agent", base_dir=Path(__file__).parent)

        # Just log every message as it streams in
        async for message in client.receive_response():
            console.print(message)
            logger.log(message)  # That's it!

        # When session ends
        logger.close()
    """

    def __init__(self, agent_name: str, base_dir: Optional[Path] = None):
        """
        Initialize logger.

        Args:
            agent_name: Name of the agent (e.g., "process_agent")
            base_dir: Base directory for the agent (defaults to CWD/agent_name)
        """
        self.agent_name = agent_name
        self.base_dir = base_dir or Path.cwd() / agent_name

        # Session tracking
        self.session_id: Optional[str] = None
        self.session_file: Optional[Path] = None
        self.session_metadata: dict = {}

        # Turn buffering
        self.current_turn = 0
        self.turn_buffer: list[dict] = []  # Buffered exchanges for current turn
        self.turn_start_ts: Optional[str] = None
        self.user_input_buffer: Optional[str] = None

        # Session-level aggregation
        self.session_start_ts: Optional[str] = None
        self.total_duration_ms = 0
        self.total_cost_usd = 0.0
        self.total_tokens = {"input": 0, "output": 0, "cache_creation": 0, "cache_read": 0}
        self.tools_used: dict[str, int] = {}

    def log(self, message):
        """
        Log any message from the SDK. Automatically handles turn boundaries.

        This is the ONLY method you need to call from agent.py!

        Args:
            message: Any message type from claude_agent_sdk
        """
        if isinstance(message, SystemMessage):
            self._handle_system_message(message)

        elif isinstance(message, UserMessage):
            # UserMessage with ToolResultBlock = tool result
            if message.content and isinstance(message.content[0], ToolResultBlock):
                self._handle_tool_result(message)
            # UserMessage with string content = user input (start of new turn)
            else:
                self._handle_user_input(message)

        elif isinstance(message, AssistantMessage):
            self._handle_assistant_message(message)

        elif isinstance(message, ResultMessage):
            self._handle_result_message(message)

    def log_user_input(self, user_text: str):
        """
        Manually log user input to start a new turn.

        Call this right after client.query(user_input).

        Args:
            user_text: The user's input text
        """
        self.user_input_buffer = user_text
        self.turn_start_ts = datetime.now().isoformat()
        self.turn_buffer = []

    def close(self):
        """
        Call when session ends to write session_end line.
        """
        if not self.session_file:
            return

        session_end_data = {
            "type": "session_end",
            "session_id": self.session_id,
            "ts": datetime.now().isoformat(),
            "total_turns": self.current_turn,
            "total_duration_ms": self.total_duration_ms,
            "total_cost_usd": round(self.total_cost_usd, 6),
            "total_tokens": self.total_tokens,
            "tools_used": self.tools_used
        }

        self._append_line(session_end_data)

    # ========== Internal Methods ==========

    def _handle_system_message(self, message: SystemMessage):
        """Initialize session on first SystemMessage."""
        # Only initialize session once (prevent duplicate session_start)
        if self.session_id is not None:
            return

        self.session_id = message.data['session_id']
        self.session_metadata = message.data
        self.session_start_ts = datetime.now().isoformat()

        # Create session file
        self._ensure_session_file()

        # Write session_start line
        session_start_data = {
            "type": "session_start",
            "session_id": self.session_id,
            "ts": self.session_start_ts,
            "agent_name": self.agent_name,
            "model": message.data.get('model', 'unknown'),
            "cwd": message.data.get('cwd', ''),
            "tools_available": message.data.get('tools', [])
        }

        self._append_line(session_start_data)

    def _handle_user_input(self, message: UserMessage):
        """Handle user's input message (start of new turn)."""
        # Extract user input text
        if isinstance(message.content, str):
            user_text = message.content
        elif isinstance(message.content, list) and message.content:
            # Get text from first block if it exists
            user_text = str(message.content[0])
        else:
            user_text = str(message.content)

        # Start new turn (don't increment counter - use ResultMessage.num_turns instead)
        self.user_input_buffer = user_text
        self.turn_start_ts = datetime.now().isoformat()
        self.turn_buffer = []

    def _handle_assistant_message(self, message: AssistantMessage):
        """Parse and buffer assistant message blocks."""
        for block in message.content:
            exchange: dict[str, object] = {
                "source": "assistant",
                "ts": datetime.now().isoformat()
            }

            if isinstance(block, TextBlock):
                exchange["type"] = "text"
                exchange["text"] = block.text

            elif isinstance(block, ToolUseBlock):
                exchange["type"] = "tool_use"
                exchange["tool_use_id"] = block.id
                exchange["name"] = block.name
                exchange["input"] = block.input

                # Track tool usage
                self.tools_used[block.name] = self.tools_used.get(block.name, 0) + 1

            self.turn_buffer.append(exchange)

    def _handle_tool_result(self, message: UserMessage):
        """Parse and buffer tool result."""
        for block in message.content:
            if isinstance(block, ToolResultBlock):
                exchange = {
                    "source": "tool",
                    "type": "result",
                    "tool_use_id": block.tool_use_id,
                    "is_error": block.is_error,
                    "output": block.content,
                    "ts": datetime.now().isoformat()
                }

                self.turn_buffer.append(exchange)

    def _handle_result_message(self, message: ResultMessage):
        """Turn complete! Write buffered turn to file."""
        # Extract stats
        usage = message.usage or {}
        duration_ms = message.duration_ms or 0
        turn_number = message.num_turns or 0  # Use turn number from ResultMessage

        tokens_in = usage.get('input_tokens', 0)
        tokens_out = usage.get('output_tokens', 0)
        cache_creation = usage.get('cache_creation_input_tokens', 0)
        cache_read = usage.get('cache_read_input_tokens', 0)

        # Calculate cost (rough estimate based on Claude pricing)
        # Adjust these rates based on actual model pricing
        cost_usd = (
            tokens_in * 0.000003 +  # Input: $3 per 1M tokens
            tokens_out * 0.000015 +  # Output: $15 per 1M tokens
            cache_creation * 0.00000375 +  # Cache write: 25% of input cost
            cache_read * 0.0000003  # Cache read: 10% of input cost
        )

        # Aggregate session totals
        self.total_duration_ms += duration_ms
        self.total_cost_usd += cost_usd
        self.total_tokens["input"] += tokens_in
        self.total_tokens["output"] += tokens_out
        self.total_tokens["cache_creation"] += cache_creation
        self.total_tokens["cache_read"] += cache_read

        # Update current turn counter for session_end
        self.current_turn = turn_number

        # Build turn data
        turn_data = {
            "type": "turn",
            "session_id": self.session_id,
            "ts_start": self.turn_start_ts,
            "ts_end": datetime.now().isoformat(),
            "user_input": self.user_input_buffer or "",
            "exchanges": self.turn_buffer,
            "stats": {
                "num_turns": turn_number,
                "duration_ms": duration_ms,
                "tokens_in": tokens_in,
                "tokens_out": tokens_out,
                "cache_creation": cache_creation,
                "cache_read": cache_read,
                "cost_usd": round(cost_usd, 6)
            }
        }

        # Write turn to file
        self._append_line(turn_data)

        # Reset turn buffer
        self.turn_buffer = []
        self.user_input_buffer = None

    def _ensure_session_file(self):
        """Create sessions/ directory and session file path."""
        session_dir = self.base_dir / "sessions"
        session_dir.mkdir(parents=True, exist_ok=True)

        # Use timestamp prefix + first 8 chars of session ID for filename
        # Format: YYYYMMDD_HHMMSS_<session_id_short>.jsonl
        timestamp_prefix = datetime.now().strftime("%Y%m%d_%H%M%S")
        session_id_short = self.session_id[:8] if self.session_id else "unknown"
        self.session_file = session_dir / f"{timestamp_prefix}_{session_id_short}.jsonl"

    def _append_line(self, data: dict):
        """Append a JSON line to the session file."""
        if not self.session_file:
            return

        with open(self.session_file, 'a') as f:
            f.write(json.dumps(data) + '\n')

</python logger code>
```
