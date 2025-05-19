import * as openaiClient from '../src/openaiClient';
import { Message } from '../src/types';

import { mockRlInstance, mockRlOnLineCallback } from '../__mocks__/readline'; // Updated import

// Mock openaiClient
jest.mock('../src/openaiClient');
const mockSendMessageToOpenAI = openaiClient.sendMessageToOpenAI as jest.MockedFunction<typeof openaiClient.sendMessageToOpenAI>;

// Mock console
let consoleLogSpy: jest.SpyInstance;
let consoleErrorSpy: jest.SpyInstance;

describe('Main Integration Test - Tool Creation Request', () => {
  beforeEach(() => {
    jest.clearAllMocks(); 
    
    // Set NODE_ENV to 'test' to prevent process.exit in main.ts
    process.env.NODE_ENV = 'test';
    
    // Reset the exported callback variable in the manual mock
    // We need to use require here if we want to modify the exported variable of a module
    // or ensure the mock itself has a reset function.
    // For a `let` exported variable, direct assignment through require should work for resetting its state for the test.
    const mockReadlineModule = require('../__mocks__/readline');
    // mockReadlineModule.mockRlOnCallback = null; // Old name
    mockReadlineModule.mockRlOnLineCallback = null; // Updated name
    mockReadlineModule.mockRlOnCloseCallback = null; // Also reset the close callback

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Resetting mockRlInstance calls (it's imported directly)
    mockRlInstance.on.mockClear();
    mockRlInstance.prompt.mockClear();
    mockRlInstance.close.mockClear();
    mockRlInstance.setPrompt.mockClear();
    // If mockRlInstance itself needs to be reset (e.g. if it was a jest.fn()), do that here.
    // But its methods are jest.fn(), so clearing them is usually enough.
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();

    // Explicitly close the mocked readline interface
    if (mockRlInstance && typeof mockRlInstance.close === 'function') {
      mockRlInstance.close();
    }
  });

  test('should request tool creation for currency conversion and handle LLM responses', async () => {
    const currencyConverterSpec = { 
      tool_name: "currency_converter",
      tool_description: "Converts an amount from one currency to another based on current exchange rates.",
      input_parameters_schema: {
        type: "object", 
        properties: {
          amount: { type: "number", description: "The amount of money to convert." },
          source_currency: { type: "string", description: "The currency code of the original amount (e.g., 'USD')." },
          target_currency: { type: "string", description: "The currency code to convert to (e.g., 'EUR')." }
        },
        required: ["amount", "source_currency", "target_currency"]
      },
      output_description: "A JSON object containing the converted amount and the target currency, e.g., { \"converted_amount\": 85.00, \"target_currency\": \"EUR\" }."
    }; 

    // --- Stage 1 & 2 mocks for sendMessageToOpenAI (as before) ---
    mockSendMessageToOpenAI.mockImplementationOnce(async (currentMessageContent, conversation, availableTools) => {
      expect(conversation.messages[0].role).toBe('system');
      expect(conversation.messages[0].content).toContain("You are a helpful AI assistant");
      // expect(conversation.messages[0].content).toContain(REQUEST_TOOL_CREATION_DEFINITION.function.name);
      expect(currentMessageContent).toBe("Convert 100 USD to EUR");
      expect(conversation.messages.slice(-1)[0].content).toBe("Convert 100 USD to EUR");
      expect(conversation.messages.slice(-1)[0].role).toBe("user");
        expect(availableTools?.find(t => t.name === 'tool_creation')).toBeDefined();
      expect(availableTools?.find(t => t.name === 'get_weather')).toBeDefined();
      return Promise.resolve({
        role: "assistant",
        content: null,
        tool_calls: [{
          id: "call_create_curr_conv_123",
          type: "function",
          function: {
            name: 'tool_creation',
            arguments: JSON.stringify(currencyConverterSpec)
          }
        }]
      } as Message);
    });
    mockSendMessageToOpenAI.mockImplementationOnce(async (currentMessageContent, conversation, availableTools) => {
      expect(currentMessageContent).toMatch(/Tool creation request for 'currency_converter' has been processed|Proceed based on the tool results/i);
      const messages = conversation.messages;
      expect(messages.length).toBe(4);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
      expect(messages[1].content).toBe("Convert 100 USD to EUR");
      expect(messages[2].role).toBe('assistant');
      expect(messages[2].tool_calls?.[0]?.function.name).toBe('tool_creation');
      expect(messages[2].tool_calls?.[0]?.id).toBe("call_create_curr_conv_123");
      expect(messages[3].role).toBe('tool');
      expect(messages[3].tool_call_id).toBe("call_create_curr_conv_123");
      expect(messages[3].name).toBe('tool_creation');
      expect(messages[3].content).toContain("Tool creation request for 'currency_converter' noted. This feature is under development.");
      expect(availableTools?.find(t => t.name === 'tool_creation')).toBeDefined();
      return Promise.resolve({
        role: "assistant",
        content: "Okay, I've noted your request to create a currency converter tool. I will inform you when it's available."
      } as Message);
    });

    // Dynamically import and run main AFTER mocks are set up
    await jest.isolateModules(async () => {
      await import('../src/main');
    });

    // Check that mockRlInstance.on was called by main.ts
    expect(mockRlInstance.on).toHaveBeenCalledWith('line', expect.any(Function));

    // The mockRlOnCallbackFromManualMock should now be set by the mock's .on() method
    // if (!mockRlOnCallbackFromManualMock) { // Old name
    if (!mockRlOnLineCallback) { // Updated name
      throw new Error("readline 'line' event callback was not set up by main() via mock");
    }

    // Simulate user typing the command by invoking the captured callback
    // await mockRlOnCallbackFromManualMock("Convert 100 USD to EUR"); // Old name
    await mockRlOnLineCallback("Convert 100 USD to EUR"); // Updated name

    // --- Verifications ---
    expect(mockSendMessageToOpenAI).toHaveBeenCalledTimes(2);
    
    // Verify console logs (as before)
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Assistant is requesting to create a new tool:"));
    expect(consoleLogSpy).toHaveBeenCalledWith("Tool Name:", currencyConverterSpec.tool_name);
    expect(consoleLogSpy).toHaveBeenCalledWith("Tool Description:", currencyConverterSpec.tool_description);
    expect(consoleLogSpy).toHaveBeenCalledWith("Input Schema:", currencyConverterSpec.input_parameters_schema);
    expect(consoleLogSpy).toHaveBeenCalledWith("Output Description:", currencyConverterSpec.output_description);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Acknowledged tool creation request for currency_converter. Passing result to LLM."));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/AI: Okay, I've noted your request to create a currency converter tool. I will inform you when it's available./i));

    // Verify readline prompt (as before)
    expect(mockRlInstance.prompt).toHaveBeenCalledTimes(2);
  });
}); 