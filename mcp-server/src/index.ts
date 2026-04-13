#!/usr/bin/env node

/**
 * Sentinel MCP Server
 *
 * Exposes Sentinel risk intelligence as Claude Skills via Model Context Protocol.
 * Tools: get_risk_score, get_trending_tokens, get_claimable_fees, compare_tokens
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { SentinelClient } from './client.js';
import { tools, handleToolCall } from './tools.js';

const DEFAULT_BASE_URL = 'https://sentinel-api.apiworkersdev.workers.dev';

function parseArgs(): { baseUrl?: string } {
  const args = process.argv.slice(2);
  const result: { baseUrl?: string } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base-url' && args[i + 1]) {
      result.baseUrl = args[i + 1];
      i++;
    }
  }

  return result;
}

async function main() {
  const cliArgs = parseArgs();
  const baseUrl = cliArgs.baseUrl || process.env.SENTINEL_BASE_URL || DEFAULT_BASE_URL;

  const client = new SentinelClient({ baseUrl });

  const server = new Server(
    {
      name: 'sentinel-mcp-server',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const result = await handleToolCall(client, name, args || {});
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) throw error;

      const msg = error instanceof Error ? error.message : 'Unknown error';
      throw new McpError(ErrorCode.InternalError, msg);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`Sentinel MCP server running on stdio (API: ${baseUrl})`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
