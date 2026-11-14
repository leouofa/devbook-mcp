import fs from "node:fs/promises";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DevbookApiError, type DevbookClient } from "../client/devbook-client.js";
import {
  CreateProjectSchema,
  CreatePromptSchema,
  DeleteAttachmentSchema,
  DeleteProjectSchema,
  DeletePromptSchema,
  FileUploadItemSchema,
  GetProjectSchema,
  GetPromptSchema,
  ListProjectsSchema,
  ListPromptsSchema,
  ReorderPinnedPromptsSchema,
  RenderMarkdownSchema,
  TogglePinPromptSchema,
  UpdateProjectSchema,
  UpdatePromptSchema,
} from "./schemas.js";

function formatError(error: unknown): { isError: true; content: Array<{ type: "text"; text: string }> } {
  if (error instanceof DevbookApiError) {
    const details = error.details.length > 0 ? `\nDetails:\n${error.details.map((d) => `• ${d}`).join("\n")}` : "";
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Devbook API Error [${error.status}]: ${error.message}${details}`,
        },
      ],
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: "text", text: `Error: ${message}` }],
  };
}

function formatResult(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [
      {
        type: "text",
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function registerTools(server: McpServer, client: DevbookClient): void {
  // 1. Projects
  server.tool(
    "devbook_list_projects",
    "List and search prompt projects / workspaces in Devbook with prompt count metrics and pagination",
    ListProjectsSchema.shape,
    async (args) => {
      try {
        const result = await client.listProjects(args);
        return formatResult(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    "devbook_get_project",
    "Get full project details including its prompt list index and metadata",
    GetProjectSchema.shape,
    async ({ id }) => {
      try {
        const result = await client.getProject(id);
        return formatResult(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    "devbook_create_project",
    "Create a new prompt project workspace in Devbook",
    CreateProjectSchema.shape,
    async (args) => {
      try {
        const result = await client.createProject(args);
        return formatResult(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    "devbook_update_project",
    "Update an existing project's name or description",
    UpdateProjectSchema.shape,
    async ({ id, ...rest }) => {
      try {
        const result = await client.updateProject(id, rest);
        return formatResult(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    "devbook_delete_project",
    "Delete a project from Devbook (prompts in the project become standalone or are deleted depending on cascade)",
    DeleteProjectSchema.shape,
    async ({ id }) => {
      try {
        const result = await client.deleteProject(id);
        return formatResult(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 2. Prompts
  server.tool(
    "devbook_list_prompts",
    "List, filter, and search prompts in Devbook by full-text search, project, standalone scope, or pinned status",
    ListPromptsSchema.shape,
    async (args) => {
      try {
        const result = await client.listPrompts(args);
        return formatResult(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    "devbook_get_prompt",
    "Retrieve a prompt's full Markdown template content, metadata, attachments, and optional rendered HTML",
    GetPromptSchema.shape,
    async ({ id, render_markdown }) => {
      try {
        const result = await client.getPrompt(id, render_markdown);
        return formatResult(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    "devbook_create_prompt",
    "Create a new prompt template in Devbook (under a project or as a standalone scratchpad prompt)",
    CreatePromptSchema.shape,
    async (args) => {
      try {
        const result = await client.createPrompt(args);
        return formatResult(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    "devbook_update_prompt",
    "Update a prompt template's title, Markdown body, project assignment, or pinned status",
    UpdatePromptSchema.shape,
    async ({ id, render_markdown, ...input }) => {
      try {
        const result = await client.updatePrompt(id, input, render_markdown);
        return formatResult(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    "devbook_delete_prompt",
    "Permanently delete a prompt and its attachments from Devbook",
    DeletePromptSchema.shape,
    async ({ id }) => {
      try {
        const result = await client.deletePrompt(id);
        return formatResult(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    "devbook_toggle_pin",
    "Toggle the pinned status of a prompt on the Devbook sidebar",
    TogglePinPromptSchema.shape,
    async ({ id }) => {
      try {
        const result = await client.togglePinPrompt(id);
        return formatResult(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    "devbook_reorder_pinned",
    "Update the sequential order of pinned prompts displayed in the Devbook sidebar",
    ReorderPinnedPromptsSchema.shape,
    async ({ prompt_ids }) => {
      try {
        const result = await client.reorderPinnedPrompts(prompt_ids);
        return formatResult(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 3. Attachments
  server.tool(
    "devbook_list_attachments",
    "List file attachments associated with a prompt",
    { prompt_id: z.number().int().positive().describe("Unique identifier of the prompt") },
    async ({ prompt_id }) => {
      try {
        const result = await client.listAttachments(prompt_id);
        return formatResult(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    "devbook_upload_attachment",
    "Upload one or more files to attach to a prompt in Devbook (accepts local file paths or base64 data)",
    {
      prompt_id: z.number().int().positive().describe("Unique identifier of the prompt"),
      files: z.array(FileUploadItemSchema).min(1).describe("Files to attach (path on disk or base64 content)"),
    },
    async ({ prompt_id, files }) => {
      try {
        const processedFiles: Array<{ filename: string; content: Buffer; contentType?: string }> = [];

        for (const file of files) {
          if (file.path) {
            const resolvedPath = path.resolve(file.path);
            const content = await fs.readFile(resolvedPath);
            const filename = file.filename || path.basename(resolvedPath);
            processedFiles.push({ filename, content, contentType: file.content_type });
          } else if (file.content_base64 && file.filename) {
            const content = Buffer.from(file.content_base64, "base64");
            processedFiles.push({ filename: file.filename, content, contentType: file.content_type });
          } else {
            return formatError(new Error("Each file must specify either 'path' or both 'filename' and 'content_base64'"));
          }
        }

        const result = await client.uploadAttachments(prompt_id, processedFiles);
        return formatResult(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    "devbook_delete_attachment",
    "Purge and delete an attachment from a prompt",
    DeleteAttachmentSchema.shape,
    async ({ prompt_id, attachment_id }) => {
      try {
        const result = await client.deleteAttachment(prompt_id, attachment_id);
        return formatResult(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 4. Markdown Rendering
  server.tool(
    "devbook_render_markdown",
    "Render Markdown text to sanitized HTML using Devbook's GitHub-flavored markdown pipeline",
    RenderMarkdownSchema.shape,
    async ({ text }) => {
      try {
        const result = await client.renderMarkdown(text);
        return formatResult(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 5. System Stats
  server.tool(
    "devbook_get_stats",
    "Get system statistics from Devbook (total prompts, projects, attachments, pinned prompts, standalone prompts)",
    async () => {
      try {
        const result = await client.getStats();
        return formatResult(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );
}
