import readline from 'readline';
import fs from 'fs'; 
import path from 'path'; 
import { execSync } from 'child_process'; 
import { sendMessageToOpenAI } from './openaiClient';
import { Message, Conversation } from './types'; 
import { ToolRegistry } from './tools/toolRegistry';
import { getMainSystemPrompt } from './prompts';
import { ToolCreationResult } from './toolCreator'; 
import dotenv from 'dotenv';

dotenv.config();

const RESET = '\x1b[0m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const GREEN = '\x1b[32m';
const MAGENTA = '\x1b[35m'; 
const RED = '\x1b[31m'; 

const MAX_TOOL_RESPONSE_CYCLES = 10; 

const toolRegistry = new ToolRegistry();

const systemPromptContent = getMainSystemPrompt(toolRegistry.getOpenAITools());
let systemPromptMessage: Message = {
  role: "system",
  content: systemPromptContent,
  name: undefined,
  tool_call_id: undefined,
  tool_calls: undefined,
};

const conversation: Conversation = { messages: [systemPromptMessage] };

console.log(`${YELLOW}Agent starting...${RESET}`);
console.log(`${YELLOW}System Prompt: ${systemPromptMessage.content}${RESET}`); // Optional: Can be very verbose
console.log(`${YELLOW}Enter your message below (or type 'exit' to quit, 'history' to see conversation, 'clear' to reset history).${RESET}`);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: `${GREEN}You: ${RESET}`,
});

rl.prompt();

