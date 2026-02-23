import * as cheerio from "cheerio";

export async function parseUrl(url: string): Promise<{ text: string; metadata: Record<string, unknown> }> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; KnowledgeBaseBot/1.0)",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Remove non-content elements
  $("script, style, nav, footer, header, aside, .sidebar, .menu, .nav, .advertisement").remove();

  // Try to find main content
  const mainContent = $("article, main, [role='main'], .content, .post-content, .entry-content").first();
  const text = mainContent.length > 0
    ? mainContent.text()
    : $("body").text();

  // Clean up whitespace
  const cleaned = text.replace(/\s+/g, " ").trim();

  return {
    text: cleaned,
    metadata: {
      url,
      title: $("title").text().trim(),
    },
  };
}
