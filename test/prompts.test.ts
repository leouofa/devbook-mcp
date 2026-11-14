import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractTemplateVariables, substituteVariables, toPromptSlug } from "../src/prompts/index.js";
import { createDevbookMcpServer } from "../src/server.js";

describe("MCP Prompts & Template Engine", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("extracts unique template variables from template string", () => {
    const template = "Review {{code}} in {{ language }} and optimize {{code}} for {{ runtime_version }}.";
    const vars = extractTemplateVariables(template);
    expect(vars).toEqual(["code", "language", "runtime_version"]);
  });

  it("substitutes variables accurately", () => {
    const template = "Hello {{name}}, welcome to {{ place }}!";
    const result = substituteVariables(template, { name: "Alice", place: "Devbook" });
    expect(result).toBe("Hello Alice, welcome to Devbook!");
  });

  it("normalizes titles to compliant MCP prompt slugs", () => {
    expect(toPromptSlug(1, "Senior Code Reviewer!")).toBe("devbook_1_senior_code_reviewer");
    expect(toPromptSlug(15, "   Clean-Arch & DDD   ")).toBe("devbook_15_clean_arch_ddd");
  });

  it("executes devbook_execute_prompt with dynamic variable substitution", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () =>
      new Response(
        JSON.stringify({
          id: 7,
          title: "Refactor Function",
          body: "Refactor the following {{target_lang}} function:\n```\n{{code}}\n```",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const { server } = createDevbookMcpServer({ baseUrl: "http://mock-devbook" });
    await server.connect(serverTransport);

    const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    await client.connect(clientTransport);

    const promptRes = await client.getPrompt({
      name: "devbook_execute_prompt",
      arguments: {
        prompt_id: "7",
        variables: JSON.stringify({
          target_lang: "TypeScript",
          code: "const x: number = 1;",
        }),
      },
    });

    const msg = promptRes.messages[0];
    expect(msg.role).toBe("user");
    const text = (msg.content as { type: string; text: string }).text;
    expect(text).toContain("Refactor the following TypeScript function:");
    expect(text).toContain("const x: number = 1;");

    await client.close();
    await server.close();
  });
});
