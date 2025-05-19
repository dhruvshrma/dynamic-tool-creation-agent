import { sendMessageToOpenAI } from './openaiClient';
import { ITool } from './tools/toolInterface';
import { Conversation } from './types';

export class ToolCreatorTool implements ITool {
  public name: string = "request_tool_creation";
  public description: string = "Call this function to request the creation of a new tool or update an existing tool. Provide the operation type (create/update), tool name, and a free-text description of its requirements.";
  public parametersSchema: any = {
    type: "object",
    properties: {
      operation: {
        type: "string",
        description: "Either 'create' for a new tool or 'update' for modifying an existing tool",
        enum: ["create", "update"]
      },
      tool_name: {
        type: "string",
        description: "A descriptive, unique name for the tool (e.g., 'currency_converter'). Use snake_case.",
      },
      tool_requirements_free_text: {
        type: "string",
        description: "Describe in natural language what the tool does, its inputs (and their types/format if known), and its expected output. For updates, describe the new functionality to add while preserving existing functionality.",
      },
      preserve_functionality: {
        type: "array",
        description: "When updating a tool, list specific functionality that must be preserved",
        items: {
          type: "string"
        }
      }
    },
    required: ["operation", "tool_name", "tool_requirements_free_text"],
  };

  public async execute(args: string): Promise<string> {
    console.log(`ToolCreatorTool: Received args: ${args}`);
    try {
      const parsedArgs = JSON.parse(args);
      const operation = parsedArgs.operation;
      const toolName = parsedArgs.tool_name;
      const requirementsText = parsedArgs.tool_requirements_free_text;
      const preserveFunctionality = parsedArgs.preserve_functionality || [];

      if (!operation || !toolName || !requirementsText) {
        return JSON.stringify({ 
          success: false, 
          error: "Missing required fields: operation, tool_name, or tool_requirements_free_text" 
        } as ToolCreationResult);
      }

      if (operation === 'create') {
        return this.handleCreateTool(toolName, requirementsText);
      } else if (operation === 'update') {
        return this.handleUpdateTool(toolName, requirementsText, preserveFunctionality);
      } else {
        return JSON.stringify({ 
          success: false, 
          error: "Invalid operation. Must be 'create' or 'update'" 
        } as ToolCreationResult);
      }
    } catch (error: any) {
      console.error(`ToolCreatorTool: Error during execution: ${error.message}`);
      return JSON.stringify({ 
        success: false, 
        error: error.message || "Failed to process tool creation request" 
      } as ToolCreationResult);
    }
  }


  private async handleCreateTool(toolName: string, requirementsText: string): Promise<string> {
    const toolSpec: ToolSpecification = {
      tool_name: toolName,
      tool_description: requirementsText,
      input_parameters_schema: { 
        type: "object", 
        properties: {
          arg1: { type: "string", description: "Example argument, LLM should define actual based on needs." }
        } 
      },
      output_description: "LLM should define this based on the tool_description.",
    };

    console.log(`ToolCreatorTool: Creating new tool with spec:`, JSON.stringify(toolSpec, null, 2));
    const creationResult = await createToolWithLLM(toolSpec, false);
    return JSON.stringify(creationResult);
  }


  private async handleUpdateTool(
    toolName: string, 
    updateRequirements: string,
    preserveFunctionality: string[]
  ): Promise<string> {

    
    const toolSpec: ToolSpecification = {
      tool_name: toolName,
      tool_description: updateRequirements, // Use the update requirements as the description
      input_parameters_schema: { 
        type: "object", 
        properties: {
          arg1: { type: "string", description: "Example argument, LLM should define actual based on needs." }
        } 
      },
      output_description: "LLM should define this based on the update_description.",
      update_description: updateRequirements,
      preserve_functionality: preserveFunctionality
    };

    console.log(`ToolCreatorTool: Updating tool with spec:`, JSON.stringify(toolSpec, null, 2));
    const updateResult = await createToolWithLLM(toolSpec, true);
    return JSON.stringify(updateResult);
  }
}

export interface ToolSpecification {
  tool_name: string;
  tool_description: string;
  input_parameters_schema: any; 
  output_description: string;
  update_description?: string;
  preserve_functionality?: string[];
}

export interface ToolCreationResult {
  success: boolean;
  toolName?: string;
  toolCode?: string;
  error?: string;
  isUpdate?: boolean;
}


