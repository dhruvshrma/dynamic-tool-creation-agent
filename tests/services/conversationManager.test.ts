// tests/services/conversationManager.test.ts
import { ConversationManager } from '../../src/services/conversationManager';
import { Message } from '../../src/types';
import { ITool } from '../../src/tools/toolInterface';
import { SystemPromptGenerator } from '../../src/services/systemPromptGenerator';

// Mock SystemPromptGenerator to avoid real implementation during tests
jest.mock('../../src/services/systemPromptGenerator');

describe('ConversationManager', () => {
  let conversationManager: ConversationManager;
  
  // Mock system prompt generator
  const mockSystemPrompt = "You are an AI assistant with access to the following tools...";
  
  // Mock tools for testing
  const mockTools: ITool[] = [
    {
      name: "weather",
      description: "Get weather information",
      parametersSchema: { type: "object" },
      execute: async () => ""
    },
    {
      name: "calculator",
      description: "Perform calculations",
      parametersSchema: { type: "object" },
      execute: async () => ""
    }
  ];
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up SystemPromptGenerator mock
    (SystemPromptGenerator as jest.MockedClass<typeof SystemPromptGenerator>).mockClear();
    (SystemPromptGenerator.prototype.generateSystemPrompt as jest.Mock) = 
      jest.fn().mockReturnValue(mockSystemPrompt);
    
    conversationManager = new ConversationManager();
  });
  
  test('should initialize with system prompt', () => {
    expect(SystemPromptGenerator.prototype.generateSystemPrompt).toHaveBeenCalled();
    
    const conversation = conversationManager.getConversationContext();
    expect(conversation.messages.length).toBe(1);
    expect(conversation.messages[0].role).toBe("system");
    expect(conversation.messages[0].content).toBe(mockSystemPrompt);
  });
  
  test('should add user message to conversation', () => {
    const userMessage: Message = {
      role: "user",
      content: "Hello, how are you?"
    };
    
    conversationManager.addMessage(userMessage);
    
    const conversation = conversationManager.getConversationContext();
    expect(conversation.messages.length).toBe(2); // System prompt + user message
    expect(conversation.messages[1]).toBe(userMessage);
  });
  
  test('should add assistant message to conversation', () => {
    const assistantMessage: Message = {
      role: "assistant",
      content: "I'm doing well, thank you!"
    };
    
    conversationManager.addMessage(assistantMessage);
    
    const conversation = conversationManager.getConversationContext();
    expect(conversation.messages.length).toBe(2); // System prompt + assistant message
    expect(conversation.messages[1]).toBe(assistantMessage);
  });
  
  test('should add tool message to conversation', () => {
    const toolMessage: Message = {
      role: "tool",
      tool_call_id: "call_123",
      name: "weather",
      content: JSON.stringify({ weather: "sunny" })
    };
    
    conversationManager.addMessage(toolMessage);
    
    const conversation = conversationManager.getConversationContext();
    expect(conversation.messages.length).toBe(2); // System prompt + tool message
    expect(conversation.messages[1]).toBe(toolMessage);
  });
  
  test('should clear conversation history except system prompt', () => {
    // Add some messages
    conversationManager.addMessage({ role: "user", content: "Hello" });
    conversationManager.addMessage({ role: "assistant", content: "Hi there" });
    
    // Verify messages were added
    expect(conversationManager.getConversationContext().messages.length).toBe(3);
    
    // Clear history
    conversationManager.clearHistory();
    
    // Verify only system message remains
    const conversation = conversationManager.getConversationContext();
    expect(conversation.messages.length).toBe(1);
    expect(conversation.messages[0].role).toBe("system");
  });
  
  test('should update system prompt with available tools', () => {
    // Setup a new mock value for the updated system prompt
    const updatedSystemPrompt = "Updated system prompt with new tools...";
    (SystemPromptGenerator.prototype.generateSystemPrompt as jest.Mock).mockReturnValue(updatedSystemPrompt);
    
    // Update system prompt with tools
    conversationManager.updateSystemPrompt(mockTools);
    
    // Verify SystemPromptGenerator was called with the tools
    expect(SystemPromptGenerator.prototype.generateSystemPrompt).toHaveBeenCalledWith(mockTools);
    
    // Verify the system prompt was updated
    const conversation = conversationManager.getConversationContext();
    expect(conversation.messages[0].content).toBe(updatedSystemPrompt);
  });
  
  test('should get recent conversation context with limited history', () => {
    // Add many messages to exceed the default limit
    for (let i = 0; i < 15; i++) {
      conversationManager.addMessage({ 
        role: i % 2 === 0 ? "user" : "assistant", 
        content: `Message ${i}` 
      });
    }
    
    // Get recent conversation with a limit of 5 messages
    const recentConversation = conversationManager.getRecentConversationContext(5);
    
    // Verify we get the system prompt + the 5 most recent messages
    expect(recentConversation.messages.length).toBe(6); // System + 5 recent
    expect(recentConversation.messages[0].role).toBe("system"); // System prompt is always included
    
    // Check that we have the 5 most recent messages in the right order
    for (let i = 1; i <= 5; i++) {
      const messageIndex = 15 - 5 + i - 1; // Calculate the original index of this message
      expect(recentConversation.messages[i].content).toBe(`Message ${messageIndex}`);
    }
  });
  
  test('should handle tracking multiple conversations with separate history', () => {
    // Create a second conversation manager
    const secondManager = new ConversationManager();
    
    // Add different messages to each manager
    conversationManager.addMessage({ role: "user", content: "First conversation message" });
    secondManager.addMessage({ role: "user", content: "Second conversation message" });
    
    // Verify each manager has its own separate history
    const firstConversation = conversationManager.getConversationContext();
    const secondConversation = secondManager.getConversationContext();
    
    expect(firstConversation.messages.length).toBe(2);
    expect(secondConversation.messages.length).toBe(2);
    expect(firstConversation.messages[1].content).toBe("First conversation message");
    expect(secondConversation.messages[1].content).toBe("Second conversation message");
  });
});