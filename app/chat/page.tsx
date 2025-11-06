/**
 * Chat page that renders the main chat interface for Claude Agent SDK interactions.
 *
 * Input data sources: User interaction via ChatInterface component
 * Output destinations: Browser UI
 * Dependencies: ChatInterface component, Next.js App Router
 * Key exports: Default chat page component
 * Side effects: None (delegated to ChatInterface)
 */

import { ChatInterface } from "@/components/chat-interface";

export default function ChatPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
      <ChatInterface />
    </main>
  );
}
