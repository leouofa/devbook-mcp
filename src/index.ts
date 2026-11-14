#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Command } from "commander";
import { createDevbookMcpServer } from "./server.js";

const program = new Command()
  .name("devbook-mcp")
  .description("Official Model Context Protocol (MCP) server for Devbook prompt engineering workbench")
  .version("1.0.0")
  .option("-u, --url <url>", "Devbook API base URL (defaults to DEVBOOK_API_URL or http://localhost:3000)")
  .option("-k, --api-key <key>", "Devbook API key / bearer token (defaults to DEVBOOK_API_KEY)")
  .option("-t, --timeout <ms>", "Request timeout in milliseconds", (val) => Number.parseInt(val, 10))
  .option("--no-sync", "Disable initial prompt synchronization on startup");

program.parse(process.argv);
const options = program.opts();

const baseUrl = options.url || process.env.DEVBOOK_API_URL || "http://localhost:3000";
const apiKey = options.apiKey || process.env.DEVBOOK_API_KEY;
const timeoutMs = options.timeout ? Number(options.timeout) : undefined;
const shouldSync = options.sync !== false;

async function main() {
  const { server, client, syncPrompts } = createDevbookMcpServer({
    baseUrl,
    apiKey,
    timeoutMs,
  });

  const transport = new StdioServerTransport();

  // Handle graceful shutdown
  const cleanup = async () => {
    process.stderr.write("\nShutting down Devbook MCP server...\n");
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  await server.connect(transport);
  process.stderr.write(`Devbook MCP server running on stdio (Devbook URL: ${client.getBaseUrl()})\n`);

  if (shouldSync) {
    const synced = await syncPrompts();
    if (synced > 0) {
      process.stderr.write(`Synced ${synced} saved prompt(s) from Devbook into native MCP prompts.\n`);
    }
  }
}

main().catch((error) => {
  process.stderr.write(`Fatal error in Devbook MCP server: ${error instanceof Error ? error.stack || error.message : error}\n`);
  process.exit(1);
});
