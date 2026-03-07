# pip install firecrawl-py
from firecrawl import Firecrawl

app = Firecrawl(api_key="fc-e201da5b566943cea82fc9083185d1c2")

# Scrape a website:
app.scrape('firecrawl.dev')

# Plug in your API key
export FIRECRAWL_API_KEY="fc-e201da5b566943cea82fc9083185d1c2"

npx -y firecrawl-cli@latest init --all --browser

# Your AI agent (Claude Code, Codex, OpenCode, etc) can now:
# Scrape a page to clean markdown
# Search and scrape top results
# Crawl an entire website
# Map an entire domain

# MCP Config
{
  "mcpServers": {
    "firecrawl-mcp": {
      "command": "npx",
      "args": ["-y", "firecrawl-mcp"],
      "env": {
        "FIRECRAWL_API_KEY": "$API_KEY"
      }
    }
  }
}