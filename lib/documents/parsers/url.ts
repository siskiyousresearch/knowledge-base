import * as cheerio from "cheerio";

const BLOCKED_EXTENSIONS = new Set([
  ".zip", ".exe", ".dmg", ".mp3", ".mp4", ".avi", ".mov", ".wav",
  ".tar", ".gz", ".rar", ".7z", ".iso", ".pkg", ".deb", ".rpm",
  ".msi", ".apk",
]);

const BLOCKED_PATH_SEGMENTS = [
  "/login", "/logout", "/wp-admin", "/cart", "/search",
  "/signin", "/signup", "/register",
];

export interface UrlParseResult {
  text: string;
  metadata: Record<string, unknown>;
  links: string[];
}

export async function parseUrl(url: string): Promise<UrlParseResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KnowledgeBaseBot/1.0)",
      },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Timed out fetching URL after 30s: ${url}`);
    }
    throw err;
  }
  clearTimeout(timeout);

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
          // Skip non-content file extensions
          const ext = resolved.pathname.match(/\.\w+$/)?.[0]?.toLowerCase();
          if (ext && BLOCKED_EXTENSIONS.has(ext)) return;

          // Skip common non-content paths
          const lowerPath = resolved.pathname.toLowerCase();
          if (BLOCKED_PATH_SEGMENTS.some((seg) => lowerPath.includes(seg))) return;

          // Skip URLs with more than 3 query parameters (likely dynamic app pages)
          if (resolved.searchParams.size > 3) return;

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
