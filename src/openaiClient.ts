import OpenAI from 'openai';
import dotenv from 'dotenv';
import { Message, Conversation, ToolCall } from './types'; 
import { ITool } from './tools/toolInterface'; 

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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


export async function sendMessageToOpenAI(
  userMessageContent: string, 
  conversation: Conversation, 
  availableTools?: ITool[]
): Promise<Message | null> {
  try {
    const messagesToSend: Message[] = [
      ...conversation.messages,
      { role: "user", content: userMessageContent, tool_calls: undefined, tool_call_id: undefined, name: undefined }, 
    ];

    const requestBody: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
      messages: messagesToSend as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      model: "gpt-4o", 
    };

    if (availableTools && availableTools.length > 0) {
      requestBody.tools = formatToolsForOpenAI(availableTools);
      requestBody.tool_choice = "auto"; 
    }

    const completion = await openai.chat.completions.create(requestBody);

    const assistantResponse = completion.choices[0]?.message;

    if (assistantResponse) {
      const responseContent = assistantResponse.content;
      const responseToolCalls = assistantResponse.tool_calls;

      const hasTextContent = responseContent && responseContent.trim() !== "";
      const hasToolCalls = responseToolCalls && responseToolCalls.length > 0;


      if (!hasTextContent && !hasToolCalls) {
        if (process.env.NODE_ENV !== 'test') {
          console.warn("OpenAI assistant response had no text content and no tool calls. Treating as empty response.");
        }
        return null; 
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: responseContent || null, 
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
    
    if (process.env.NODE_ENV !== 'test') {
      console.warn("OpenAI response did not contain expected message structure (no assistantResponse).");
    }
    return null;

  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Error communicating with OpenAI:', error);
    }
    return null;
  }
} 