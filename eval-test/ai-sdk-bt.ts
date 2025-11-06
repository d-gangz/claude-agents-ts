import dotenv from "dotenv";
import { Eval, wrapAISDK } from "braintrust";
import * as ai from "ai";
// import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

/**
 * Chains two LLM calls with a processing step in between.
 *
 * Flow:
 * 1. First LLM call: Generates a greeting for the input name
 * 2. Processing step: Appends extra text to the first response
 * 3. Second LLM call: Refines/polishes the processed text
 *
 * @param input - The name to greet
 * @returns The final processed and refined greeting
 *
 * Result: It works and it is finally tracing AI SDK stuff properly in an experiment. So I can finally use Vercel AI SDK with Braintrust
 */

// Load environment variables from .env.local. You need to do this else it will fail.
dotenv.config({ path: ".env.local" });

const { generateText } = wrapAISDK(ai);

async function chainedLLMCalls(input: string): Promise<string> {
  // First LLM call - Generate initial greeting
  const firstResult = await generateText({
    model: openai("gpt-4o-mini"),
    prompt: `Generate a friendly greeting for someone named ${input}. Keep it short and simple.`,
  });

  console.log("First LLM output:", firstResult.text);

  // Processing step - Append extra text
  const processedText = `${firstResult.text}\n\nAdditional context: This is an automated greeting system.`;

  console.log("After processing:", processedText);

  // Second LLM call - Refine the processed text
  const secondResult = await generateText({
    model: openai("gpt-4o-mini"),
    prompt: `Take this text and make it more concise while keeping the greeting:\n\n${processedText}`,
  });

  console.log("Second LLM output:", secondResult.text);

  return secondResult.text;
}

Eval(
  "claude-agent", // Replace with your project name and you need to add this
  {
    experimentName: "ai-sdk",
    data: () => {
      return [
        {
          input: "Foo",
          expected: "Hi Foo",
        },
        {
          input: "Bar",
          expected: "Hello Bar",
        },
      ]; // Replace with your eval dataset
    },
    task: async (input) => {
      return await chainedLLMCalls(input);
    },
    scores: [],
  }
);
