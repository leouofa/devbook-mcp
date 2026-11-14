import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DevbookClient } from "../client/devbook-client.js";

/**
 * Extracts all unique placeholder variable names from a prompt template string.
 * Example: "Review {{code}} in {{language}}" -> ["code", "language"]
 */
export function extractTemplateVariables(body: string): string[] {
  const matches = Array.from(body.matchAll(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g), (m) => m[1]);
  return Array.from(new Set(matches));
}

/**
 * Substitutes variables in a prompt body.
 */
export function substituteVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    result = result.replace(pattern, value);
  }
  return result;
}

/**
 * Normalizes a prompt title to an MCP-compliant prompt identifier (lowercase alphanumeric + underscores).
 */
export function toPromptSlug(id: number, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return `devbook_${id}_${slug || "prompt"}`;
}

export function registerPrompts(server: McpServer, client: DevbookClient): void {
  // 1. Generic dynamic executor prompt: allows executing ANY prompt by ID with arbitrary variables
  server.prompt(
    "devbook_execute_prompt",
    "Load and execute any Devbook prompt template by ID, substituting {{variables}} into the prompt body",
    {
      prompt_id: z.string().describe("The ID of the Devbook prompt to fetch and format"),
      variables: z
        .string()
        .optional()
        .describe("JSON string mapping variable names to their values (e.g. '{\"code\":\"...\",\"language\":\"typescript\"}')"),
    },
    async ({ prompt_id, variables }) => {
      const id = Number(prompt_id);
      const prompt = await client.getPrompt(id);

      let parsedVars: Record<string, string> = {};
      if (variables) {
        try {
          parsedVars = JSON.parse(variables);
        } catch {
          // If not valid JSON, treat as raw input
        }
      }

      const formattedText = substituteVariables(prompt.body || "", parsedVars);

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: formattedText,
            },
          },
        ],
      };
    }
  );

  // 2. Prompt Authoring Helper prompt
  server.prompt(
    "devbook_author_prompt",
    "Interactive prompt engineer guide to craft structured prompt templates with {{variable}} placeholders for Devbook",
    {
      goal: z.string().describe("What task or domain the prompt template is designed to solve"),
      project_id: z.string().optional().describe("Optional Devbook project ID to associate this prompt with"),
    },
    async ({ goal, project_id }) => {
      const guideText = [
        `You are assisting the user in engineering a high-quality prompt template for Devbook.`,
        `Target Goal: ${goal}`,
        project_id ? `Target Project ID: ${project_id}` : `Scope: Standalone prompt`,
        "",
        `Please draft:`,
        `1. An evocative title for the prompt.`,
        `2. Clear Markdown instructions with defined roles, constraints, and few-shot examples.`,
        `3. Dynamic placeholders in the format {{variable_name}} for inputs to be filled at runtime.`,
        `4. The call to 'devbook_create_prompt' to persist this template into the Devbook workbench.`,
      ].join("\n");

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: guideText,
            },
          },
        ],
      };
    }
  );
}

/**
 * Optionally syncs active prompts from a running Devbook instance into MCP prompts at server startup.
 */
export async function syncPromptsFromDevbook(server: McpServer, client: DevbookClient): Promise<number> {
  try {
    const { prompts } = await client.listPrompts({ limit: 50 });
    let registeredCount = 0;

    for (const prompt of prompts) {
      const promptSlug = toPromptSlug(prompt.id, prompt.title);
      const variables = extractTemplateVariables(prompt.body || "");
      const shape: Record<string, z.ZodString> = {};

      for (const v of variables) {
        shape[v] = z.string().describe(`Template value for {{${v}}}`);
      }

      try {
        server.prompt(
          promptSlug,
          `[Devbook] ${prompt.title} (${prompt.project_name || "Standalone"})`,
          shape,
          async (args) => {
            const fullPrompt = await client.getPrompt(prompt.id);
            const substituted = substituteVariables(fullPrompt.body || "", args as Record<string, string>);
            return {
              messages: [
                {
                  role: "user",
                  content: {
                    type: "text",
                    text: substituted,
                  },
                },
              ],
            };
          }
        );
        registeredCount++;
      } catch {
        // Skip duplicate or registration errors
      }
    }
    return registeredCount;
  } catch {
    // If Devbook API is temporarily offline during boot, generic prompts remain available
    return 0;
  }
}
