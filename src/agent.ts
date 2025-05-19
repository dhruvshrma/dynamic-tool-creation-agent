import { Message, Conversation, ToolCall } from './types';
import { ConversationManager } from './services/conversationManager';
import { ToolManager } from './services/toolManager';
import { LLMClient } from './services/llmClient';
import { ITool } from './tools/toolInterface';

export interface AgentOptions {
  conversationManager?: ConversationManager;
  toolManager?: ToolManager;
  llmClient?: LLMClient;
  apiKey?: string;
  maxToolResponseCycles?: number;
}

export class Agent {
  private conversationManager: ConversationManager;
  private toolManager: ToolManager;
  private llmClient: LLMClient;
  private maxToolResponseCycles: number;
  
  constructor(options: AgentOptions = {}) {
    this.conversationManager = options.conversationManager || new ConversationManager();
    this.toolManager = options.toolManager || new ToolManager();
    
    if (options.llmClient) {
      this.llmClient = options.llmClient;
    } else if (options.apiKey) {
      this.llmClient = new LLMClient(options.apiKey);
    } else {
      throw new Error('Either llmClient or apiKey must be provided');
    }
    
    this.maxToolResponseCycles = options.maxToolResponseCycles || 10;
    
    console.log("Agent initialized");
  }
  

  async processUserInput(input: string): Promise<Message> {
    const userMessage: Message = { role: 'user', content: input };
    this.conversationManager.addMessage(userMessage);
    
    const toolAnalysis = this.toolManager.analyzeQuery(input);
    
    const conversation = this.conversationManager.getConversationContext();
    
    const availableTools = this.toolManager.getAllTools();
    
    let cyclesRemaining = this.maxToolResponseCycles;
    
    if (toolAnalysis.requiresNewTool || toolAnalysis.shouldUpdateExistingTool) {
      const operationType = toolAnalysis.shouldUpdateExistingTool ? 'update' : 'create';
      const toolName = toolAnalysis.shouldUpdateExistingTool 
        ? toolAnalysis.matchingExistingTool?.name 
        : toolAnalysis.suggestedToolName;
      
      const hintMessage: Message = { 
        role: 'system', 
        content: `I've detected that the user may want to ${operationType} a tool called "${toolName}". 
        Consider asking the user if they want to ${operationType} this tool to handle their request.
        Requirements: ${toolAnalysis.suggestedRequirements}
        You can use the 'request_tool_creation' tool with operation="${operationType}" to ${operationType} this tool.`
      };
      
      const tempConversation: Conversation = {
        messages: [...conversation.messages, hintMessage]
      };
      
      return await this.sendToLLMAndProcessResponse(input, tempConversation, availableTools, cyclesRemaining);
    }
    
    return await this.sendToLLMAndProcessResponse(input, conversation, availableTools, cyclesRemaining);
  }
  
  private async sendToLLMAndProcessResponse(
    input: string,
    conversation: Conversation,
    availableTools: ITool[],
    cyclesRemaining: number
  ): Promise<Message> {

    const llmResponse = await this.llmClient.sendMessage(input, conversation, availableTools);
    
    this.conversationManager.addMessage(llmResponse);
    
    if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
      if (cyclesRemaining <= 0) {
        const errorMessage: Message = {
          role: 'assistant',
          content: 'I apologize, but I seem to be stuck in a loop. Could you try rephrasing your request?'
        };
        this.conversationManager.addMessage(errorMessage);
        return errorMessage;
      }
      
      for (const toolCall of llmResponse.tool_calls) {
        await this.handleToolCall(toolCall);
      }
      
      const nextConversation = this.conversationManager.getConversationContext();
      const nextInput = "Proceed based on the tool results."; 
      
      return await this.sendToLLMAndProcessResponse(
        nextInput,
        nextConversation,
        availableTools,
        cyclesRemaining - 1
      );
    }
    
    return llmResponse;
  }
  

  async handleToolCall(toolCall: ToolCall): Promise<void> {
    const toolName = toolCall.function.name;
    const toolArgs = toolCall.function.arguments;
    
    try {
      const toolResult = await this.toolManager.executeTool(toolName, toolArgs);
      
      if (toolName === 'request_tool_creation') {
        await this.handleToolCreationResult(toolCall.id, toolResult);
      } else {
        const toolResponseMessage: Message = {
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolName,
          content: toolResult
        };
        
        this.conversationManager.addMessage(toolResponseMessage);
      }
    } catch (error: any) {
      const errorMessage: Message = {
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolName,
        content: JSON.stringify({ error: error.message })
      };
      
      this.conversationManager.addMessage(errorMessage);
    }
  }
  

  private async handleToolCreationResult(toolCallId: string, toolResult: string): Promise<void> {
    try {
      const result = JSON.parse(toolResult);
      
      const toolResponseMessage: Message = {
        role: 'tool',
        tool_call_id: toolCallId,
        name: 'request_tool_creation',
        content: toolResult
      };
      
      this.conversationManager.addMessage(toolResponseMessage);
      
      if (result.success) {
        this.conversationManager.updateSystemPrompt(this.toolManager.getAllTools());
      }
    } catch (error) {
      const errorMessage: Message = {
        role: 'tool',
        tool_call_id: toolCallId,
        name: 'request_tool_creation',
        content: JSON.stringify({ 
          error: 'Failed to parse tool creation result'
        })
      };
      
      this.conversationManager.addMessage(errorMessage);
    }
  }
}