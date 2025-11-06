/**
 * Chat message component that displays individual messages in the chat interface.
 *
 * Input data sources: Message objects with role, content, and optional metadata
 * Output destinations: Rendered message bubbles in chat UI
 * Dependencies: shadcn/ui components (Avatar, Card)
 * Key exports: ChatMessage component
 * Side effects: None
 */

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 mb-4",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-purple-500 text-white">
            AI
          </AvatarFallback>
        </Avatar>
      )}

      <Card
        className={cn(
          "max-w-[80%] px-4 py-3",
          isUser
            ? "bg-blue-500 text-white"
            : "bg-gray-100 dark:bg-gray-800",
          isStreaming && "animate-pulse"
        )}
      >
        <div className="whitespace-pre-wrap break-words text-sm">
          {content || (isStreaming ? "Thinking..." : "")}
        </div>
      </Card>

      {isUser && (
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-blue-500 text-white">
            U
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
