// src/testToolCreator.ts
import { createToolWithLLM, ToolSpecification, ToolCreationResult } from './toolCreator';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config(); // Ensure API keys are loaded if sendMessageToOpenAI needs them

async function testToolGeneration() {
  console.log("Testing tool creation directly...");

  const sampleToolSpec: ToolSpecification = {
    tool_name: "simple_adder",
    tool_description: "A tool that adds two numbers.",
    input_parameters_schema: {
      type: "object",
      properties: {
        num1: { type: "number", description: "The first number." },
        num2: { type: "number", description: "The second number." },
      },
      required: ["num1", "num2"],
    },
    output_description: "A JSON string containing the sum of the two numbers, e.g., { \"sum\": 5 }.",
  };

  console.log("Using Tool Specification:", JSON.stringify(sampleToolSpec, null, 2));

  const result: ToolCreationResult = await createToolWithLLM(sampleToolSpec);

  console.log("\n--- Tool Creation Result ---");
  if (result.success && result.toolCode && result.toolName) {
    console.log(`Successfully generated tool: ${result.toolName}`);
    console.log("Generated Code:");
    console.log("------------------------------------------------------");
    console.log(result.toolCode);
    console.log("------------------------------------------------------");

    // Optional: Save the generated code to a file for inspection
    const generatedDir = path.join(__dirname, 'tools', 'generated_test');
    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir, { recursive: true });
    }
    const filePath = path.join(generatedDir, `${result.toolName}.ts`);
    fs.writeFileSync(filePath, result.toolCode);
    console.log(`Generated tool code saved to: ${filePath}`);
    console.log("Please review the generated code for correctness and ITool interface compliance.");

  } else {
    console.error(`Tool generation failed for: ${result.toolName || sampleToolSpec.tool_name}`);
    console.error("Error:", result.error);
  }
  console.log("----------------------------");
}

testToolGeneration().catch(error => {
  console.error("Unhandled error during testToolGeneration:", error);
}); 