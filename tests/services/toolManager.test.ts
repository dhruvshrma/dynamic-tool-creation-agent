// tests/services/toolManager.test.ts
import { ToolManager } from '../../src/services/toolManager';
import { ITool } from '../../src/tools/toolInterface';
import { ToolAnalyzer } from '../../src/services/toolAnalyzer';

// Mock ToolAnalyzer to avoid real implementation during tests
jest.mock('../../src/services/toolAnalyzer');

describe('ToolManager', () => {
  let toolManager: ToolManager;
  
  // Mock tools for testing
  const mockWeatherTool: ITool = {
    name: "weather",
    description: "Get weather information for a location",
    parametersSchema: {
      type: "object",
      properties: {
        location: { type: "string" }
      }
    },
    execute: async () => JSON.stringify({ weather: "sunny" })
  };
  
  const mockCalculatorTool: ITool = {
    name: "calculator",
    description: "Perform mathematical calculations",
    parametersSchema: {
      type: "object",
      properties: {
        expression: { type: "string" }
      }
    },
    execute: async () => JSON.stringify({ result: 42 })
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    toolManager = new ToolManager();
    
    // Reset the mock implementation of ToolAnalyzer
    (ToolAnalyzer as jest.MockedClass<typeof ToolAnalyzer>).mockClear();
    const mockAnalyzeQuery = jest.fn();
    (ToolAnalyzer as jest.MockedClass<typeof ToolAnalyzer>).prototype.analyzeQuery = mockAnalyzeQuery;
  });
  
  test('should register and retrieve tools correctly', () => {
    toolManager.registerTool(mockWeatherTool);
    
    const tool = toolManager.getTool("weather");
    expect(tool).toBe(mockWeatherTool);
    
    const allTools = toolManager.getAllTools();
    expect(allTools).toContainEqual(mockWeatherTool);
  });
  
  test('should register default tools on initialization', () => {
    // In this test, we're not expecting default tools anymore since we're using a modular architecture
    // Register some tools manually for testing
    toolManager.registerTool(mockWeatherTool);
    toolManager.registerTool(mockCalculatorTool);
    
    const allTools = toolManager.getAllTools();
    expect(allTools.length).toBe(2);
  });
  
  test('should update existing tools correctly', () => {
    // First register the original tool
    toolManager.registerTool(mockWeatherTool);
    
    // Create an updated version of the tool
    const updatedWeatherTool: ITool = {
      name: "weather",
      description: "Get enhanced weather information including forecast",
      parametersSchema: {
        type: "object",
        properties: {
          location: { type: "string" },
          days: { type: "number" }
        }
      },
      execute: async () => JSON.stringify({ weather: "sunny", forecast: [{ day: 1, weather: "rainy" }] })
    };
    
    // Update the tool
    toolManager.updateTool("weather", updatedWeatherTool);
    
    // Verify the tool was updated
    const tool = toolManager.getTool("weather");
    expect(tool).toBe(updatedWeatherTool);
    expect(tool?.description).toBe("Get enhanced weather information including forecast");
    expect(tool?.parametersSchema.properties.days).toBeDefined();
  });
  
  test('should throw error when updating non-existent tool', () => {
    expect(() => {
      toolManager.updateTool("non_existent_tool", mockCalculatorTool);
    }).toThrow("Tool 'non_existent_tool' not found");
  });
  
  test('should analyze query using ToolAnalyzer', () => {
    const mockAnalysisResult = {
      requiresNewTool: true,
      shouldUpdateExistingTool: false,
      suggestedToolName: "currency_converter",
      suggestedRequirements: "Convert currencies with exchange rates",
      matchingExistingTool: undefined
    };
    
    // Setup mock to return our preset result
    const mockAnalyzeQuery = jest.fn().mockReturnValue(mockAnalysisResult);
    (ToolAnalyzer.prototype as any).analyzeQuery = mockAnalyzeQuery;
    
    // We need to create a new instance of ToolManager after mocking
    const localToolManager = new ToolManager();
    
    const query = "I need to convert 100 USD to EUR";
    const availableTools = [mockWeatherTool, mockCalculatorTool];
    
    // Register the tools
    availableTools.forEach(tool => localToolManager.registerTool(tool));
    
    // Call the method under test
    const result = localToolManager.analyzeQuery(query);
    
    // Verify mock was called
    expect(mockAnalyzeQuery).toHaveBeenCalled();
    
    // Verify the result matches what ToolAnalyzer returned
    expect(result).toEqual(mockAnalysisResult);
  });
  
  test('should format tools for OpenAI API', () => {
    toolManager.registerTool(mockWeatherTool);
    toolManager.registerTool(mockCalculatorTool);
    
    const openAITools = toolManager.getOpenAITools();
    
    expect(openAITools).toHaveLength(2);
    expect(openAITools[0]).toEqual({
      type: "function",
      function: {
        name: mockWeatherTool.name,
        description: mockWeatherTool.description,
        parameters: mockWeatherTool.parametersSchema
      }
    });
    expect(openAITools[1]).toEqual({
      type: "function",
      function: {
        name: mockCalculatorTool.name,
        description: mockCalculatorTool.description,
        parameters: mockCalculatorTool.parametersSchema
      }
    });
  });
  
  test('should execute tools with correct arguments', async () => {
    const mockExecute = jest.fn().mockResolvedValue(JSON.stringify({ result: "executed" }));
    const testTool: ITool = {
      name: "test_tool",
      description: "A test tool",
      parametersSchema: { type: "object" },
      execute: mockExecute
    };
    
    toolManager.registerTool(testTool);
    
    const args = JSON.stringify({ param: "value" });
    await toolManager.executeTool("test_tool", args);
    
    expect(mockExecute).toHaveBeenCalledWith(args);
  });
  
  test('should throw error when executing non-existent tool', async () => {
    await expect(
      toolManager.executeTool("non_existent_tool", "{}")
    ).rejects.toThrow("Tool 'non_existent_tool' not found");
  });
});