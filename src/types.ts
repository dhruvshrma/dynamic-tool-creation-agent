// src/types.ts

export interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null; // Content can be null for assistant messages with only tool calls
  name?: string; // For tool role, the name of the tool that was called. For assistant role, an optional name.
  tool_call_id?: string; // For tool role, the ID of the tool call.
  tool_calls?: ToolCall[]; // For assistant role, if it wants to call tools.
}

export interface Conversation {
  messages: Message[];
}

export interface ToolCall {
  id: string; // ID to be passed back in the tool message
  type: "function"; // OpenAI currently only supports "function"
  function: {
    name: string;
    arguments: string; // JSON string of arguments
  };
}

export interface Tool {
  name: string;
  description: string;
  execute: (args: any) => Promise<string>; // Takes parsed arguments, returns a string result
} 