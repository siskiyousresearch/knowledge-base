import * as cheerio from "cheerio";

export interface UrlParseResult {
  text: string;
  metadata: Record<string, unknown>;
  links: string[];
}

export async function parseUrl(url: string): Promise<UrlParseResult> {
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

  // Extract same-domain links before removing elements
  const baseUrl = new URL(url);
  const linkSet = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    try {
      const resolved = new URL(href, url);
      // Same domain only, no fragments, no mailto/tel/javascript
      if (
        resolved.hostname === baseUrl.hostname &&
        resolved.protocol.startsWith("http") &&
        !resolved.hash
      ) {
        // Normalize: remove trailing slash, remove query params for dedup
        const clean = resolved.origin + resolved.pathname.replace(/\/$/, "");
        if (clean !== baseUrl.origin + baseUrl.pathname.replace(/\/$/, "")) {
          linkSet.add(clean);
        }
      }
    } catch {
      // Skip invalid URLs
    }
  });

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
    links: Array.from(linkSet),
  };
}
