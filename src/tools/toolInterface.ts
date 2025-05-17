// src/tools/toolInterface.ts

/**
 * Interface for a tool that the agent can use.
 */
export interface ITool {
  name: string;
  description: string;
  parametersSchema: any;
  execute: (args: string) => Promise<string>;
}

export function isTool(obj: any): obj is ITool {
  return (
    obj &&
    typeof obj.name === 'string' &&
    typeof obj.description === 'string' &&
    typeof obj.parametersSchema === 'object' && // Check for parametersSchema
    obj.parametersSchema !== null &&
    typeof obj.execute === 'function'
  );
} 