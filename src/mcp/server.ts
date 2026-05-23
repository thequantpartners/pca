import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  type CallToolResult,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import {
  appendContextCommit,
  allowedContextCommitTypes,
  isContextCommitType,
  latestContextCommit,
  readContextCommits,
  type ContextCommitType,
} from "../core/context-commits.js";
import { getProjectRoot } from "../core/config.js";
import { measureContextHealth } from "../core/context-health.js";
import { buildQueryOutput, buildTaskContext, classifyTask, TASK_LIMITS } from "../core/prompt-builder.js";
import { getLocalProjectStatus, requireInitializedLocalProject } from "../core/project-status.js";
import { retrieveContext } from "../core/retrieval.js";
import { PCA_VERSION } from "../core/version.js";

type ToolArguments = Record<string, unknown>;

const tools: Tool[] = [
  {
    name: "pca_status",
    description: "Return the current PCA project state and local context health for the working directory.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "pca_query",
    description: "Search PCA context by query and return compact retrieved context.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query.",
        },
        limit: {
          type: "number",
          description: "Maximum number of context chunks to return. Defaults to 5.",
          minimum: 1,
          maximum: 20,
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "pca_task",
    description: "Generate compact PCA task context for an AI development task.",
    inputSchema: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description: "Development task description.",
        },
      },
      required: ["task"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "pca_commit",
    description: "Record a PCA context commit in the local project history.",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Context commit message.",
        },
        type: {
          type: "string",
          description: `Commit type. Allowed values: ${allowedContextCommitTypes()}. Defaults to general.`,
          enum: ["decision", "feature", "bugfix", "architecture", "product", "general"],
        },
      },
      required: ["message"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "pca_logs",
    description: "List PCA context commit history.",
    inputSchema: {
      type: "object",
      properties: {
        last: {
          type: "number",
          description: "Maximum number of commits to return. Defaults to 10.",
          minimum: 1,
          maximum: 100,
        },
        type: {
          type: "string",
          description: `Filter by commit type. Allowed values: ${allowedContextCommitTypes()}.`,
          enum: ["decision", "feature", "bugfix", "architecture", "product", "general"],
        },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
];

export async function startMCPServer(): Promise<void> {
  const server = new Server(
    {
      name: "@quantpartners/pca",
      version: PCA_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const args = request.params.arguments ?? {};

    switch (request.params.name) {
      case "pca_status":
        return pcaStatus();
      case "pca_query":
        return pcaQuery(args);
      case "pca_task":
        return pcaTask(args);
      case "pca_commit":
        return pcaCommit(args);
      case "pca_logs":
        return pcaLogs(args);
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function pcaStatus(): Promise<CallToolResult> {
  const root = getProjectRoot();
  const project = await getLocalProjectStatus(root);
  const commits = await readContextCommits(root);
  const latest = latestContextCommit(commits);
  const contextHealth = await measureContextHealth(root);

  return jsonToolResult({
    root,
    project,
    contextHealth,
    commits: {
      count: commits.length,
      latest: latest ?? null,
    },
  });
}

async function pcaQuery(args: ToolArguments): Promise<CallToolResult> {
  const query = requiredString(args, "query");
  const limit = optionalInteger(args, "limit", 5, 1, 20);
  const root = getProjectRoot();
  const results = await retrieveContext({ root, query, limit });

  return textToolResult(buildQueryOutput(query, results));
}

async function pcaTask(args: ToolArguments): Promise<CallToolResult> {
  const task = requiredString(args, "task");
  const root = getProjectRoot();
  const taskType = classifyTask(task);
  const results = await retrieveContext({
    root,
    query: task,
    limit: TASK_LIMITS[taskType],
  });

  return textToolResult(buildTaskContext(task, taskType, results));
}

async function pcaCommit(args: ToolArguments): Promise<CallToolResult> {
  const message = requiredString(args, "message");
  const rawType = optionalString(args, "type") ?? "general";

  if (!isContextCommitType(rawType)) {
    throw invalidParams(`Invalid type: ${rawType}. Allowed values: ${allowedContextCommitTypes()}.`);
  }

  const root = getProjectRoot();
  requireInitializedLocalProject(await getLocalProjectStatus(root));

  const commit = await appendContextCommit(root, message, rawType as ContextCommitType);
  return jsonToolResult(commit);
}

async function pcaLogs(args: ToolArguments): Promise<CallToolResult> {
  const last = optionalInteger(args, "last", 10, 1, 100);
  const type = optionalString(args, "type");

  if (type && !isContextCommitType(type)) {
    throw invalidParams(`Invalid type: ${type}. Allowed values: ${allowedContextCommitTypes()}.`);
  }

  const root = getProjectRoot();
  const commits = (await readContextCommits(root))
    .filter((commit) => !type || commit.type === type)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, last);

  return jsonToolResult({
    commits,
    count: commits.length,
  });
}

function requiredString(args: ToolArguments, name: string): string {
  const value = args[name];
  if (typeof value !== "string" || !value.trim()) {
    throw invalidParams(`Missing required string argument: ${name}.`);
  }

  return value.trim();
}

function optionalString(args: ToolArguments, name: string): string | undefined {
  const value = args[name];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !value.trim()) {
    throw invalidParams(`Invalid string argument: ${name}.`);
  }

  return value.trim();
}

function optionalInteger(args: ToolArguments, name: string, defaultValue: number, min: number, max: number): number {
  const value = args[name];
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw invalidParams(`Invalid ${name}. Use an integer between ${min} and ${max}.`);
  }

  return value;
}

function textToolResult(text: string): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
  };
}

function jsonToolResult(value: unknown): CallToolResult {
  return textToolResult(JSON.stringify(value, null, 2));
}

function invalidParams(message: string): McpError {
  return new McpError(ErrorCode.InvalidParams, message);
}
