// tests/agent.test.ts
import { Agent } from '../src/agent';
import { ConversationManager } from '../src/services/conversationManager';
import { ToolManager } from '../src/services/toolManager';
import { LLMClient } from '../src/services/llmClient';

// Mock dependencies
jest.mock('../src/services/conversationManager');
jest.mock('../src/services/toolManager');
jest.mock('../src/services/llmClient');

describe('Agent', () => {
  let agent: Agent;
  let mockConversationManager: jest.Mocked<ConversationManager>;
  let mockToolManager: jest.Mocked<ToolManager>;
  let mockLLMClient: jest.Mocked<LLMClient>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create fresh mocks for each test
    mockConversationManager = new ConversationManager() as jest.Mocked<ConversationManager>;
    mockToolManager = new ToolManager() as jest.Mocked<ToolManager>;
    mockLLMClient = new LLMClient("fake-api-key") as jest.Mocked<LLMClient>;
    
    // Create agent with mocked dependencies
    agent = new Agent({
      conversationManager: mockConversationManager,
      toolManager: mockToolManager,
      llmClient: mockLLMClient
    });
  });
  
  // Basic tests for now until we implement the real Agent
  test('should initialize without errors', () => {
    expect(agent).toBeDefined();
  });
});