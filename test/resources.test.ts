import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDevbookMcpServer } from "../src/server.js";

describe("MCP Resources Integration", () => {
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

  it("reads devbook://stats resource", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () =>
      new Response(
        JSON.stringify({
          total_prompts: 15,
          standalone_prompts: 8,
          pinned_prompts: 3,
          total_projects: 3,
          total_attachments: 2,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const { client, cleanup } = await setupTestClient();
    const res = await client.readResource({ uri: "devbook://stats" });

    expect(res.contents).toHaveLength(1);
    expect(res.contents[0].mimeType).toBe("application/json");
    expect(res.contents[0].text).toContain('"total_prompts": 15');

    await cleanup();
  });

  it("reads devbook://prompts/{id} resource with frontmatter header", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () =>
      new Response(
        JSON.stringify({
          id: 42,
          project_id: 1,
          project_name: "Code Review",
          title: "PR Reviewer",
          body: "# Review Guidelines\nBe kind and thorough.",
          pinned: true,
          pinned_position: 1,
          attachments_count: 0,
          updated_at: "2026-11-14T00:00:00Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const { client, cleanup } = await setupTestClient();
    const res = await client.readResource({ uri: "devbook://prompts/42" });

    expect(res.contents).toHaveLength(1);
    expect(res.contents[0].mimeType).toBe("text/markdown");
    expect(res.contents[0].text).toContain("---");
    expect(res.contents[0].text).toContain("title: \"PR Reviewer\"");
    expect(res.contents[0].text).toContain("project: \"Code Review\"");
    expect(res.contents[0].text).toContain("# Review Guidelines");

    await cleanup();
  });
});
