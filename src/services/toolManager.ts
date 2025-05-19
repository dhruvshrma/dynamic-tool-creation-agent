// src/services/toolManager.ts
import { ITool } from '../tools/toolInterface';
import { ToolAnalyzer, ToolAnalysisResult } from './toolAnalyzer';
import OpenAI from 'openai';

/**
 * Manages tool registration, retrieval, and execution
 */
export class ToolManager {
  private tools: Map<string, ITool> = new Map();
  private toolAnalyzer: ToolAnalyzer;
  
  /**
   * Creates a new ToolManager instance
   */
  constructor() {
    this.toolAnalyzer = new ToolAnalyzer();
  }
  
  /**
   * Registers a tool in the registry
   * @param tool The tool to register
   */
  registerTool(tool: ITool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`Tool with name "${tool.name}" is already registered. Overwriting.`);
    }
    this.tools.set(tool.name, tool);
  }
  
  /**
   * Updates an existing tool
   * @param name Name of the tool to update
   * @param newTool The updated tool implementation
   */
  updateTool(name: string, newTool: ITool): void {
    if (!this.tools.has(name)) {
      throw new Error(`Tool '${name}' not found. Cannot update a non-existent tool.`);
    }
    
    // Ensure name consistency
    if (newTool.name !== name) {
      throw new Error(`New tool name '${newTool.name}' does not match the tool being updated '${name}'.`);
    }
    
    this.tools.set(name, newTool);
  }
  
  /**
   * Gets a tool by name
   * @param name The name of the tool to get
   * @returns The tool, or undefined if not found
   */
  getTool(name: string): ITool | undefined {
    return this.tools.get(name);
  }
  
  /**
   * Gets all registered tools
   * @returns Array of all tools
   */
  getAllTools(): ITool[] {
    return Array.from(this.tools.values());
  }
  
  /**
   * Executes a tool with the given arguments
   * @param name The name of the tool to execute
   * @param args JSON string of arguments
   * @returns Promise resolving to the tool result
   */
  async executeTool(name: string, args: string): Promise<string> {
    const tool = this.getTool(name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found.`);
    }
    
    return await tool.execute(args);
  }
  
  /**
   * Analyzes a user query to determine if it requires a new tool or updating existing tools
   * @param query The user query
   * @returns Analysis result
   */
  analyzeQuery(query: string): ToolAnalysisResult {
    // Call the ToolAnalyzer with the current set of tools
    const result = this.toolAnalyzer.analyzeQuery(query, this.getAllTools());
    return result;
  }
  
  /**
   * Helper to get tools formatted for OpenAI API
   * @returns OpenAI-formatted tools
   */
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