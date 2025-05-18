import { sendMessageToOpenAI } from './openaiClient';
import { ITool } from './tools/toolInterface';
import { Conversation } from './types'; // Moved import to top for clarity


export class ToolCreatorTool implements ITool {
  public name: string = "request_tool_creation";
  public description: string = "Call this function to request the creation of a new tool. Provide the tool name and a free-text description of its requirements. Important: Before creating a new tool, consider if an existing similar tool can be read, understood, and modified using your file editing capabilities (e.g., `read_file`, `edit_file`). Prefer updating an existing tool if it's more efficient or appropriate than creating a new one from scratch.";
  public parametersSchema: any = {
    type: "object",
    properties: {
      tool_name: {
        type: "string",
        description: "A descriptive, unique name for the new tool (e.g., 'currency_converter'). Use snake_case.",
      },
      tool_requirements_free_text: {
        type: "string",
        description: "Describe in natural language what the tool does, its inputs (and their types/format if known), and its expected output. This description will be used to generate the detailed tool specification.",
      },
    },
    required: ["tool_name", "tool_requirements_free_text"],
  };

  public async execute(args: string): Promise<string> {
    console.log(`ToolCreatorTool: Received args: ${args}`);
    try {
      const parsedArgs = JSON.parse(args);
      const toolName = parsedArgs.tool_name;
      const requirementsText = parsedArgs.tool_requirements_free_text;

      if (!toolName || !requirementsText) {
        return JSON.stringify({ success: false, error: "Missing tool_name or tool_requirements_free_text" } as ToolCreationResult);
      }

      const toolSpec: ToolSpecification = {
        tool_name: toolName,
        tool_description: requirementsText, // Using free_text as the core description
        input_parameters_schema: { 
            type: "object", 
            properties: {
                // Placeholder: Prompt in createToolWithLLM should encourage LLM to define this based on description
                arg1: { type: "string", description: "Example argument, LLM should define actual based on needs." }
            } 
        },
        output_description: "LLM should define this based on the tool_description (requirementsText).", // Placeholder
      };

      console.log(`ToolCreatorTool: Calling createToolWithLLM with spec:`, JSON.stringify(toolSpec, null, 2));
      const creationResult = await createToolWithLLM(toolSpec);
      return JSON.stringify(creationResult);

    } catch (error: any) {
      console.error(`ToolCreatorTool: Error during execution: ${error.message}`);
      return JSON.stringify({ success: false, error: error.message || "Failed to process tool creation request" } as ToolCreationResult);
    }
  }
}

export interface ToolSpecification {
  tool_name: string;
  tool_description: string;
  input_parameters_schema: any; 
  output_description: string; 
}

export interface ToolCreationResult {
  success: boolean;
  toolName?: string;
  toolCode?: string;
  error?: string;
}

function generateToolCreationPrompt(toolSpec: ToolSpecification): string {
  const schemaString = JSON.stringify(toolSpec.input_parameters_schema, null, 2);

  return `
You are an expert TypeScript programmer. Your task is to generate the TypeScript code for a new command-line tool.
The tool must implement the ITool interface:

interface ITool {
  name: string;
  description: string;
  parametersSchema: any; // JSON Schema for arguments
  execute: (argsString: string) => Promise<string>; // argsString is a JSON string of arguments
}

Please generate the complete TypeScript code for a class that implements this interface based on the following specification:

Tool Name: ${toolSpec.tool_name}
Tool Description: ${toolSpec.tool_description}
Input Parameters JSON Schema:
\`\`\`json
${schemaString}
\`\`\`
Output Description (what the execute method should calculate and return as a JSON string): ${toolSpec.output_description}

Your response should be ONLY the TypeScript code for the tool. Do not include any other text, explanations, or markdown backticks around the code block.
The tool class should be the default export of the module.
The execute method will receive arguments as a JSON string, which it should parse. It must return a JSON string result.
Make sure to handle potential errors during argument parsing or execution and return an error object as a JSON string (e.g., { "error": "message" }).

Example of a simple tool class structure (the ITool interface will be available in the scope where this code is saved, so no import for ITool is needed in the generated code block itself):
`
}

export async function createToolWithLLM(toolSpec: ToolSpecification): Promise<ToolCreationResult> {
  console.log(`Attempting to generate tool: ${toolSpec.tool_name}`);
  const codegenPrompt = generateToolCreationPrompt(toolSpec);

  const codeGenConversation: Conversation = { 
    messages: [{ role: "system", content: codegenPrompt }]
  };

  const llmResponse = await sendMessageToOpenAI(
    "Generate the tool code as per the system prompt.", 
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
    
    console.log(`Code generated for ${toolSpec.tool_name}. Snippet:\n${generatedCode.substring(0, 300)}...`); // Log snippet
    return { success: true, toolCode: generatedCode, toolName: toolSpec.tool_name };
  } else {
    const errorMsg = "LLM did not return code content for tool generation.";
    console.error(errorMsg);
    return { success: false, error: errorMsg, toolName: toolSpec.tool_name };
  }
} 