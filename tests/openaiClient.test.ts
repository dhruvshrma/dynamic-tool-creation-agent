let mockCreate: jest.Mock<Promise<OpenAI.Chat.Completions.ChatCompletion>, [OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming]>;


import { sendMessageToOpenAI } from '../src/openaiClient';
import { Message, Conversation, ToolCall } from '../src/types';
import OpenAI from 'openai';
import { ITool } from '../src/tools/toolInterface';


jest.mock('openai', () => {
  mockCreate = jest.fn();
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));
});

// A simple mock tool for testing purposes
const mockAvailableTool: ITool = {
  name: "get_current_time",
  description: "Returns the current time.",
  parametersSchema: { type: "object", properties: {} },
  execute: async () => JSON.stringify({ time: new Date().toISOString() }),
};

describe('sendMessageToOpenAI', () => {
  beforeEach(() => {
    mockCreate.mockClear();
    // Default successful response (text-based)
    mockCreate.mockResolvedValue({
      choices: [{ message: { role: "assistant", content: "Mocked text response" } }],
      id: "chatcmpl-mockId", object: "chat.completion", created: Date.now(), model: "gpt-4o"
    } as OpenAI.Chat.Completions.ChatCompletion);
  });

  it('should be defined', () => {
    expect(sendMessageToOpenAI).toBeDefined();
  });

  it('should send current user message along with existing conversation history', async () => {
    const initialConversation: Conversation = {
      messages: [
        { role: "user", content: "Previous question" },
        { role: "assistant", content: "Previous answer" },
      ],
    };
    const newUserMessageContent = "New question";
    // For this test, assume a simple text response, not a tool call
    mockCreate.mockResolvedValue({
      choices: [{ message: { role: "assistant", content: "Mocked text response" } }],
      id: "chatcmpl-mockIdText", object: "chat.completion", created: Date.now(), model: "gpt-4o"
    } as OpenAI.Chat.Completions.ChatCompletion);

    const response = await sendMessageToOpenAI(newUserMessageContent, initialConversation, []); // No tools for this specific test

    expect(response).toEqual({ role: "assistant", content: "Mocked text response", tool_calls: undefined, name: undefined, tool_call_id: undefined });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      messages: [
        { role: "user", content: "Previous question" },
        { role: "assistant", content: "Previous answer" },
        { role: "user", content: newUserMessageContent, tool_calls: undefined, tool_call_id: undefined, name: undefined },
      ],
      model: "gpt-4o",
    }));
  });

  it('should handle an empty initial conversation', async () => {
    const emptyConversation: Conversation = { messages: [] };
    const newUserMessageContent = "First question";
    // Assume simple text response
    mockCreate.mockResolvedValue({
        choices: [{ message: { role: "assistant", content: "Mocked first response" } }],
        id: "chatcmpl-mockIdFirst", object: "chat.completion", created: Date.now(), model: "gpt-4o"
    } as OpenAI.Chat.Completions.ChatCompletion);
    
    await sendMessageToOpenAI(newUserMessageContent, emptyConversation, []);

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      messages: [{ role: "user", content: newUserMessageContent, tool_calls: undefined, tool_call_id: undefined, name: undefined }],
      model: "gpt-4o",
    }));
  });

  it('should return null on API error', async () => {
    mockCreate.mockRejectedValue(new Error("API failure"));
    const conversation: Conversation = { messages: [] };
    const response = await sendMessageToOpenAI("Test API error", conversation);
    expect(response).toBeNull();
  });

  it('should return null if OpenAI response is malformed (no content and no tool_calls)', async () => {
    mockCreate.mockResolvedValue({ 
        choices: [{ message: { role: "assistant", content: null, tool_calls: undefined } }] 
    } as OpenAI.Chat.Completions.ChatCompletion);
    const conversation: Conversation = { messages: [] };
    const response = await sendMessageToOpenAI("Test malformed response", conversation);
    expect(response).toBeNull(); // Due to our added check in sendMessageToOpenAI
  });

  it('should return null if OpenAI response has no choices', async () => {
    mockCreate.mockResolvedValue({
      id: "chatcmpl-xxxx",
      object: "chat.completion",
      created: Date.now(),
      model: "gpt-4o",
      choices: [], 
      usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 }
    } as OpenAI.Chat.Completions.ChatCompletion);
    const conversation: Conversation = { messages: [] };
    const response = await sendMessageToOpenAI("Test no choices", conversation);
    expect(response).toBeNull();
  });

  it('should correctly pass available tools to OpenAI API', async () => {
    const conversation: Conversation = { messages: [] };
    const userMessageContent = "What can you do?";
    const availableTools: ITool[] = [mockAvailableTool];

    await sendMessageToOpenAI(userMessageContent, conversation, availableTools);

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      tools: [
        {
          type: "function",
          function: {
            name: mockAvailableTool.name,
            description: mockAvailableTool.description,
            parameters: mockAvailableTool.parametersSchema,
          }
        }
      ],
      tool_choice: "auto",
    }));
  });

  it('should return assistant message with tool_calls if LLM requests a tool', async () => {
    const conversation: Conversation = { messages: [] };
    const userMessageContent = "Use a tool";
    const toolCallId = "call_test123";
    const llmRequestedToolName = "get_current_time";
    const llmRequestedToolArgs = "{}";

    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          role: "assistant",
          content: null, // No direct text content when making tool calls
          tool_calls: [{
            id: toolCallId,
            type: "function",
            function: { name: llmRequestedToolName, arguments: llmRequestedToolArgs },
          }],
        },
      }],
      id: "chatcmpl-mockId2", object: "chat.completion", created: Date.now(), model: "gpt-4o"
    } as OpenAI.Chat.Completions.ChatCompletion);

    const response = await sendMessageToOpenAI(userMessageContent, conversation, [mockAvailableTool]);

    expect(response).not.toBeNull();
    expect(response?.role).toBe("assistant");
    expect(response?.content).toBeNull();
    expect(response?.tool_calls).toBeDefined();
    expect(response?.tool_calls?.length).toBe(1);
    const receivedToolCall = response!.tool_calls![0];
    expect(receivedToolCall.id).toBe(toolCallId);
    expect(receivedToolCall.function.name).toBe(llmRequestedToolName);
    expect(receivedToolCall.function.arguments).toBe(llmRequestedToolArgs);
  });

  it('should return assistant message with tool_calls if LLM requests tool_creation', async () => {
    const conversation: Conversation = { messages: [] };
    const userMessageContent = "I need a tool to convert currency.";
    const toolCallId = "call_create_tool_456";
    const requestedToolSpec = {
      tool_name: "currency_converter",
      tool_description: "Converts an amount from one currency to another.",
      input_parameters_schema: { 
        type: "object", 
        properties: { 
          amount: { type: "number" }, 
          from_currency: { type: "string" }, 
          to_currency: { type: "string" } 
        },
        required: ["amount", "from_currency", "to_currency"]
      },
      output_description: "JSON string with converted amount and target currency."
    };

    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          role: "assistant",
          content: null,
          tool_calls: [{
            id: toolCallId,
            type: "function",
            function: { 
              name: 'tool_creation', // Critical: use the defined name
              arguments: JSON.stringify(requestedToolSpec) 
            },
          }],
        },
      }],
      id: "chatcmpl-mockId3", object: "chat.completion", created: Date.now(), model: "gpt-4o"
    } as OpenAI.Chat.Completions.ChatCompletion);

    // We pass availableTools even for request_tool_creation, as the LLM might see other tools too.
    // The request_tool_creation definition is added to availableTools by the system prompt logic,
    // but for this unit test, we are testing sendMessageToOpenAI directly.
    // The system prompt logic itself is not part of this unit test.
    // So, `sendMessageToOpenAI` will receive `REQUEST_TOOL_CREATION_DEFINITION` via `toolRegistry.getOpenAITools()` in `main.ts`
    // which eventually calls `formatToolsForOpenAI` in `openaiClient.ts`.

    const response = await sendMessageToOpenAI(userMessageContent, conversation, [/* any actual tools could be here */]);

    expect(response).not.toBeNull();
    expect(response?.role).toBe("assistant");
    expect(response?.content).toBeNull(); // Expect no direct text content
    expect(response?.tool_calls).toBeDefined();
    expect(response?.tool_calls?.length).toBe(1);
    const receivedToolCall = response!.tool_calls![0];
    expect(receivedToolCall.id).toBe(toolCallId);
    expect(receivedToolCall.function.name).toBe('tool_creation');
    expect(JSON.parse(receivedToolCall.function.arguments)).toEqual(requestedToolSpec);
  });

  it('should correctly reflect conversation history management by the caller', async () => {
    const conversation: Conversation = { messages: [] }; 
    const userMessageContent = "Test user message";
    const userMessageForHistory: Message = { role: "user", content: userMessageContent, tool_calls: undefined, tool_call_id: undefined, name: undefined };
    conversation.messages.push(userMessageForHistory);

    const mockedAssistantContent = "Test assistant response";
    mockCreate.mockResolvedValue({
      choices: [{ message: { role: "assistant", content: mockedAssistantContent } }],
      id: "chatcmpl-mockIdHist", object: "chat.completion", created: Date.now(), model: "gpt-4o"
    } as OpenAI.Chat.Completions.ChatCompletion);

    const returnedAssistantMessage = await sendMessageToOpenAI(userMessageContent, conversation, []);
    const expectedReturnedAssistantMessage: Message = { role: "assistant", content: mockedAssistantContent, tool_calls: undefined, name: undefined, tool_call_id: undefined };
    expect(returnedAssistantMessage).toEqual(expectedReturnedAssistantMessage);

    if (returnedAssistantMessage) {
      conversation.messages.push(returnedAssistantMessage);
    }
    const expectedFinalMessages: Message[] = [
      userMessageForHistory,
      expectedReturnedAssistantMessage,
    ];
    expect(conversation.messages).toEqual(expectedFinalMessages);
  });
}); 