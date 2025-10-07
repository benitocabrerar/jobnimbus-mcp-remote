# 🚀 Setup Guide - JobNimbus MCP Remote Server

This guide will help you set up and deploy the JobNimbus MCP Remote Server.

## 📋 Prerequisites

- Node.js 18+ installed
- GitHub account
- Render.com account (free tier works)
- JobNimbus API keys (Stamford and/or Guilford)

---

## 🏗️ Part 1: Initial Setup (5 minutes)

### 1. Clone and Install

```bash
cd jobnimbus-mcp-remote
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
NODE_ENV=development
PORT=3000
JOBNIMBUS_API_BASE_URL=https://app.jobnimbus.com/api1
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60
LOG_LEVEL=debug
```

### 3. Test Locally

```bash
npm run dev
```

Visit: http://localhost:3000/health

You should see:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 1234,
  "timestamp": "2025-..."
}
```

---

## 📦 Part 2: GitHub Setup (5 minutes)

### 1. Create GitHub Repository

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/jobnimbus-mcp-remote.git
git push -u origin main
```

### 2. Configure GitHub Secrets

Go to: **Settings → Secrets and variables → Actions**

Add these secrets:
- `RENDER_API_KEY`: Your Render API key
- `RENDER_SERVICE_ID`: Your Render service ID (from Part 3)
- `RENDER_SERVICE_URL`: Your Render service URL (from Part 3)

---

## ☁️ Part 3: Render.com Deployment (10 minutes)

### 1. Create Render Account

Go to: https://render.com and sign up (free)

### 2. Deploy from GitHub

1. Click **"New +"** → **"Blueprint"**
2. Connect your GitHub repository
3. Select `jobnimbus-mcp-remote`
4. Click **"Apply"**

Render will automatically:
- Read `render.yaml`
- Install dependencies
- Build TypeScript
- Deploy to production
- Generate HTTPS URL

### 3. Get Service Info

After deployment, note:
- **Service ID**: From URL (after `/services/`)
- **Service URL**: Your `.onrender.com` URL

Add these to GitHub Secrets (see Part 2, step 2)

### 4. Verify Deployment

```bash
curl https://your-service.onrender.com/health
```

---

## 💻 Part 4: Claude Desktop Configuration (5 minutes)

### Option A: Using Stamford Instance

Create or edit: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "jobnimbus-stamford": {
      "command": "node",
      "args": ["C:/path/to/examples/mcp-client.js"],
      "env": {
        "MCP_SERVER_URL": "https://your-service.onrender.com",
        "JOBNIMBUS_API_KEY": "your_stamford_api_key_here",
        "JOBNIMBUS_INSTANCE": "stamford"
      }
    }
  }
}
```

### Option B: Using Both Instances

```json
{
  "mcpServers": {
    "jobnimbus-stamford": {
      "command": "node",
      "args": ["C:/path/to/examples/mcp-client.js"],
      "env": {
        "MCP_SERVER_URL": "https://your-service.onrender.com",
        "JOBNIMBUS_API_KEY": "your_stamford_api_key",
        "JOBNIMBUS_INSTANCE": "stamford"
      }
    },
    "jobnimbus-guilford": {
      "command": "node",
      "args": ["C:/path/to/examples/mcp-client.js"],
      "env": {
        "MCP_SERVER_URL": "https://your-service.onrender.com",
        "JOBNIMBUS_API_KEY": "your_guilford_api_key",
        "JOBNIMBUS_INSTANCE": "guilford"
      }
    }
  }
}
```

### Restart Claude Desktop

The MCP server should now be available in Claude Desktop!

---

## 🧪 Part 5: Test Connection (2 minutes)

In Claude Desktop, try:

```
Get the first 10 jobs from JobNimbus
```

Claude should use the `get_jobs` tool and return results.

---

## ✅ Verification Checklist

- [ ] Server runs locally (http://localhost:3000/health)
- [ ] GitHub repository created
- [ ] Render deployment successful
- [ ] Health check passes on Render
- [ ] Claude Desktop config updated
- [ ] Tools work in Claude Desktop

---

## 🔧 Troubleshooting

### Local Server Won't Start

```bash
# Check Node version
node --version  # Should be 18+

# Clear and reinstall
rm -rf node_modules
npm install
```

### Render Deployment Failed

Check build logs in Render dashboard:
- Look for TypeScript errors
- Verify `render.yaml` is correct
- Check environment variables

### Claude Desktop Can't Connect

1. Verify server URL is correct
2. Check API key is valid
3. Check `mcp-client.js` path
4. Restart Claude Desktop

### API Key Not Working

Test manually:
```bash
curl -X POST https://your-service.onrender.com/mcp/tools/list \
  -H "X-JobNimbus-Api-Key: your_api_key" \
  -H "Content-Type: application/json"
```

Should return list of tools.

---

## 🎉 Next Steps

- Add more tools (see `docs/ADDING_TOOLS.md`)
- Configure multiple clients
- Monitor usage in Render dashboard
- Set up custom domain (optional)

---

## 📞 Support

- Check logs: `npm run dev` for local, Render dashboard for production
- Verify API keys are valid in JobNimbus
- Review `docs/ARCHITECTURE.md` for technical details
