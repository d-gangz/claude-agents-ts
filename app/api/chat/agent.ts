/**
 * Interactive CLI script for chatting with Claude Agent using streaming input mode.
 *
 * Input data sources: Terminal stdin (user input)
 * Output destinations: Terminal stdout (Claude responses), /sessions/*.jsonl (session logs)
 * Dependencies: @anthropic-ai/claude-agent-sdk, chalk, dotenv, ANTHROPIC_API_KEY environment variable
 * Key exports: None (executable script)
 * Side effects: Makes API calls to Claude, executes agent tools, reads from stdin, creates session log files
 */
import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import * as readline from "readline";
import chalk from "chalk";
import { agentOptions } from "./config";
import { createSessionLogger } from "@/lib/session-logger";

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Queue for user messages
const messageQueue: string[] = [];

// Session logger instance (will be initialized in main)
let logger: ReturnType<typeof createSessionLogger>;

// Async generator for streaming input mode
async function* generateMessages(): AsyncGenerator<
  SDKUserMessage,
  void,
  unknown
> {
  while (true) {
    // Wait for user input
    const userMessage = await new Promise<string>((resolve) => {
      if (messageQueue.length > 0) {
        resolve(messageQueue.shift()!);
      } else {
        rl.question(`\n${chalk.cyan.bold("You:")} `, (answer) => {
          resolve(answer);
        });
      }
    });

    // Check for exit commands
    if (
      userMessage.toLowerCase() === "exit" ||
      userMessage.toLowerCase() === "quit"
    ) {
      console.log(`\n${chalk.yellow("Goodbye!")}\n`);
      logger.close();
      rl.close();
      process.exit(0);
    }

    // Skip empty messages
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

async function main() {
  console.log(chalk.green.bold("╔══════════════════════════════════════════╗"));
  console.log(chalk.green.bold("║   Claude Agent Interactive Chat          ║"));
  console.log(chalk.green.bold("╚══════════════════════════════════════════╝"));
  console.log(chalk.dim("Type 'exit' or 'quit' to end the conversation\n"));

  // Initialize session logger
  logger = createSessionLogger();

  try {
    // Start the streaming agent
    for await (const message of query({
      prompt: generateMessages(),
      options: agentOptions,
    })) {
      // Log every message
      logger.log(message);

      // Pretty print the entire message object
      console.log(
        chalk.cyan("\n═══════════ MESSAGE ═══════════")
      );
      console.log(JSON.stringify(message, null, 2));
      console.log(
        chalk.cyan("═══════════════════════════════════\n")
      );
    }
  } catch (error) {
    console.error(
      `\n${chalk.red(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      )}`
    );
    if (error instanceof Error && error.stack) {
      console.error(chalk.dim(error.stack));
    }
    logger.close();
    rl.close();
    process.exit(1);
  } finally {
    // Always close logger
    logger.close();
  }
}

// Handle Ctrl+C gracefully
process.on("SIGINT", () => {
  console.log(`\n\n${chalk.yellow("Interrupted by user. Goodbye!")}\n`);
  if (logger) {
    logger.close();
  }
  rl.close();
  process.exit(0);
});

// Start the interactive chat
main();
