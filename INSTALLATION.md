# 🚀 JobNimbus MCP Client - Universal Installation Guide

**Works on ANY computer - No cloning, no local setup required!**

## Quick Start (2 Minutes)

### Step 1: Configure Claude Desktop

**Find your config file:**
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

### Step 2: Add This Configuration

Open the config file and add:

```json
{
  "mcpServers": {
    "Joblimbus-Stamford": {
      "command": "npx",
      "args": [
        "-y",
        "jobnimbus-mcp-client"
      ],
      "env": {
        "MCP_SERVER_URL": "https://jobnimbus-mcp-remote.onrender.com",
        "JOBNIMBUS_API_KEY": "your_stamford_api_key_here",
        "JOBNIMBUS_INSTANCE": "stamford"
      }
    },
    "Joblimbus-Guilford": {
      "command": "npx",
      "args": [
        "-y",
        "jobnimbus-mcp-client"
      ],
      "env": {
        "MCP_SERVER_URL": "https://jobnimbus-mcp-remote.onrender.com",
        "JOBNIMBUS_API_KEY": "your_guilford_api_key_here",
        "JOBNIMBUS_INSTANCE": "guilford"
      }
    }
  }
}
```

### Step 3: Replace API Keys

Get your JobNimbus API key:
1. Log into JobNimbus
2. Go to **Settings** → **Integrations** → **API**
3. Copy your 16-character API key
4. Replace `your_stamford_api_key_here` and `your_guilford_api_key_here` in the config

### Step 4: Restart Claude Desktop

Close and reopen Claude Desktop completely. That's it!

## ✅ Verification

After restart, type in Claude:
```
What JobNimbus tools do I have access to?
```

You should see 60+ tools including:
- `get_jobs`, `search_jobs`
- `get_contacts`, `search_contacts`
- `get_activities`, `get_estimates`
- `analyze_insurance_pipeline`
- And many more!

## 🆚 Old vs New Configuration

### ❌ OLD WAY (Only works on one computer)
```json
{
  "command": "node",
  "args": ["C:\\Users\\benito\\poweria\\jobnimbus\\...\\mcp-client.js"]
}
```
**Problem**: Hardcoded local path - breaks on other computers

### ✅ NEW WAY (Works everywhere)
```json
{
  "command": "npx",
  "args": ["-y", "jobnimbus-mcp-client"]
}
```
**Solution**: npx downloads and runs the client automatically

## 🔧 How It Works

```
┌─────────────────┐
│ Claude Desktop  │ ← You type here
└────────┬────────┘
         │ MCP Protocol
         ▼
┌─────────────────────────┐
│ jobnimbus-mcp-client    │ ← Auto-installed by npx
│ (Local Proxy)           │
└────────┬────────────────┘
         │ HTTPS
         ▼
┌─────────────────────────┐
│ MCP Server (Render.com) │ ← Centralized server
└────────┬────────────────┘
         │ REST API
         ▼
┌─────────────────────────┐
│ JobNimbus API           │ ← Your data
└─────────────────────────┘
```

## 💡 Why This Is Better

| Feature | Old (Local Path) | New (npx) |
|---------|-----------------|-----------|
| Works on any computer | ❌ No | ✅ Yes |
| Auto-updates | ❌ No | ✅ Yes |
| Easy to share | ❌ No | ✅ Yes |
| Requires cloning repo | ✅ Yes | ❌ No |
| Path issues | ✅ Common | ❌ None |

## 🛠️ Troubleshooting

### "Command not found: npx"
**Solution**: Install Node.js from https://nodejs.org (includes npx)

### "Method not found" error
**Solution**: Restart Claude Desktop to clear cache

### "Invalid API key" error
**Solution**:
1. Verify API key is exactly 16 characters
2. No extra spaces
3. Correct instance (stamford/guilford)

### Tools not showing
**Solution**:
1. Check config file syntax (valid JSON)
2. Restart Claude Desktop completely
3. Check Claude Desktop logs for errors

## 📱 Multi-Computer Setup

Want to use JobNimbus tools on multiple computers? Just copy the config to each computer:

1. **Laptop**: Configure once
2. **Desktop**: Copy the same config
3. **Work PC**: Copy the same config

All connect to the same server, no coordination needed!

## 🔐 Security

Your API key:
- ✅ Stays in your local Claude config
- ✅ Sent directly to the server (HTTPS)
- ✅ Never stored on the server
- ✅ Never logged
- ✅ Cleaned from memory immediately

## 📊 What You Get

### 60+ JobNimbus Tools

**Core Data:**
- Jobs, Contacts, Estimates, Activities

**Enhanced Features (NEW!):**
- Schedule filtering (`scheduled_from`, `scheduled_to`)
- Multi-field sorting (`date_start`, `date_end`, etc.)
- Boolean filters (`has_schedule`)

**Analytics:**
- Sales rep performance
- Revenue reports
- Pipeline analysis
- Margin analysis

**Advanced:**
- Insurance pipeline optimization
- Retail pipeline analysis
- Forecasting & predictions
- Smart scheduling

## 🎯 Example Usage

### Get Jobs Scheduled This Month
```javascript
get_jobs({
  scheduled_from: "2025-10-01",
  scheduled_to: "2025-10-31",
  sort_by: "date_start",
  order: "asc"
})
```

### Search Insurance Jobs
```javascript
search_jobs({
  query: "insurance",
  has_schedule: true,
  size: 20
})
```

### Find Unscheduled Jobs
```javascript
get_jobs({
  has_schedule: false,
  sort_by: "date_created",
  order: "desc"
})
```

## 🔄 Updates

npx checks for updates automatically. To force update:
```bash
npx clear-npx-cache
```
Then restart Claude Desktop.

## 📞 Support

- **GitHub**: https://github.com/benitocabrerar/jobnimbus-mcp-remote
- **Issues**: https://github.com/benitocabrerar/jobnimbus-mcp-remote/issues
- **Documentation**: See README.md in the repository

## 📝 Version

Current version: **1.0.0**

---

**Made with ❤️ for Poweria**

*Universal access to JobNimbus from any computer running Claude Desktop*
