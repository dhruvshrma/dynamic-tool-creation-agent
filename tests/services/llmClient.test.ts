// tests/services/llmClient.test.ts
import { LLMClient } from '../../src/services/llmClient';
import { Conversation, Message } from '../../src/types';
import { ITool } from '../../src/tools/toolInterface';
import OpenAI from 'openai';

// Mock OpenAI
jest.mock('openai');

describe('LLMClient', () => {
  let llmClient: LLMClient;
  let mockCreate: jest.Mock;
  
  // Mock tools for testing
  const mockTools: ITool[] = [
    {
      name: "weather",
      description: "Get weather information",
      parametersSchema: { type: "object" },
      execute: async () => ""
    }
  ];
  
  // Test conversation
  const testConversation: Conversation = {
    messages: [
      { role: "system", content: "You are a helpful assistant" },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" }
    ]
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up OpenAI mock
    mockCreate = jest.fn();
    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }) as unknown as OpenAI);
    
    llmClient = new LLMClient('fake-api-key');
  });
  
  test('should initialize with API key', () => {
    expect(OpenAI).toHaveBeenCalledWith({ apiKey: 'fake-api-key' });
  });
  
  test('should send message to OpenAI and receive response', async () => {
    const userMessage = "What's the weather?";
    const mockResponse = {
      choices: [
        {
          message: {
            role: "assistant",
            content: "I'll check the weather for you."
          }
        }
      ]
    };
    mockCreate.mockResolvedValue(mockResponse);
    
    const response = await llmClient.sendMessage(userMessage, testConversation, []);
    
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      messages: [
        { role: "system", content: "You are a helpful assistant" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
        { role: "user", content: userMessage }
      ]
    }));
    
    expect(response).toEqual({
      role: "assistant",
      content: "I'll check the weather for you."
    });
  });
  
  test('should include tools in OpenAI request when provided', async () => {
    const userMessage = "What's the weather in New York?";
    const mockResponse = {
      choices: [
        {
          message: {
            role: "assistant",
            content: "I'll check the weather for you."
          }
        }
      ]
    };
    mockCreate.mockResolvedValue(mockResponse);
    
    await llmClient.sendMessage(userMessage, testConversation, mockTools);
    
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      tools: [
        {
          type: "function",
          function: {
            name: "weather",
            description: "Get weather information",
            parameters: { type: "object" }
          }
        }
      ],
      tool_choice: "auto"
    }));
  });
  
  test('should handle tool calls in OpenAI response', async () => {
    const userMessage = "What's the weather in New York?";
    const mockResponse = {
      choices: [
        {
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "call_123",
                type: "function",
                function: {
                  name: "weather",
                  arguments: JSON.stringify({ location: "New York" })
                }
              }
            ]
          }
        }
      ]
    };
    mockCreate.mockResolvedValue(mockResponse);
    
    const response = await llmClient.sendMessage(userMessage, testConversation, mockTools);
    
    expect(response).toEqual({
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "call_123",
          type: "function",
          function: {
            name: "weather",
            arguments: JSON.stringify({ location: "New York" })
          }
        }
      ]
    });
  });
  
  test('should handle OpenAI API errors', async () => {
    const userMessage = "Test message";
    mockCreate.mockRejectedValue(new Error("API Error"));
    
    await expect(llmClient.sendMessage(userMessage, testConversation, [])).rejects.toThrow("API Error");
  });
  
  test('should handle empty or invalid OpenAI response', async () => {
    const userMessage = "Test message";
    mockCreate.mockResolvedValue({ choices: [] });
    
    await expect(llmClient.sendMessage(userMessage, testConversation, [])).rejects.toThrow("Invalid response from OpenAI");
  });
  
  test('should use correct model', async () => {
    const userMessage = "Test message";
    const mockResponse = {
      choices: [
        {
          message: {
            role: "assistant",
            content: "Test response"
          }
        }
      ]
    };
    mockCreate.mockResolvedValue(mockResponse);
    
    await llmClient.sendMessage(userMessage, testConversation, []);
    
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: "gpt-4o"
    }));
  });
  
  test('should allow changing model', async () => {
    const userMessage = "Test message";
    const mockResponse = {
      choices: [
        {
          message: {
            role: "assistant",
            content: "Test response"
          }
        }
      ]
    };
    mockCreate.mockResolvedValue(mockResponse);
    
    // Create client with different model
    const customClient = new LLMClient('fake-api-key', { model: "gpt-3.5-turbo" });
    await customClient.sendMessage(userMessage, testConversation, []);
    
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: "gpt-3.5-turbo"
    }));
  });
});