/**
 * Streaming Claude Agent API route handler that processes chat messages using streaming input mode.
 *
 * Input data sources: POST request with JSON body containing messages
 * Output destinations: Streaming response to client
 * Dependencies: @anthropic-ai/claude-agent-sdk, ANTHROPIC_API_KEY environment variable
 * Key exports: POST handler for /api/chat endpoint
 * Side effects: Makes API calls to Claude, executes agent tools
 */

import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { NextRequest } from "next/server";
import { agentOptions } from "./config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatRequestBody {
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  sessionId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequestBody;

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Async generator for streaming input mode
          async function* generateMessages(): AsyncGenerator<SDKUserMessage, void, unknown> {
            // Yield all user messages from the request
            for (const msg of body.messages) {
              if (msg.role === "user") {
                yield {
                  type: "user" as const,
                  session_id: "", // Will be set by SDK
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
            // Stream different message types back to client
            const chunk = JSON.stringify(message) + "\n";
            controller.enqueue(encoder.encode(chunk));

            // Complete on result message
            if (message.type === "result") {
              break;
            }
          }

          controller.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "error",
                error: errorMessage,
              }) + "\n"
            )
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
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
