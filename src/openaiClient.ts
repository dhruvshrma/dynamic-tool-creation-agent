// TODO: Implement OpenAI client logic
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { Message, Conversation, ToolCall } from './types'; // Ensure ToolCall is imported
import { ITool } from './tools/toolInterface'; // Import ITool

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper to format our ITool into OpenAI's expected tool format
const formatToolsForOpenAI = (tools: ITool[]): OpenAI.Chat.Completions.ChatCompletionTool[] => {
  return tools.map(tool => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parametersSchema,
    },
  }));
};

/**
 * Sends the current user message along with the existing conversation history and available tools to OpenAI.
 * @param userMessageContent The content of the current user's message.
 * @param conversation The existing conversation object.
 * @param availableTools Optional array of tools available for the LLM to use.
 * @returns A Promise that resolves to the assistant's message object (which may include text content or tool_calls) or null if an error occurs.
 */
export async function sendMessageToOpenAI(
  userMessageContent: string, 
  conversation: Conversation, 
  availableTools?: ITool[]
): Promise<Message | null> {
  try {
    const messagesToSend: Message[] = [
      ...conversation.messages,
      { role: "user", content: userMessageContent, tool_calls: undefined, tool_call_id: undefined, name: undefined }, // Ensure new user message matches Message type fully
    ];

    const requestBody: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
      messages: messagesToSend as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      model: "gpt-4o-mini", // Or your preferred model, ensure it supports tool calling
    };

    if (availableTools && availableTools.length > 0) {
      requestBody.tools = formatToolsForOpenAI(availableTools);
      requestBody.tool_choice = "auto"; // Let the model decide when to call tools
    }

    // console.log(`Sending request to OpenAI: ${JSON.stringify(requestBody, null, 2)}`);
    const completion = await openai.chat.completions.create(requestBody);
    // console.log(`Received response from OpenAI: ${JSON.stringify(completion, null, 2)}`);

    const assistantResponse = completion.choices[0]?.message;

    if (assistantResponse) {
      const responseContent = assistantResponse.content;
      const responseToolCalls = assistantResponse.tool_calls;

      // Check if the assistant's response is valid for our needs
      const hasTextContent = responseContent && responseContent.trim() !== "";
      const hasToolCalls = responseToolCalls && responseToolCalls.length > 0;

      // If there's no text content AND no tool calls, it's an empty or problematic assistant turn.
      // We should not propagate this as a message with {content: null, tool_calls: undefined}
      // as that would be invalid to send back to the API.
      if (!hasTextContent && !hasToolCalls) {
        console.warn("OpenAI assistant response had no text content and no tool calls. Treating as empty response.");
        return null; // Or return a default placeholder message if preferred
      }

      // Adapt OpenAI's response to our Message type
      const assistantMessage: Message = {
        role: "assistant",
        content: responseContent || null, // Content can be null if there are tool_calls
        tool_calls: hasToolCalls ? responseToolCalls!.map(tc => ({
          id: tc.id,
          type: tc.type as "function",
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          }
        })) : undefined,
        name: undefined,
        tool_call_id: undefined,
      };
      return assistantMessage;
    }
    
    console.warn("OpenAI response did not contain expected message structure (no assistantResponse).");
    return null;

  } catch (error) {
    console.error('Error communicating with OpenAI:', error);
    return null;
  }
} 