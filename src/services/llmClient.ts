// src/services/llmClient.ts
import OpenAI from 'openai';
import { Message, Conversation } from '../types';
import { ITool } from '../tools/toolInterface';

/**
 * Options for the LLM client
 */
export interface LLMClientOptions {
  /** The model to use (default: gpt-4o) */
  model?: string;
  /** Maximum number of tokens to generate */
  maxTokens?: number;
  /** Temperature for sampling (0.0 to 2.0) */
  temperature?: number;
}

/**
 * Client for interacting with OpenAI's LLM API
 */
export class LLMClient {
  private openaiClient: OpenAI;
  private options: LLMClientOptions;
  
  /**
   * Creates a new LLM client
   * @param apiKey OpenAI API key
   * @param options Client options
   */
  constructor(apiKey: string, options: LLMClientOptions = {}) {
    this.openaiClient = new OpenAI({ apiKey });
    this.options = {
      model: 'gpt-4o',
      maxTokens: 1000,
      temperature: 0.7,
      ...options
    };
  }
  
  /**
   * Sends a message to the LLM and gets a response
   * @param content The message content
   * @param conversation The current conversation context
   * @param tools Tools to make available to the LLM
   * @returns Promise resolving to the LLM's response message
   */
  async sendMessage(
    content: string, 
    conversation: Conversation, 
    tools: ITool[] = []
  ): Promise<Message> {
    try {
      // Prepare messages for the API
      const messages = [
        ...conversation.messages,
        { role: 'user', content } as Message
      ];
      
      // Prepare request parameters
      const requestParams: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
        model: this.options.model!,
        messages: messages as any,
        max_tokens: this.options.maxTokens,
        temperature: this.options.temperature
      };
      
      // Add tools if provided
      if (tools.length > 0) {
        requestParams.tools = tools.map(tool => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parametersSchema
          }
        }));
        requestParams.tool_choice = 'auto';
      }
      
      // Send the request
      const response = await this.openaiClient.chat.completions.create(requestParams);
      
      // Check for a valid response
      if (!response.choices || response.choices.length === 0) {
        throw new Error('Invalid response from OpenAI: No choices returned');
      }
      
      const choice = response.choices[0];
      
      if (!choice.message) {
        throw new Error('Invalid response from OpenAI: No message in choice');
      }
      
      // Convert OpenAI message to our Message format
      return {
        role: 'assistant',
        content: choice.message.content,
        tool_calls: choice.message.tool_calls as any
      };
    } catch (error) {
      // Rethrow the error
      throw error;
    }
  }
}