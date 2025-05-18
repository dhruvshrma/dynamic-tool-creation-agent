import { ITool } from './toolInterface';
import { weatherTool } from './weatherTool';
import OpenAI from 'openai';
import { ToolCreatorTool } from '../toolCreator';
export class ToolRegistry {
  private tools: Map<string, ITool> = new Map();

  constructor() {
    this.registerTool(weatherTool);
    this.registerTool(new ToolCreatorTool());
    // Register more tools here as they are created
  }

  registerTool(tool: ITool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`Tool with name "${tool.name}" is already registered. Overwriting.`);
    }
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): ITool[] {
    return Array.from(this.tools.values());
  }

  // Helper to get tools formatted for OpenAI API
  getOpenAITools(): OpenAI.Chat.Completions.ChatCompletionTool[] {
    return this.getAllTools().map(tool => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parametersSchema,
      },
    }));
  }
} 