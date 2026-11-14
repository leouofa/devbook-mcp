import type {
  Attachment,
  AttachmentsResponse,
  ErrorResponse,
  MarkdownResponse,
  PaginatedProjects,
  PaginatedPrompts,
  Project,
  ProjectInput,
  ProjectWithPrompts,
  PromptDetail,
  PromptInput,
  Stats,
  StatusOkResponse,
  TogglePinResponse,
} from "../types/index.js";

export interface DevbookClientOptions {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
}

export class DevbookApiError extends Error {
  readonly status: number;
  readonly details: string[];

  constructor(status: number, message: string, details: string[] = []) {
    super(message);
    this.name = "DevbookApiError";
    this.status = status;
    this.details = details;
  }
}

export class DevbookClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor(options: DevbookClientOptions = {}) {
    const rawUrl = options.baseUrl || process.env.DEVBOOK_API_URL || "http://localhost:3000";
    this.baseUrl = rawUrl.replace(/\/+$/, "").replace(/\/api\/v1$/, "");
    this.apiKey = options.apiKey || process.env.DEVBOOK_API_KEY;
    this.timeoutMs = options.timeoutMs ?? 30000;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const headers = new Headers(options.headers);

    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }

    if (this.apiKey && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${this.apiKey}`);
    }

    if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      const contentType = response.headers.get("content-type") || "";
      const isJson = contentType.includes("application/json");

      if (!response.ok) {
        if (isJson) {
          const errorBody = (await response.json()) as Partial<ErrorResponse>;
          const message = errorBody.error || `HTTP ${response.status} ${response.statusText}`;
          const details = Array.isArray(errorBody.details) ? errorBody.details : [];
          throw new DevbookApiError(response.status, message, details);
        } else {
          const text = await response.text();
          throw new DevbookApiError(response.status, text || `HTTP ${response.status} ${response.statusText}`);
        }
      }

      if (isJson) {
        return (await response.json()) as T;
      }
      return (await response.text()) as unknown as T;
    } catch (err: unknown) {
      if (err instanceof DevbookApiError) {
        throw err;
      }
      if (err instanceof Error && err.name === "AbortError") {
        throw new DevbookApiError(408, `Devbook API request timed out after ${this.timeoutMs}ms`);
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new DevbookApiError(0, `Devbook API network error connecting to ${url}: ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  // System & Stats
  async getStats(): Promise<Stats> {
    return this.request<Stats>("/api/v1/stats");
  }

  async getOpenApiSpec(): Promise<unknown> {
    return this.request<unknown>("/api/v1/openapi");
  }

  // Markdown Rendering
  async renderMarkdown(text: string): Promise<MarkdownResponse> {
    return this.request<MarkdownResponse>("/api/v1/markdown/render", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  }

  // Projects
  async listProjects(params?: { q?: string; limit?: number; offset?: number }): Promise<PaginatedProjects> {
    const query = new URLSearchParams();
    if (params?.q) query.set("q", params.q);
    if (params?.limit !== undefined) query.set("limit", String(params.limit));
    if (params?.offset !== undefined) query.set("offset", String(params.offset));

    const queryString = query.toString();
    const path = `/api/v1/projects${queryString ? `?${queryString}` : ""}`;
    return this.request<PaginatedProjects>(path);
  }

  async getProject(id: number): Promise<ProjectWithPrompts> {
    return this.request<ProjectWithPrompts>(`/api/v1/projects/${id}`);
  }

  async createProject(input: ProjectInput): Promise<Project> {
    return this.request<Project>("/api/v1/projects", {
      method: "POST",
      body: JSON.stringify({ project: input }),
    });
  }

  async updateProject(id: number, input: Partial<ProjectInput>): Promise<Project> {
    return this.request<Project>(`/api/v1/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ project: input }),
    });
  }

  async deleteProject(id: number): Promise<StatusOkResponse> {
    return this.request<StatusOkResponse>(`/api/v1/projects/${id}`, {
      method: "DELETE",
    });
  }

  // Prompts
  async listPrompts(params?: {
    q?: string;
    project_id?: number;
    scope?: "standalone";
    pinned?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedPrompts> {
    const query = new URLSearchParams();
    if (params?.q) query.set("q", params.q);
    if (params?.project_id !== undefined) query.set("project_id", String(params.project_id));
    if (params?.scope) query.set("scope", params.scope);
    if (params?.pinned !== undefined) query.set("pinned", String(params.pinned));
    if (params?.limit !== undefined) query.set("limit", String(params.limit));
    if (params?.offset !== undefined) query.set("offset", String(params.offset));

    const queryString = query.toString();
    const path = `/api/v1/prompts${queryString ? `?${queryString}` : ""}`;
    return this.request<PaginatedPrompts>(path);
  }

  async getPrompt(id: number, renderMarkdown?: boolean): Promise<PromptDetail> {
    const query = renderMarkdown ? "?render_markdown=true" : "";
    return this.request<PromptDetail>(`/api/v1/prompts/${id}${query}`);
  }

  async createPrompt(input: PromptInput): Promise<PromptDetail> {
    return this.request<PromptDetail>("/api/v1/prompts", {
      method: "POST",
      body: JSON.stringify({ prompt: input }),
    });
  }

  async updatePrompt(id: number, input: Partial<PromptInput>, renderMarkdown?: boolean): Promise<PromptDetail> {
    const query = renderMarkdown ? "?render_markdown=true" : "";
    return this.request<PromptDetail>(`/api/v1/prompts/${id}${query}`, {
      method: "PATCH",
      body: JSON.stringify({ prompt: input }),
    });
  }

  async deletePrompt(id: number): Promise<StatusOkResponse> {
    return this.request<StatusOkResponse>(`/api/v1/prompts/${id}`, {
      method: "DELETE",
    });
  }

  async togglePinPrompt(id: number): Promise<TogglePinResponse> {
    return this.request<TogglePinResponse>(`/api/v1/prompts/${id}/toggle_pin`, {
      method: "PATCH",
    });
  }

  async reorderPinnedPrompts(promptIds: number[]): Promise<StatusOkResponse> {
    return this.request<StatusOkResponse>("/api/v1/prompts/reorder_pinned", {
      method: "PATCH",
      body: JSON.stringify({ prompt_ids: promptIds }),
    });
  }

  // Attachments
  async listAttachments(promptId: number): Promise<AttachmentsResponse> {
    return this.request<AttachmentsResponse>(`/api/v1/prompts/${promptId}/attachments`);
  }

  async uploadAttachments(
    promptId: number,
    files: Array<{ filename: string; content: Blob | Uint8Array | Buffer; contentType?: string }>
  ): Promise<AttachmentsResponse> {
    const formData = new FormData();
    for (const file of files) {
      let blob: Blob;
      if (file.content instanceof Blob) {
        blob = file.content;
      } else {
        blob = new Blob([file.content], { type: file.contentType || "application/octet-stream" });
      }
      formData.append("files[]", blob, file.filename);
    }

    return this.request<AttachmentsResponse>(`/api/v1/prompts/${promptId}/attachments`, {
      method: "POST",
      body: formData,
    });
  }

  async deleteAttachment(promptId: number, attachmentId: number): Promise<StatusOkResponse> {
    return this.request<StatusOkResponse>(`/api/v1/prompts/${promptId}/attachments/${attachmentId}`, {
      method: "DELETE",
    });
  }
}