async function processLLMResponse(assistantMessage: Message | null, cyclesRemaining: number): Promise<void> {
  if (!assistantMessage) {
    console.log(`${BLUE}AI: ${RESET}${YELLOW}No response or an error occurred.${RESET}`);
    return;
  }

  if (cyclesRemaining <= 0) {
    console.error(`${RED}Error: Maximum tool response cycles reached. Aborting to prevent infinite loop.${RESET}`);
    console.log(`${BLUE}AI: ${RESET}${YELLOW}I seem to be stuck in a loop. Please try rephrasing your request or type 'clear' to reset.${RESET}`);
    return;
  }

  conversation.messages.push(assistantMessage);

  if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
    let aRealToolWasExecuted = false;
    let toolCreationAttempted = false;
    let toolCreationSuccessful = false;
    let createdToolName: string | undefined;

    for (const toolCall of assistantMessage.tool_calls) {
      if (toolCall.function.name === 'request_tool_creation') {
        toolCreationAttempted = true;
        console.log(`${MAGENTA}AI is requesting tool creation via ToolCreatorTool...${RESET}`);
        const toolCreator = toolRegistry.getTool('request_tool_creation');

        if (toolCreator) {
          try {
            const toolResultString = await toolCreator.execute(toolCall.function.arguments);
            const creationResult = JSON.parse(toolResultString) as ToolCreationResult;
            
            console.log(`${MAGENTA}ToolCreatorTool execution finished. Result: ${JSON.stringify(creationResult, null, 2)}${RESET}`);

            let toolResponseMessageContent: string;

            if (creationResult.success && creationResult.toolCode && creationResult.toolName) {
              console.log(`${GREEN}Tool '${creationResult.toolName}' generated successfully by LLM.${RESET}`);
              createdToolName = creationResult.toolName;
              const toolFileName = `${createdToolName.replace(/[^a-zA-Z0-9_]/g, '_')}.ts`; 

              const generatedSrcToolsDir = path.resolve(__dirname, '..', 'src', 'tools', 'generated');
              const toolSrcFilePath = path.join(generatedSrcToolsDir, toolFileName);

              if (!fs.existsSync(generatedSrcToolsDir)) {
                fs.mkdirSync(generatedSrcToolsDir, { recursive: true });
              }
              fs.writeFileSync(toolSrcFilePath, creationResult.toolCode);
              console.log(`${GREEN}Tool '${createdToolName}' TypeScript source saved to ${toolSrcFilePath}${RESET}`);
              
              try {
                console.log(`${YELLOW}Attempting to compile the project with the new tool...${RESET}`);
                execSync('npx tsc', { stdio: 'inherit' }); 
                console.log(`${GREEN}TypeScript compilation finished (or attempted).${RESET}`);
              } catch (compileError: any) {
                console.error(`${RED}Error during TypeScript compilation: ${compileError.message}${RESET}`);
             
              }

              try {
                const relativeToolImportPath = `./tools/generated/${toolFileName.replace('.ts', '.js')}`;
                console.log(`${YELLOW}Attempting to dynamically import compiled tool from: ${relativeToolImportPath} (relative to dist/main.js)${RESET}`);
                
                await new Promise(resolve => setTimeout(resolve, 1000)); 

                const newToolModule = await import(relativeToolImportPath);

                if (newToolModule.default) {
                  const NewToolClass = newToolModule.default;
                  const newToolInstance = new NewToolClass();
                  toolRegistry.registerTool(newToolInstance);
                  console.log(`${GREEN}Tool '${createdToolName}' dynamically imported and registered successfully.${RESET}`);
                  toolCreationSuccessful = true;
                  toolResponseMessageContent = `Tool '${createdToolName}' was successfully created, saved to src, and an attempt was made to import and register the compiled version. It should now be available for use.`;
                  
                  systemPromptMessage.content = getMainSystemPrompt(toolRegistry.getOpenAITools());
                  if(conversation.messages.length > 0 && conversation.messages[0].role === 'system') {
                    conversation.messages[0] = systemPromptMessage;
                  }
                  console.log(`${YELLOW}System prompt updated with new tool information.${RESET}`);
                } else {
                  throw new Error('Generated tool module does not have a default export.');
                }
              } catch (importError: any) {
                console.error(`${RED}Error dynamically importing or registering tool '${createdToolName}': ${importError.message}${RESET}`);
                console.error(importError.stack);
                toolResponseMessageContent = `Tool '${createdToolName}' TypeScript source was generated and saved to 'src/tools/generated/', but failed during dynamic import/registration (likely needs compilation to JS in 'dist'). Error: ${importError.message}`;
              }
            } else {
              const toolNameForError = creationResult.toolName || JSON.parse(toolCall.function.arguments).tool_name || "unknown_tool";
              console.error(`${RED}Failed to generate tool code for '${toolNameForError}'. Error: ${creationResult.error}${RESET}`);
              toolResponseMessageContent = `Tool creation attempt for '${toolNameForError}' failed. Error: ${creationResult.error}`;
            }
            const toolResponseMessage: Message = {
              role: "tool",
              tool_call_id: toolCall.id,
              name: 'request_tool_creation', 
              content: toolResponseMessageContent,
            };
            conversation.messages.push(toolResponseMessage);

          } catch (e: any) {
            console.error(`${RED}Error in 'request_tool_creation' block: ${e.message}${RESET}`);
            const errorResponseMessage: Message = {
              role: "tool",
              tool_call_id: toolCall.id,
              name: 'request_tool_creation',
              content: `Error processing 'request_tool_creation' tool call: ${e.message}`,
            };
            conversation.messages.push(errorResponseMessage);
          }
        } else {
          console.error(`${RED}Critical Error: 'request_tool_creation' (ToolCreatorTool) not found in registry!${RESET}`);
          const criticalErrorMsg: Message = {
            role: "tool",
            tool_call_id: toolCall.id,
            name: 'request_tool_creation',
            content: "Critical error: The 'request_tool_creation' tool handler is missing internally.",
          };
          conversation.messages.push(criticalErrorMsg);
        }
      } else {
        aRealToolWasExecuted = true;
        console.log(`${MAGENTA}AI is using tool: ${toolCall.function.name}...${RESET}`);
        console.log(`${MAGENTA}  Tool Call ID: ${toolCall.id}, Args: ${toolCall.function.arguments}${RESET}`);
        const tool = toolRegistry.getTool(toolCall.function.name);
        if (tool) {
          try {
            const toolResultString = await tool.execute(toolCall.function.arguments);
            console.log(`${MAGENTA}  Tool Result (${tool.name}): ${toolResultString}${RESET}`);
            const toolResponseMessage: Message = {
              role: "tool",
              tool_call_id: toolCall.id,
              name: tool.name,
              content: toolResultString,
            };
            conversation.messages.push(toolResponseMessage);
          } catch (e: any) {
            console.error(`${RED}Error executing tool ${tool.name}: ${e.message}${RESET}`);
            const errorResponseMessage: Message = {
              role: "tool",
              tool_call_id: toolCall.id,
              name: tool.name,
              content: `Error executing tool: ${e.message}`,
            };
            conversation.messages.push(errorResponseMessage);
          }
        } else {
          console.warn(`${YELLOW}Tool "${toolCall.function.name}" not found.${RESET}`);
          const notFoundMessage: Message = {
            role: "tool",
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: `Error: Tool "${toolCall.function.name}" not found.`,
          };
          conversation.messages.push(notFoundMessage);
        }
      }
    }
    
    console.log(`${YELLOW}Sending tool results/acknowledgements back to LLM...${RESET}`);
    let nextMessageContent = "Proceed based on the tool results.";
    if (toolCreationAttempted) {
      if (toolCreationSuccessful && createdToolName) {
        nextMessageContent = `Tool '${createdToolName}' has been successfully created and registered. Please now use this tool if appropriate to fulfill the original request, or continue the conversation.`;
      } else {
        nextMessageContent = `The attempt to create a requested tool has concluded. Please proceed based on available tools or by rephrasing your request.`;
      }
    } else if (!aRealToolWasExecuted && assistantMessage.tool_calls.length > 0) {
      nextMessageContent = "A tool call was made, but it seems no standard tool was executed. Please assess the situation and proceed.";
    }
    
    const nextAssistantMessage = await sendMessageToOpenAI(
      nextMessageContent, 
      conversation, 
      toolRegistry.getAllTools()
    );
    await processLLMResponse(nextAssistantMessage, cyclesRemaining - 1);

  } else if (assistantMessage.content) {
    console.log(`${BLUE}AI: ${RESET}${assistantMessage.content}`);
  } else {
    console.log(`${BLUE}AI: ${RESET}${YELLOW}(Assistant provided no text content and no tool calls.)${RESET}`);
  }
}

