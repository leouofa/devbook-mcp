import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDevbookMcpServer } from "../src/server.js";

describe("MCP Tools Integration", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  async function setupTestClient() {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const { server } = createDevbookMcpServer({ baseUrl: "http://mock-devbook" });
    await server.connect(serverTransport);

    const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    await client.connect(clientTransport);

    return {
      client,
      cleanup: async () => {
        await client.close();
        await server.close();
      },
    };
  }

  it("lists all 17 available tools", async () => {
    const { client, cleanup } = await setupTestClient();
    const { tools } = await client.listTools();

    expect(tools.length).toBe(17);
    const names = tools.map((t) => t.name);
    expect(names).toContain("devbook_list_projects");
    expect(names).toContain("devbook_create_prompt");
    expect(names).toContain("devbook_upload_attachment");
    expect(names).toContain("devbook_render_markdown");
    expect(names).toContain("devbook_get_stats");

    await cleanup();
  });

  it("executes devbook_get_stats tool", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () =>
      new Response(
        JSON.stringify({
          total_prompts: 5,
          standalone_prompts: 3,
          pinned_prompts: 2,
          total_projects: 2,
          total_attachments: 1,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const { client, cleanup } = await setupTestClient();
    const result = await client.callTool({ name: "devbook_get_stats", arguments: {} });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain('"total_prompts": 5');

    await cleanup();
  });

  it("executes devbook_render_markdown tool", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify({ html: "<h1>Heading</h1>\n" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const { client, cleanup } = await setupTestClient();
    const result = await client.callTool({
      name: "devbook_render_markdown",
      arguments: { text: "# Heading" },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain("<h1>Heading</h1>");

    await cleanup();
  });

  it("executes devbook_create_prompt tool", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () =>
      new Response(
        JSON.stringify({
          id: 101,
          title: "Refactor Specialist",
          body: "Refactor {{target}} safely",
          pinned: false,
          attachments_count: 0,
        }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      )
    );

    const { client, cleanup } = await setupTestClient();
    const result = await client.callTool({
      name: "devbook_create_prompt",
      arguments: {
        title: "Refactor Specialist",
        body: "Refactor {{target}} safely",
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain('"id": 101');
    expect(content[0].text).toContain("Refactor Specialist");

    await cleanup();
  });

  it("returns formatted error response on API failure", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () =>
      new Response(
        JSON.stringify({
          error: "Validation failed",
          details: ["Prompt title has already been taken"],
        }),
        { status: 422, headers: { "Content-Type": "application/json" } }
      )
    );

    const { client, cleanup } = await setupTestClient();
    const result = await client.callTool({
      name: "devbook_create_prompt",
      arguments: {
        title: "Duplicate Title",
        body: "Prompt body",
      },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain("Devbook API Error [422]");
    expect(content[0].text).toContain("Prompt title has already been taken");

    await cleanup();
  });
});
