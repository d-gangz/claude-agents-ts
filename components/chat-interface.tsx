/**
 * Main chat interface component with NDJSON streaming support for Claude Agent SDK.
 *
 * Input data sources: User text input from form
 * Output destinations: /api/chat endpoint via POST, rendered messages in UI
 * Dependencies: /api/chat route, shadcn/ui components
 * Key exports: ChatInterface component
 * Side effects: Makes streaming API calls to /api/chat
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "@/components/chat-message";
import { Send, Bug } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface DebugMessage {
  timestamp: string;
  data: unknown;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [showDebug, setShowDebug] = useState(false);
  const [debugMessages, setDebugMessages] = useState<DebugMessage[]>([]);
  const [sentMessages, setSentMessages] = useState<string>("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const debugScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Auto-scroll debug view
  useEffect(() => {
    if (debugScrollRef.current) {
      debugScrollRef.current.scrollTop = debugScrollRef.current.scrollHeight;
    }
  }, [debugMessages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput("");

    // Add user message to chat
    const newMessages = [...messages, { role: "user" as const, content: userMessage }];
    setMessages(newMessages);
    setIsStreaming(true);
    setStreamingContent("");
    setDebugMessages([]); // Clear previous debug messages

    try {
      // Send only the latest user message to API
      // Include sessionId if we have one (for session continuity)
      const requestBody = {
        messages: [{ role: "user" as const, content: userMessage }],
        ...(sessionId && { sessionId }),
      };
      setSentMessages(JSON.stringify(requestBody, null, 2));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Parse NDJSON stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const message = JSON.parse(line);

            // Add to debug view
            setDebugMessages(prev => [...prev, { timestamp: new Date().toISOString(), data: message }]);

            // Extract session ID from first system message
            if (message.type === "system" && message.subtype === "init" && !sessionId) {
              setSessionId(message.session_id);
            }

            // Handle different message types from SDK
            if (message.type === "assistant") {
              // Extract text content from assistant messages
              if (message.message?.content) {
                const content = message.message.content;
                if (Array.isArray(content)) {
                  // Handle content blocks
                  for (const block of content) {
                    if (block.type === "text" && block.text) {
                      assistantContent += block.text;
                      setStreamingContent(assistantContent);
                    } else if (block.type === "tool_use") {
                      // Show tool usage indicator
                      assistantContent += `\n[Using tool: ${block.name}]\n`;
                      setStreamingContent(assistantContent);
                    }
                  }
                } else if (typeof content === "string") {
                  assistantContent += content;
                  setStreamingContent(assistantContent);
                }
              }
            } else if (message.type === "result") {
              // Stream completed
              if (assistantContent) {
                setMessages([...newMessages, { role: "assistant", content: assistantContent }]);
              } else if (message.content) {
                // Fallback to result content if no assistant content
                setMessages([...newMessages, { role: "assistant", content: message.content }]);
              }
              setStreamingContent("");
              break;
            } else if (message.type === "error") {
              throw new Error(message.error || "Unknown error occurred");
            }
          } catch (parseError) {
            console.error("Failed to parse message:", line, parseError);
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: `Error: ${error instanceof Error ? error.message : "Failed to get response"}`,
        },
      ]);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  };

  return (
    <div className="flex gap-4 w-full max-w-7xl mx-auto">
      <Card className="flex flex-col h-[600px] flex-1">
        {/* Header */}
        <div className="border-b p-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Claude Agent Chat</h2>
            <p className="text-sm text-gray-500">Powered by Claude Agent SDK</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDebug(!showDebug)}
          >
            <Bug className="h-4 w-4 mr-2" />
            {showDebug ? "Hide" : "Show"} Debug
          </Button>
        </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>Send a message to start chatting with the Claude Agent</p>
          </div>
        )}

        {messages.map((message, index) => (
          <ChatMessage
            key={index}
            role={message.role}
            content={message.content}
          />
        ))}

        {/* Streaming message */}
        {isStreaming && streamingContent && (
          <ChatMessage
            role="assistant"
            content={streamingContent}
            isStreaming={true}
          />
        )}

        {/* Loading indicator when streaming starts */}
        {isStreaming && !streamingContent && (
          <ChatMessage
            role="assistant"
            content=""
            isStreaming={true}
          />
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isStreaming}
            className="flex-1"
          />
          <Button type="submit" disabled={isStreaming || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </Card>

      {/* Debug Panel */}
      {showDebug && (
        <Card className="flex flex-col h-[600px] w-[500px]">
          <div className="border-b p-4">
            <h3 className="font-semibold">Debug View</h3>
            <p className="text-xs text-gray-500">Request & Response Stream</p>
          </div>
          <ScrollArea className="flex-1 p-4" ref={debugScrollRef}>
            {/* Sent Messages */}
            {sentMessages && (
              <div className="mb-4">
                <div className="text-sm font-semibold mb-2 text-blue-600">📤 Sent to Backend:</div>
                <div className="border rounded p-2 bg-blue-50 dark:bg-blue-950">
                  <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all">
                    {sentMessages}
                  </pre>
                </div>
              </div>
            )}

            {/* Received Messages */}
            <div className="text-sm font-semibold mb-2 text-green-600">📥 Received from Backend:</div>
            {debugMessages.length === 0 ? (
              <div className="text-sm text-gray-400">No messages yet</div>
            ) : (
              <div className="space-y-2">
                {debugMessages.map((msg, idx) => (
                  <div key={idx} className="border rounded p-2 bg-gray-50 dark:bg-gray-900">
                    <div className="text-xs text-gray-500 mb-1 font-mono">
                      #{idx + 1} • {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                    <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(msg.data, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}
