// tests/tools/exampleTool.test.ts
import { ExampleTool } from '../../src/tools/exampleTool';

describe('ExampleTool', () => {
  let tool: ExampleTool;

  beforeEach(() => {
    tool = new ExampleTool();
  });

  it('should have a name and description', () => {
    expect(tool.name).toBe("example_tool");
    expect(tool.description).toBeDefined();
    expect(tool.description.length).toBeGreaterThan(0);
  });

  it('should convert message to uppercase', async () => {
    const args = JSON.stringify({ message: "hello world" });
    const result = await tool.execute(args);
    const parsedResult = JSON.parse(result);
    expect(parsedResult.result).toBe("HELLO WORLD");
  });

  it('should handle missing message property in args', async () => {
    const args = JSON.stringify({ text: "hello" }); // Incorrect property
    const result = await tool.execute(args);
    const parsedResult = JSON.parse(result);
    expect(parsedResult.error).toContain("Invalid arguments");
  });

  it('should handle non-JSON string arguments', async () => {
    const args = "not a json string";
    const result = await tool.execute(args);
    const parsedResult = JSON.parse(result);
    expect(parsedResult.error).toContain("Failed to parse arguments");
  });

  it('should handle args where message is not a string', async () => {
    const args = JSON.stringify({ message: 123 }); // Message is a number
    const result = await tool.execute(args);
    const parsedResult = JSON.parse(result);
    expect(parsedResult.error).toContain("Invalid arguments. 'message' property must be a string.");
  });
}); 