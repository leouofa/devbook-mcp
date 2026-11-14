import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DevbookClient, type DevbookClientOptions } from "./client/devbook-client.js";
import { registerPrompts, syncPromptsFromDevbook } from "./prompts/index.js";
import { registerResources } from "./resources/index.js";
import { registerTools } from "./tools/index.js";

export interface DevbookServerInstance {
  server: McpServer;
  client: DevbookClient;
  syncPrompts: () => Promise<number>;
}

export function createDevbookMcpServer(options: DevbookClientOptions = {}): DevbookServerInstance {
  const client = new DevbookClient(options);

  const server = new McpServer(
    {
      name: "devbook-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: { listChanged: true },
        resources: { listChanged: true },
        prompts: { listChanged: true },
      },
    }
  );

  registerTools(server, client);
  registerResources(server, client);
  registerPrompts(server, client);

  const syncPrompts = () => syncPromptsFromDevbook(server, client);

  return { server, client, syncPrompts };
}
