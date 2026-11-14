import { type McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DevbookClient } from "../client/devbook-client.js";

export function registerResources(server: McpServer, client: DevbookClient): void {
  // 1. Stats Resource
  server.resource(
    "devbook_stats",
    "devbook://stats",
    {
      mimeType: "application/json",
      description: "Aggregated workbench statistics: total prompts, projects, attachments, and pinned prompts",
    },
    async (uri) => {
      const stats = await client.getStats();
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(stats, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    }
  );

  // 2. All Projects List Resource
  server.resource(
    "devbook_projects",
    "devbook://projects",
    {
      mimeType: "application/json",
      description: "Index of all active project workspaces in Devbook",
    },
    async (uri) => {
      const projects = await client.listProjects({ limit: 100 });
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(projects, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    }
  );

  // 3. Project Detail Resource Template
  server.resource(
    "devbook_project_detail",
    new ResourceTemplate("devbook://projects/{id}", {
      list: async () => {
        try {
          const { projects } = await client.listProjects({ limit: 100 });
          return {
            resources: projects.map((p) => ({
              uri: `devbook://projects/${p.id}`,
              name: `Project: ${p.name}`,
              description: p.description || `Project ${p.name} with ${p.prompts_count} prompts`,
              mimeType: "application/json",
            })),
          };
        } catch {
          return { resources: [] };
        }
      },
    }),
    {
      mimeType: "application/json",
      description: "Detailed view of a project, its description, and its list of prompts",
    },
    async (uri, params) => {
      const id = Number(params.id);
      const project = await client.getProject(id);
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(project, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    }
  );

  // 4. All Prompts List Resource
  server.resource(
    "devbook_prompts",
    "devbook://prompts",
    {
      mimeType: "application/json",
      description: "Index of all prompts currently saved in Devbook",
    },
    async (uri) => {
      const prompts = await client.listPrompts({ limit: 100 });
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(prompts, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    }
  );

  // 5. Prompt Detail Resource Template (Returns Markdown with frontmatter header)
  server.resource(
    "devbook_prompt_detail",
    new ResourceTemplate("devbook://prompts/{id}", {
      list: async () => {
        try {
          const { prompts } = await client.listPrompts({ limit: 100 });
          return {
            resources: prompts.map((p) => ({
              uri: `devbook://prompts/${p.id}`,
              name: `Prompt: ${p.title}`,
              description: p.project_name ? `[${p.project_name}] ${p.title}` : `[Standalone] ${p.title}`,
              mimeType: "text/markdown",
            })),
          };
        } catch {
          return { resources: [] };
        }
      },
    }),
    {
      mimeType: "text/markdown",
      description: "Prompt raw Markdown content and metadata headers",
    },
    async (uri, params) => {
      const id = Number(params.id);
      const prompt = await client.getPrompt(id);

      const header = [
        "---",
        `id: ${prompt.id}`,
        `title: ${JSON.stringify(prompt.title)}`,
        `project: ${JSON.stringify(prompt.project_name || "Standalone")}`,
        `pinned: ${prompt.pinned}`,
        `attachments_count: ${prompt.attachments_count}`,
        `updated_at: ${prompt.updated_at}`,
        "---",
        "",
      ].join("\n");

      return {
        contents: [
          {
            uri: uri.href,
            text: `${header}${prompt.body}`,
            mimeType: "text/markdown",
          },
        ],
      };
    }
  );
}