rl.on('line', async (line) => {
  const userInput = line.trim();

  if (userInput.toLowerCase() === 'exit') {
    console.log(`${YELLOW}Exiting agent...${RESET}`);
    rl.close();
    return;
  }
  if (userInput.toLowerCase() === 'history') {
    console.log(`${YELLOW}Conversation History:${RESET}`);
    conversation.messages.forEach(msg => {
      let color = YELLOW;
      let prefix = msg.role.toUpperCase();
      if (msg.role === 'user') { color = GREEN; prefix = 'You'; }
      else if (msg.role === 'assistant') { color = BLUE; prefix = 'AI'; }
      else if (msg.role === 'tool') { color = MAGENTA; prefix = `Tool (${msg.name})`; }
      else if (msg.role === 'system') {
         color = YELLOW; 
         prefix = 'System'; 
         console.log(`${color}${prefix}: ${RESET}(System prompt content not shown for brevity. Current length: ${msg.content?.length || 0})`);
         return; 
      }
      
      let displayContent = msg.content;
      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        displayContent = (displayContent || "") + ` (Tool Calls: ${JSON.stringify(msg.tool_calls)})`;
      }
      console.log(`${color}${prefix}: ${RESET}${displayContent}`);
    });
    rl.prompt();
    return;
  }
  if (userInput.toLowerCase() === 'clear') {
    systemPromptMessage.content = getMainSystemPrompt(toolRegistry.getOpenAITools()); 
    conversation.messages = [systemPromptMessage]; 
    console.log(`${YELLOW}Conversation history cleared (system prompt refreshed).${RESET}`);
    rl.prompt();
    return;
  }
  if (!userInput) {
    rl.prompt();
    return;
  }

  const userMessage: Message = { role: "user", content: userInput };
  conversation.messages.push(userMessage);

  console.log(`${YELLOW}Thinking...${RESET}`);
  const assistantMessage = await sendMessageToOpenAI(userInput, conversation, toolRegistry.getAllTools());
  await processLLMResponse(assistantMessage, MAX_TOOL_RESPONSE_CYCLES);
  
  rl.prompt();
}).on('close', () => {
  if (process.env.NODE_ENV !== 'test') {
    process.exit(0);
  }
});

