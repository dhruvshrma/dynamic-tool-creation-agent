import { sendMessageToOpenAI } from './openaiClient';
import { ITool } from './tools/toolInterface';
import { Conversation } from './types'; // Moved import to top for clarity


export class ToolCreatorTool implements ITool {
  public name: string = "request_tool_creation";
  public description: string = "Call this function to request the creation of a new tool. Provide the tool name and a free-text description of its requirements.";
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

      // Construct ToolSpecification for createToolWithLLM
      // For now, we'll use the requirements text as the main description
      // and let createToolWithLLM's prompt guide the LLM for schema/output if it can infer.
      // More sophisticated parsing/mapping could be added here later.
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

// Define a type for the expected structure of the tool specification
export interface ToolSpecification {
  tool_name: string;
  tool_description: string;
  input_parameters_schema: any; // JSON Schema object
  output_description: string; // Description of what the execute function should return (e.g., "a JSON string with the sum")
  // Potentially add: example_usage: string;
}

export interface ToolCreationResult {
  success: boolean;
  toolName?: string;
  toolCode?: string;
  error?: string;
}

function generateToolCreationPrompt(toolSpec: ToolSpecification): string {
  const schemaString = JSON.stringify(toolSpec.input_parameters_schema, null, 2);

  // Instruct the LLM to generate a TypeScript class implementing ITool
  // and to only output the code.
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
\`\`\`typescript
// No import for ITool needed here, assume it's globally available or in the same module context.
export default class ${toolSpec.tool_name.charAt(0).toUpperCase() + toolSpec.tool_name.slice(1)}Tool implements ITool {
  public name = "${toolSpec.tool_name}";
  public description = "${toolSpec.tool_description}";
  // IMPORTANT: The parametersSchema below MUST be the JSON object, not a string representation.
  public parametersSchema = ${JSON.stringify(toolSpec.input_parameters_schema, null, 2)};

  async execute(argsString: string): Promise<string> {
    try {
      const args = JSON.parse(argsString);
      // TODO: Implement tool logic using 'args' based on tool_description and output_description.
      // Replace the line below with actual implementation.
      const result = { message: "Tool ${toolSpec.tool_name} executed successfully with args: ", received_args: args }; 
      return JSON.stringify(result);
    } catch (error: any) {
      return JSON.stringify({ error: error.message || "Failed to execute ${toolSpec.tool_name}" });
    }
  }
}
\`\`\`

Now, generate the code for the tool: ${toolSpec.tool_name}.
Ensure the generated class name is PascalCase (e.g., ${toolSpec.tool_name.charAt(0).toUpperCase() + toolSpec.tool_name.slice(1)}Tool).
The 'name' property of the class instance MUST exactly match '${toolSpec.tool_name}'.
The 'description' property of the class instance MUST exactly match '${toolSpec.tool_description}'.
The 'parametersSchema' property of the class instance MUST be the actual JSON object matching the Input Parameters JSON Schema provided (it should not be a stringified version of the schema in the generated code, but the object itself).
Remember to only output the TypeScript code as a single block.
At the top use the import statement: import { ITool } from '../toolInterface';
  `;
}

export async function createToolWithLLM(toolSpec: ToolSpecification): Promise<ToolCreationResult> {
  console.log(`Attempting to generate tool: ${toolSpec.tool_name}`);
  const codegenPrompt = generateToolCreationPrompt(toolSpec);

  // For now, let's use a simplified conversation for the code generation LLM.
  // It only gets the system instruction (our codegenPrompt).
  const codeGenConversation: Conversation = { // Make sure Conversation is imported or defined if not global
    messages: [{ role: "system", content: codegenPrompt }]
  };

  // TODO: Consider using a specific model for code generation if available and configured.
  // For now, using the default sendMessageToOpenAI which uses the main model.
  // The user message can be minimal as the system prompt is very directive.
  const llmResponse = await sendMessageToOpenAI(
    "Generate the tool code as per the system prompt.", 
    codeGenConversation, 
    [] // No tools should be available/offered to the code-gen LLM
  );

  if (llmResponse && llmResponse.content) {
    // Expecting the LLM to return ONLY the code as a string.
    // We might need to strip markdown backticks if the LLM adds them.
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