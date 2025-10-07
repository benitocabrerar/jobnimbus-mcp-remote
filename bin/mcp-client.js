#!/usr/bin/env node
/**
 * MCP Client Proxy for Claude Desktop
 *
 * This script acts as a bridge between Claude Desktop and the remote MCP server.
 * It forwards requests from Claude Desktop to your Render.com server with proper
 * authentication headers.
 *
 * Configuration (via environment variables from Claude Desktop config):
 * - MCP_SERVER_URL: URL of your Render server
 * - JOBNIMBUS_API_KEY: Your JobNimbus API key
 * - JOBNIMBUS_INSTANCE: "stamford" or "guilford"
 */

import https from 'https';
import http from 'http';

// Get configuration from environment
const SERVER_URL = process.env.MCP_SERVER_URL;
const API_KEY = process.env.JOBNIMBUS_API_KEY;
const INSTANCE = process.env.JOBNIMBUS_INSTANCE || 'stamford';

// Debug logging to stderr (visible in Claude Desktop logs)
console.error('=== MCP Client Debug ===');
console.error('SERVER_URL:', SERVER_URL);
console.error('API_KEY length:', API_KEY ? API_KEY.length : 'undefined');
console.error('API_KEY (first 10 chars):', API_KEY ? API_KEY.substring(0, 10) + '...' : 'undefined');
console.error('INSTANCE:', INSTANCE);
console.error('=======================');

if (!SERVER_URL) {
  console.error('ERROR: MCP_SERVER_URL not configured');
  process.exit(1);
}

if (!API_KEY) {
  console.error('ERROR: JOBNIMBUS_API_KEY not configured');
  process.exit(1);
}

/**
 * Make HTTP request to MCP server
 */
function makeRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SERVER_URL);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-JobNimbus-Api-Key': API_KEY,
        'X-JobNimbus-Instance': INSTANCE,
      },
    };

    if (body) {
      const bodyStr = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = lib.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * Handle MCP protocol messages from stdin
 */
process.stdin.setEncoding('utf8');

let buffer = '';

process.stdin.on('data', async (chunk) => {
  buffer += chunk;

  // Process complete JSON-RPC messages
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const message = JSON.parse(line);

      // Helper function to safely write to stdout
      const safeWrite = (data) => {
        try {
          if (!process.stdout.destroyed) {
            process.stdout.write(data);
          }
        } catch (error) {
          // Ignore EPIPE errors when stdout is closed
          if (error.code !== 'EPIPE') {
            console.error('Write error:', error);
          }
        }
      };

      // Handle different MCP methods
      if (message.method === 'initialize') {
        // Handle MCP initialize handshake
        safeWrite(JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            protocolVersion: '2025-06-18',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'jobnimbus-mcp-remote-client',
              version: '1.0.0',
            },
          },
        }) + '\n');
      } else if (message.method === 'tools/list') {
        const response = await makeRequest('POST', '/mcp/tools/list', {});
        safeWrite(JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          result: response,
        }) + '\n');
      } else if (message.method === 'tools/call') {
        const response = await makeRequest('POST', '/mcp/tools/call', message.params);

        // Format response according to MCP protocol
        // Extract actual data from server response wrapper
        const data = response.data || response;

        safeWrite(JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(data, null, 2)
              }
            ]
          }
        }) + '\n');
      } else if (message.method === 'notifications/initialized') {
        // Client notification after initialize - no response needed
        // Just acknowledge silently
      } else {
        // Unsupported method
        safeWrite(JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          error: {
            code: -32601,
            message: 'Method not found',
          },
        }) + '\n');
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  }
});

process.stdin.on('end', () => {
  process.exit(0);
});
