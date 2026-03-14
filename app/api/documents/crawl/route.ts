import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseUrl } from "@/lib/documents/parsers/url";

const NON_PARSEABLE_CONTENT_TYPES = [
  "application/zip",
  "application/x-",
  "audio/",
  "video/",
];

interface ValidateResult {
  valid: string[];
  notFoundUrls: string[];
}

async function validateUrls(urls: string[]): Promise<ValidateResult> {
  const valid: string[] = [];
  const notFoundUrls: string[] = [];
  const batchSize = 10;

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map(async (link) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        try {
          const res = await fetch(link, {
            method: "HEAD",
            signal: controller.signal,
            redirect: "follow",
          });
          clearTimeout(timeout);

          if (res.status === 404) {
            return { url: link, status: "not_found" as const };
          }

          if (!res.ok) {
            return { url: link, status: "rejected" as const };
          }

          const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";
          const isNonParseable = NON_PARSEABLE_CONTENT_TYPES.some((t) =>
            contentType.includes(t)
          );

          if (isNonParseable) {
            return { url: link, status: "rejected" as const };
          }

          return { url: link, status: "ok" as const };
        } catch {
          clearTimeout(timeout);
          // Network error or timeout — keep the URL, it might work with a full GET
          return { url: link, status: "ok" as const };
        }
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value.status === "ok") {
          valid.push(result.value.url);
        } else if (result.value.status === "not_found") {
          notFoundUrls.push(result.value.url);
        }
        // "rejected" urls are silently dropped
      } else {
        // Promise itself rejected (shouldn't happen with try/catch, but keep URL to be safe)
        // No URL reference available here, so this branch is effectively unreachable
      }
    }
  }

  return { valid, notFoundUrls };
}

export async function POST(request: NextRequest) {
  try {
    const { url, maxDepth = 1, maxPages, projectId } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "url required" }, { status: 400 });
    }

    const clampedDepth = Math.min(Math.max(1, maxDepth), 99);
    const clampedPages = maxPages ? Math.max(1, maxPages) : 999999;

    const supabase = createAdminClient();

    // Create crawl job
    const { data: job, error: jobError } = await supabase
      .from("knowledge_crawl_jobs")
      .insert({
        root_url: url,
        max_depth: clampedDepth,
        max_pages: clampedPages,
        status: "running",
      })
      .select()
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: `Failed to create crawl job: ${jobError?.message}` }, { status: 500 });
    }

    // Parse root page to discover links
    let rootLinks: string[] = [];
    let rootText = "";
    let rootTitle = url;

    try {
      const result = await parseUrl(url);
      rootText = result.text;
      rootTitle = (result.metadata.title as string) || url;
      rootLinks = result.links;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await supabase
        .from("knowledge_crawl_jobs")
        .update({ status: "failed" })
        .eq("id", job.id);
      return NextResponse.json({ error: `Failed to fetch root URL: ${msg}` }, { status: 500 });
    }

    // Create root page document (status: pending, will be processed by queue)
    const docsToInsert: Array<{
      title: string;
      source: string;
      status: string;
      file_name: string;
      file_type: string;
      crawl_job_id: string;
      crawl_depth: number;
      project_id: string | null;
      metadata: Record<string, unknown>;
    }> = [];

    // Root page
    docsToInsert.push({
      title: rootTitle,
      source: "url",
      status: "pending",
      file_name: url,
      file_type: "url",
      crawl_job_id: job.id,
      crawl_depth: 0,
      project_id: projectId || null,
      metadata: { url, storagePath: null },
    });

    // Discovered links (depth 1) — validate with HEAD requests before inserting
    const linksToAdd = rootLinks.slice(0, clampedPages - 1);
    const { valid: validLinks, notFoundUrls } = await validateUrls(linksToAdd);

    // Log 404 URLs to the crawl job's deleted_urls column
    if (notFoundUrls.length > 0) {
      const deletedEntries = notFoundUrls.map((u) => ({ url: u, reason: "HEAD returned 404" }));
      await supabase
        .from("knowledge_crawl_jobs")
        .update({ deleted_urls: deletedEntries })
        .eq("id", job.id);
    }

    for (const link of validLinks) {
      docsToInsert.push({
        title: link,
        source: "url",
        status: "pending",
        file_name: link,
        file_type: "url",
        crawl_job_id: job.id,
        crawl_depth: 1,
        project_id: projectId || null,
        metadata: { url: link, storagePath: null },
      });
    }

    const { error: insertError } = await supabase
      .from("knowledge_documents")
      .insert(docsToInsert);

    if (insertError) {
      return NextResponse.json({ error: `Failed to create documents: ${insertError.message}` }, { status: 500 });
    }

    // Update crawl job counter
    await supabase
      .from("knowledge_crawl_jobs")
      .update({ pages_found: docsToInsert.length })
      .eq("id", job.id);

    return NextResponse.json({
      crawlJobId: job.id,
      pagesFound: docsToInsert.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
