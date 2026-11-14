import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DevbookApiError, DevbookClient } from "../src/client/devbook-client.js";

describe("DevbookClient", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("configures base URL and strips trailing slashes and /api/v1 suffixes", () => {
    const client1 = new DevbookClient({ baseUrl: "http://127.0.0.1:4000///" });
    expect(client1.getBaseUrl()).toBe("http://127.0.0.1:4000");

    const client2 = new DevbookClient({ baseUrl: "http://localhost:3000/api/v1/" });
    expect(client2.getBaseUrl()).toBe("http://localhost:3000");
  });

  it("attaches Authorization header when apiKey is supplied", async () => {
    let capturedHeaders: Headers | undefined;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ total_prompts: 10 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const client = new DevbookClient({ baseUrl: "http://localhost:3000", apiKey: "secret-token" });
    await client.getStats();

    expect(capturedHeaders?.get("Authorization")).toBe("Bearer secret-token");
  });

  it("fetches platform stats", async () => {
    const mockStats = {
      total_prompts: 42,
      standalone_prompts: 12,
      pinned_prompts: 5,
      total_projects: 4,
      total_attachments: 9,
    };

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockStats), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const client = new DevbookClient();
    const stats = await client.getStats();
    expect(stats.total_prompts).toBe(42);
    expect(stats.pinned_prompts).toBe(5);
  });

  it("renders markdown through API", async () => {
    let capturedBody: string | undefined;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedBody = init?.body as string;
      return new Response(JSON.stringify({ html: "<p>Test</p>\n" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const client = new DevbookClient();
    const res = await client.renderMarkdown("# Test");
    expect(res.html).toBe("<p>Test</p>\n");
    expect(JSON.parse(capturedBody!)).toEqual({ text: "# Test" });
  });

  it("lists projects with query params", async () => {
    let capturedUrl = "";
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      capturedUrl = url;
      return new Response(
        JSON.stringify({
          projects: [{ id: 1, name: "Core", prompts_count: 3 }],
          meta: { limit: 10, offset: 0, total_count: 1 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const client = new DevbookClient();
    const res = await client.listProjects({ q: "core", limit: 10, offset: 0 });
    expect(capturedUrl).toContain("/api/v1/projects?q=core&limit=10&offset=0");
    expect(res.projects).toHaveLength(1);
    expect(res.projects[0].name).toBe("Core");
  });

  it("handles prompt CRUD operations", async () => {
    const client = new DevbookClient();

    // Create
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 1,
          title: "New Prompt",
          body: "Hello {{name}}",
          pinned: false,
        }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      )
    );

    const created = await client.createPrompt({ title: "New Prompt", body: "Hello {{name}}" });
    expect(created.id).toBe(1);
    expect(created.title).toBe("New Prompt");

    // Get
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 1,
          title: "New Prompt",
          body: "Hello {{name}}",
          rendered_html: "<p>Hello {{name}}</p>",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const fetched = await client.getPrompt(1, true);
    expect(fetched.rendered_html).toBeDefined();

    // Update
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 1,
          title: "Updated Prompt",
          body: "Hello {{name}}",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const updated = await client.updatePrompt(1, { title: "Updated Prompt" });
    expect(updated.title).toBe("Updated Prompt");

    // Toggle Pin
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "ok",
          pinned: true,
          pinned_position: 1,
          prompt: { id: 1, title: "Updated Prompt", pinned: true },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const pinRes = await client.togglePinPrompt(1);
    expect(pinRes.pinned).toBe(true);

    // Delete
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok", message: "Prompt deleted successfully" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const delRes = await client.deletePrompt(1);
    expect(delRes.status).toBe("ok");
  });

  it("uploads multipart attachments", async () => {
    let capturedBody: FormData | undefined;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedBody = init?.body as FormData;
      return new Response(
        JSON.stringify({
          status: "ok",
          attachments: [
            {
              id: 99,
              filename: "context.txt",
              byte_size: 14,
              content_type: "text/plain",
              created_at: new Date().toISOString(),
              url: "http://localhost:3000/blobs/context.txt",
            },
          ],
        }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    });

    const client = new DevbookClient();
    const res = await client.uploadAttachments(1, [
      {
        filename: "context.txt",
        content: Buffer.from("Sample Context"),
        contentType: "text/plain",
      },
    ]);

    expect(capturedBody).toBeInstanceOf(FormData);
    expect(res.attachments).toHaveLength(1);
    expect(res.attachments[0].filename).toBe("context.txt");
  });

  it("throws DevbookApiError with structured details on 422", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () =>
      new Response(
        JSON.stringify({
          error: "Validation failed",
          details: ["Title can't be blank", "Title is too short"],
        }),
        { status: 422, headers: { "Content-Type": "application/json" } }
      )
    );

    const client = new DevbookClient();
    await expect(client.createPrompt({ title: "", body: "" })).rejects.toThrow(DevbookApiError);

    try {
      await client.createPrompt({ title: "", body: "" });
    } catch (err) {
      const apiErr = err as DevbookApiError;
      expect(apiErr.status).toBe(422);
      expect(apiErr.message).toBe("Validation failed");
      expect(apiErr.details).toContain("Title can't be blank");
    }
  });

  it("handles 404 resource not found", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "Resource not found",
          details: ["Couldn't find Prompt with 'id'=9999"],
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      )
    );

    const client = new DevbookClient();
    await expect(client.getPrompt(9999)).rejects.toThrow(DevbookApiError);
  });
});
