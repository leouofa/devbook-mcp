import { z } from "zod";

export const ListProjectsSchema = z.object({
  q: z.string().optional().describe("Search query to filter projects by name or description"),
  limit: z.number().int().min(1).max(100).optional().describe("Number of projects to return (default 50, max 100)"),
  offset: z.number().int().min(0).optional().describe("Pagination offset (default 0)"),
});

export const GetProjectSchema = z.object({
  id: z.number().int().positive().describe("Unique identifier of the project"),
});

export const CreateProjectSchema = z.object({
  name: z.string().min(1).describe("Name of the project"),
  description: z.string().optional().describe("Detailed description of the project workspace"),
});

export const UpdateProjectSchema = z.object({
  id: z.number().int().positive().describe("Unique identifier of the project to update"),
  name: z.string().min(1).optional().describe("New name for the project"),
  description: z.string().optional().describe("New description for the project"),
});

export const DeleteProjectSchema = z.object({
  id: z.number().int().positive().describe("Unique identifier of the project to delete"),
});

export const ListPromptsSchema = z.object({
  q: z.string().optional().describe("Full-text search query across prompt title and body"),
  project_id: z.number().int().positive().optional().describe("Filter prompts belonging to a specific project ID"),
  scope: z.enum(["standalone"]).optional().describe("Filter to standalone scratchpad prompts without a project assignment"),
  pinned: z.boolean().optional().describe("Filter by pinned status (true = only pinned, false = only unpinned)"),
  limit: z.number().int().min(1).max(100).optional().describe("Number of prompts to return (default 50, max 100)"),
  offset: z.number().int().min(0).optional().describe("Pagination offset (default 0)"),
});

export const GetPromptSchema = z.object({
  id: z.number().int().positive().describe("Unique identifier of the prompt"),
  render_markdown: z.boolean().optional().describe("Whether to include rendered HTML in the response"),
});

export const CreatePromptSchema = z.object({
  title: z.string().min(1).describe("Title of the prompt template"),
  body: z.string().default("").describe("Raw Markdown template content of the prompt"),
  project_id: z.number().int().positive().nullable().optional().describe("Associated project ID, or null for a standalone prompt"),
  pinned: z.boolean().optional().describe("Whether the prompt should be pinned to the workbench sidebar"),
  pinned_position: z.number().int().min(0).optional().describe("Sequential ordering position among pinned prompts"),
});

export const UpdatePromptSchema = z.object({
  id: z.number().int().positive().describe("Unique identifier of the prompt to update"),
  title: z.string().min(1).optional().describe("Updated title for the prompt"),
  body: z.string().optional().describe("Updated Markdown template content"),
  project_id: z.number().int().positive().nullable().optional().describe("Reassign to a project ID or null for standalone"),
  pinned: z.boolean().optional().describe("Pin or unpin the prompt"),
  pinned_position: z.number().int().min(0).optional().describe("Reorder pinned position"),
  render_markdown: z.boolean().optional().describe("Whether to return rendered HTML"),
});

export const DeletePromptSchema = z.object({
  id: z.number().int().positive().describe("Unique identifier of the prompt to delete"),
});

export const TogglePinPromptSchema = z.object({
  id: z.number().int().positive().describe("Unique identifier of the prompt whose pin status to toggle"),
});

export const ReorderPinnedPromptsSchema = z.object({
  prompt_ids: z.array(z.number().int().positive()).describe("Ordered list of pinned prompt IDs representing the new sequence"),
});

export const ListAttachmentsSchema = z.object({
  prompt_id: z.number().int().positive().describe("Unique identifier of the prompt whose attachments to list"),
});

export const FileUploadItemSchema = z.object({
  path: z.string().optional().describe("Absolute or relative local file path to read and upload"),
  filename: z.string().optional().describe("Target filename on Devbook (required if providing content_base64)"),
  content_base64: z.string().optional().describe("Base64-encoded file data if uploading in-memory content instead of a local file path"),
  content_type: z.string().optional().describe("MIME type (e.g., text/markdown, application/json, image/png)"),
});

export const UploadAttachmentSchema = z.object({
  prompt_id: z.number().int().positive().describe("Unique identifier of the prompt to attach files to"),
  files: z.array(FileUploadItemSchema).min(1).describe("List of files to attach (via local path or base64)"),
});

export const DeleteAttachmentSchema = z.object({
  prompt_id: z.number().int().positive().describe("Unique identifier of the prompt"),
  attachment_id: z.number().int().positive().describe("Unique identifier of the attachment to remove"),
});

export const RenderMarkdownSchema = z.object({
  text: z.string().describe("Markdown text to render into sanitized GitHub Flavored HTML"),
});

export const GetStatsSchema = z.object({});
