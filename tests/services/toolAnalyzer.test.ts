// tests/services/toolAnalyzer.test.ts
import { ToolAnalyzer } from '../../src/services/toolAnalyzer';
import { ITool } from '../../src/tools/toolInterface';

describe('ToolAnalyzer', () => {
  let toolAnalyzer: ToolAnalyzer;
  
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
    execute: async () => ""
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
    execute: async () => ""
  };
  
  beforeEach(() => {
    toolAnalyzer = new ToolAnalyzer();
  });
  
  test('should detect explicit tool creation intent', () => {
    const queries = [
      "Create a tool that can generate images",
      "I need a tool for converting currencies",
      "Can you make a tool that analyzes sentiment?",
      "Please build a tool to fetch stock prices"
    ];
    
    queries.forEach(query => {
      const result = toolAnalyzer.analyzeQuery(query, [mockWeatherTool, mockCalculatorTool]);
      expect(result.requiresNewTool).toBe(true);
    });
  });
  
  test('should detect implicit tool creation intent', () => {
    const queries = [
      "I want to convert 100 USD to EUR",
      "Can you generate an image of a cat?",
      "What's the current stock price of AAPL?",
      "Analyze the sentiment of this tweet"
    ];
    
    queries.forEach(query => {
      const result = toolAnalyzer.analyzeQuery(query, [mockWeatherTool, mockCalculatorTool]);
      expect(result.requiresNewTool).toBe(true);
    });
  });
  
  test('should not suggest tool creation when existing tool can handle query', () => {
    const queries = [
      "What's the weather in New York?",
      "Calculate 5 * 7",
      "Tell me the weather forecast for London",
      "What's 25 / 5?"
    ];
    
    queries.forEach(query => {
      const result = toolAnalyzer.analyzeQuery(query, [mockWeatherTool, mockCalculatorTool]);
      expect(result.requiresNewTool).toBe(false);
      expect(result.matchingExistingTool).toBeDefined();
    });
  });
  
  test('should identify matching existing tools for updates', () => {
    const queries = [
      "Can you update the weather tool to show forecasts for the next 5 days?",
      "Enhance the calculator to handle scientific notation",
      "Modify the weather tool to include humidity information",
      "Add support for complex numbers to the calculator"
    ];
    
    const results = queries.map(query => 
      toolAnalyzer.analyzeQuery(query, [mockWeatherTool, mockCalculatorTool])
    );
    
    expect(results[0].shouldUpdateExistingTool).toBe(true);
    expect(results[0].matchingExistingTool?.name).toBe("weather");
    
    expect(results[1].shouldUpdateExistingTool).toBe(true);
    expect(results[1].matchingExistingTool?.name).toBe("calculator");
    
    expect(results[2].shouldUpdateExistingTool).toBe(true);
    expect(results[2].matchingExistingTool?.name).toBe("weather");
    
    expect(results[3].shouldUpdateExistingTool).toBe(true);
    expect(results[3].matchingExistingTool?.name).toBe("calculator");
  });
  
  test('should suggest appropriate tool names based on query', () => {
    const testCases = [
      { query: "I need a tool for converting currencies", expected: "currency_converter" },
      { query: "Create a tool that generates images", expected: "image_generator" },
      { query: "Build a tool to fetch stock prices", expected: "stock_price_fetcher" },
      { query: "Make a tool for sentiment analysis", expected: "sentiment_analyzer" }
    ];
    
    testCases.forEach(({ query, expected }) => {
      const result = toolAnalyzer.analyzeQuery(query, [mockWeatherTool, mockCalculatorTool]);
      expect(result.suggestedToolName?.toLowerCase()).toContain(expected);
    });
  });
  
  test('should extract requirements from query', () => {
    const query = "Create a tool that can convert currencies using current exchange rates. It should take an amount, source currency, and target currency as input.";
    
    const result = toolAnalyzer.analyzeQuery(query, [mockWeatherTool, mockCalculatorTool]);
    
    expect(result.suggestedRequirements).toContain("convert currencies");
    expect(result.suggestedRequirements).toContain("exchange rates");
    expect(result.suggestedRequirements).toContain("amount");
    expect(result.suggestedRequirements).toContain("source currency");
    expect(result.suggestedRequirements).toContain("target currency");
  });
  
  test('should handle informational queries without suggesting tool creation', () => {
    const queries = [
      "What is the capital of France?",
      "Tell me about quantum physics",
      "Who was Albert Einstein?",
      "What are the benefits of exercise?"
    ];
    
    queries.forEach(query => {
      const result = toolAnalyzer.analyzeQuery(query, [mockWeatherTool, mockCalculatorTool]);
      expect(result.requiresNewTool).toBe(false);
      expect(result.shouldUpdateExistingTool).toBe(false);
      expect(result.matchingExistingTool).toBeUndefined();
    });
  });
});