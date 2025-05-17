// src/tools/exampleTool.ts
import { ITool } from './toolInterface';

export class ExampleTool implements ITool {
  public name = "example_tool";
  public description = "An example tool that takes a message and returns it in uppercase. Input should be a JSON string with a 'message' property. e.g. {\"message\": \"hello\"}";
  
  public parametersSchema = {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "The message to be converted to uppercase.",
      },
    },
    required: ["message"],
  };

  public async execute(args: string): Promise<string> {
    try {
      const params = JSON.parse(args);
      if (typeof params.message !== 'string') {
        return JSON.stringify({ error: "Invalid arguments. 'message' property must be a string." });
      }
      return JSON.stringify({ result: params.message.toUpperCase() });
    } catch (error: any) {
      return JSON.stringify({ error: "Failed to parse arguments or execute tool: " + error.message });
    }
  }
} 