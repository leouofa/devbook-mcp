import type { components, paths } from "./devbook-api.js";

export type Schemas = components["schemas"];

export type Project = Schemas["Project"];
export type ProjectInput = Schemas["ProjectInput"];
export type ProjectWithPrompts = Schemas["ProjectWithPrompts"];

export type Prompt = Schemas["Prompt"];
export type PromptDetail = Schemas["PromptDetail"];
export type PromptInput = Schemas["PromptInput"];

export type Attachment = Schemas["Attachment"];
export type Stats = Schemas["Stats"];
export type MarkdownRequest = Schemas["MarkdownRequest"];
export type MarkdownResponse = Schemas["MarkdownResponse"];
export type PaginationMeta = Schemas["PaginationMeta"];
export type ErrorResponse = Schemas["ErrorResponse"];

export interface PaginatedProjects {
  projects: Project[];
  meta: PaginationMeta;
}

export interface PaginatedPrompts {
  prompts: Prompt[];
  meta: PaginationMeta;
}

export interface AttachmentsResponse {
  attachments: Attachment[];
}

export interface TogglePinResponse {
  status: string;
  pinned: boolean;
  pinned_position: number | null;
  prompt: Prompt;
}

export interface StatusOkResponse {
  status: string;
  message: string;
}
