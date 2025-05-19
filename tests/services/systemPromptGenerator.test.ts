// tests/services/systemPromptGenerator.test.ts
import { SystemPromptGenerator } from '../../src/services/systemPromptGenerator';
import { ITool } from '../../src/tools/toolInterface';

describe('SystemPromptGenerator', () => {
  let promptGenerator: SystemPromptGenerator;
  
  // Mock tools for testing
  const mockTools: ITool[] = [
    {
      name: "weather",
      description: "Get weather information for a location",
      parametersSchema: {
        type: "object",
        properties: {
          location: { type: "string", description: "City and state, e.g. San Francisco, CA" }
        },
        required: ["location"]
      },
      execute: async () => ""
    },
    {
      name: "calculator",
      description: "Perform mathematical calculations",
      parametersSchema: {
        type: "object",
        properties: {
          expression: { type: "string", description: "Mathematical expression to evaluate" }
        },
        required: ["expression"]
      },
      execute: async () => ""
    }
  ];
  
  beforeEach(() => {
    promptGenerator = new SystemPromptGenerator();
  });
  
  test('should generate prompt with available tools', () => {
    const prompt = promptGenerator.generateSystemPrompt(mockTools);
    
    // Verify the prompt contains key parts
    expect(prompt).toContain("highly capable");
    expect(prompt).toContain("Tool Interaction Protocol");
    expect(prompt).toContain("Decision Making");
    
    // Verify the prompt contains tool information
    mockTools.forEach(tool => {
      expect(prompt).toContain(tool.name);
      expect(prompt).toContain(tool.description);
    });
  });
  
  test('should handle empty tools list', () => {
    const prompt = promptGenerator.generateSystemPrompt([]);
    
    // Verify the prompt still contains the core structure
    expect(prompt).toContain("resourceful AI assistant");
    expect(prompt).toContain("Tool Interaction Protocol");
    expect(prompt).toContain("no tools are currently available");
  });
  
  test('should include tool update guidance', () => {
    const prompt = promptGenerator.generateSystemPrompt(mockTools);
    
    // Verify prompt contains guidance about tool updates
    expect(prompt).toContain("update");
    expect(prompt).toContain("operation=\"update\"");
  });
  
  test('should format tool descriptions correctly', () => {
    // Call the private method using type casting to access it
    const formattedTools = (promptGenerator as any).formatToolDescriptions(mockTools);
    
    // Verify format of each tool
    expect(formattedTools).toContain(`"name": "weather"`);
    expect(formattedTools).toContain(`"name": "calculator"`);
    expect(formattedTools).toContain(`"type": "function"`);
    expect(formattedTools).toContain(`"description": "Get weather information for a location"`);
    expect(formattedTools).toContain(`"description": "Perform mathematical calculations"`);
  });
  
  test('should include tool creation guidance with examples', () => {
    const prompt = promptGenerator.generateSystemPrompt(mockTools);
    
    // Check for tool creation guidance
    expect(prompt).toContain("operation=\"create\"");
    expect(prompt).toContain("Tool Invocation");
    
    // Check for examples
    expect(prompt).toContain("Example of tool");
    expect(prompt).toContain("I need to convert");
  });
  
  test('should include intelligent tool creation inference guidance', () => {
    const prompt = promptGenerator.generateSystemPrompt(mockTools);
    
    // Check for inference guidance
    expect(prompt).toContain("Automatic Tool Detection");
    expect(prompt).toContain("proactively detect");
    expect(prompt).toContain("updating an existing tool");
  });
  
  test('should include tool update vs. create decision guidance', () => {
    const prompt = promptGenerator.generateSystemPrompt(mockTools);
    
    expect(prompt).toContain("When to update vs. create");
    expect(prompt).toContain("Update an existing tool when");
    expect(prompt).toContain("Create a new tool when");
  });
});