function generateToolCreationPrompt(toolSpec: ToolSpecification, isUpdate: boolean): string {
  const schemaString = JSON.stringify(toolSpec.input_parameters_schema, null, 2);
  
  let prompt = `
You are an expert TypeScript programmer. Your task is to generate the TypeScript code for a ${isUpdate ? 'updated' : 'new'} command-line tool.

You MUST start your code with this import statement:
import { ITool } from '../toolInterface';

The tool must implement the ITool interface which is defined as:

interface ITool {
  name: string;
  description: string;
  parametersSchema: any; // JSON Schema for arguments
  execute: (argsString: string) => Promise<string>; // argsString is a JSON string of arguments
}

Please generate the complete TypeScript code for a class that implements this interface based on the following specification:

Tool Name: ${toolSpec.tool_name}
`;

  if (isUpdate && toolSpec.update_description) {
    prompt += `
Update Description: ${toolSpec.update_description}
Functionality to preserve:
${toolSpec.preserve_functionality?.map(f => `- ${f}`).join('\n') || 'No specific functionality listed.'}

This is an UPDATE to an existing tool. You must incorporate the new functionality described in the Update Description,
while preserving all the existing functionality listed above. Your code should represent the complete updated tool.
`;
  } else {
    prompt += `
Tool Description: ${toolSpec.tool_description}
`;
  }

  prompt += `
Input Parameters JSON Schema:
\`\`\`json
${schemaString}
\`\`\`
Output Description (what the execute method should calculate and return as a JSON string): ${toolSpec.output_description}

Your response should be ONLY the TypeScript code for the tool. Do not include any other text, explanations, or markdown backticks around the code block.
The tool class should be the default export of the module.

Important requirements:
1. Start with the import: import { ITool } from '../toolInterface';
2. Ensure proper error handling in the execute method using try/catch
3. For error handling, use: catch (error: unknown) { const err = error as Error; return JSON.stringify({ error: err.message || 'Unknown error' }); }
4. The execute method will receive arguments as a JSON string, which it should parse
5. The execute method must return a JSON string result
6. Make all properties public, with appropriate types

Example structure:
\`\`\`typescript
import { ITool } from '../toolInterface';

export default class MyTool implements ITool {
  public name = "my_tool";
  public description = "Description of what my tool does";
  public parametersSchema = {
    // JSON schema for parameters
  };

  public async execute(argsString: string): Promise<string> {
    try {
      const args = JSON.parse(argsString);
      // Tool implementation
      return JSON.stringify({ result: "success" });
    } catch (error: unknown) {
      const err = error as Error;
      return JSON.stringify({ error: err.message || 'Unknown error' });
    }
  }
}
\`\`\`
`;

  return prompt;
}


export async function createToolWithLLM(
  toolSpec: ToolSpecification, 
  isUpdate: boolean = false
): Promise<ToolCreationResult> {
  console.log(`Attempting to ${isUpdate ? 'update' : 'generate'} tool: ${toolSpec.tool_name}`);
  const codegenPrompt = generateToolCreationPrompt(toolSpec, isUpdate);

  const codeGenConversation: Conversation = { 
    messages: [{ role: "system", content: codegenPrompt }]
  };

  const llmResponse = await sendMessageToOpenAI(
    `Generate the ${isUpdate ? 'updated' : 'new'} tool code as per the system prompt.`, 
    codeGenConversation, 
    [] 
  );

  if (llmResponse && llmResponse.content) {
    let generatedCode = llmResponse.content.trim();
    if (generatedCode.startsWith("```typescript")) {
      generatedCode = generatedCode.substring("```typescript".length);
      if (generatedCode.endsWith("```")) {
        generatedCode = generatedCode.substring(0, generatedCode.length - "```".length);
      }
      generatedCode = generatedCode.trim();
    }
    
    console.log(`Code ${isUpdate ? 'updated' : 'generated'} for ${toolSpec.tool_name}. Snippet:\n${generatedCode.substring(0, 300)}...`); 
    return { 
      success: true, 
      toolCode: generatedCode, 
      toolName: toolSpec.tool_name, 
      isUpdate 
    };
  } else {
    const errorMsg = `LLM did not return code content for tool ${isUpdate ? 'update' : 'generation'}.`;
    console.error(errorMsg);
    return { 
      success: false, 
      error: errorMsg, 
      toolName: toolSpec.tool_name, 
      isUpdate 
    };
  }
}