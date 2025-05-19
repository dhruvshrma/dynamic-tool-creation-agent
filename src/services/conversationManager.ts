import { Message, Conversation } from '../types';
import { ITool } from '../tools/toolInterface';
import { SystemPromptGenerator } from './systemPromptGenerator';


export class ConversationManager {
  private messages: Message[] = [];
  private systemPromptGenerator: SystemPromptGenerator;
  
  constructor() {
    this.systemPromptGenerator = new SystemPromptGenerator();
    this.initializeSystemPrompt();
  }

  private initializeSystemPrompt(): void {
    // Initialize with an empty system prompt
    const systemPrompt = this.systemPromptGenerator.generateSystemPrompt([]);
    this.messages = [{
      role: 'system',
      content: systemPrompt
    }];
  }
  

  addMessage(message: Message): void {
    this.messages.push(message);
  }
  

  getConversationContext(): Conversation {
    return { messages: [...this.messages] };
  }
  

  getRecentConversationContext(limit: number = 10): Conversation {
    const systemMessage = this.messages.find(msg => msg.role === 'system');
    if (!systemMessage) {
      throw new Error('No system message found in conversation history');
    }
    
    const recentMessages = this.messages
      .filter(msg => msg.role !== 'system')
      .slice(-limit);
    
    return {
      messages: [systemMessage, ...recentMessages]
    };
  }
  

  clearHistory(): void {
    const systemMessage = this.messages.find(msg => msg.role === 'system');
    if (systemMessage) {
      this.messages = [systemMessage];
    } else {
      // If no system message exists, reinitialize
      this.initializeSystemPrompt();
    }
  }
  
  

  updateSystemPrompt(tools: ITool[]): void {
    const newSystemPrompt = this.systemPromptGenerator.generateSystemPrompt(tools);
    
    const systemMessageIndex = this.messages.findIndex(msg => msg.role === 'system');
    if (systemMessageIndex >= 0) {
      this.messages[systemMessageIndex] = {
        role: 'system',
        content: newSystemPrompt
      };
    } else {
      this.messages.unshift({
        role: 'system',
        content: newSystemPrompt
      });
    }
  }
}