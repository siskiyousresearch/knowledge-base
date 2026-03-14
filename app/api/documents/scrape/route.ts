import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseUrl } from "@/lib/documents/parsers/url";
import { parseDocument, isSupportedExtension } from "@/lib/documents";
import { chunkText, estimateTokenCount } from "@/lib/documents/chunker";
import { generateEmbedding } from "@/lib/ai/embeddings";

const FILE_EXTENSION_REGEX = /\.(pdf|docx|doc|xlsx|xls|csv|pptx|txt|md|png|jpg|jpeg|gif|webp)$/i;

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
      }
    }
  }

  return { valid, notFoundUrls };
}

export async function POST(request: NextRequest) {
  const { url, documentId, crawlJobId, crawlDepth = 0, projectId } = await request.json();

  if (!url && !documentId) {
    return NextResponse.json({ error: "url or documentId required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // If documentId provided, fetch the doc to get the URL
  let doc: { id: string; crawl_job_id: string | null; crawl_depth: number; file_name: string | null; project_id: string | null } | null = null;
  let targetUrl = url;

  if (documentId) {
    const { data, error } = await supabase
      .from("knowledge_documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    doc = data;
    targetUrl = (data.metadata as Record<string, unknown>)?.url as string || data.file_name;
  }

  if (!targetUrl) {
    return NextResponse.json({ error: "No URL available" }, { status: 400 });
  }

  const isGoogleDrive = targetUrl.includes("drive.google.com") || targetUrl.includes("docs.google.com");

  // Create document record if not already exists
  if (!doc) {
    const { data: newDoc, error: insertError } = await supabase
      .from("knowledge_documents")
      .insert({
        title: targetUrl,
        source: isGoogleDrive ? "google_drive" : "url",
        status: "processing",
        file_name: targetUrl,
        file_type: "url",
        crawl_job_id: crawlJobId || null,
        crawl_depth: crawlDepth,
        project_id: projectId || null,
      })
      .select()
      .single();

    if (insertError || !newDoc) {
      return NextResponse.json({ error: insertError?.message || "Failed to create document" }, { status: 500 });
    }
    doc = { id: newDoc.id, crawl_job_id: newDoc.crawl_job_id, crawl_depth: newDoc.crawl_depth, file_name: newDoc.file_name, project_id: newDoc.project_id };
  } else {
    await supabase
      .from("knowledge_documents")
      .update({ status: "processing" })
      .eq("id", doc.id);
  }

  try {
    // Wrap the entire processing in a timeout to prevent infinite hangs
    const processingTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Processing timed out after 90s for ${targetUrl}`)), 90000)
    );

    await Promise.race([processingTimeout, (async () => {
    // Check if the URL points to a downloadable file (PDF, DOCX, etc.)
    const urlPath = new URL(targetUrl).pathname;
    const fileExtMatch = urlPath.match(FILE_EXTENSION_REGEX);
    const isFileUrl = fileExtMatch && isSupportedExtension(fileExtMatch[0]);

    let text = "";
    let metadata: Record<string, unknown> = { url: targetUrl };
    let links: string[] = [];
    let title = "";

    if (isFileUrl && !isGoogleDrive) {
      // Download the file and parse it with the appropriate document parser
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 30000);
      let response: Response;
      try {
        response = await fetch(targetUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; KnowledgeBaseBot/1.0)" },
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(fetchTimeout);
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error(`Timed out downloading file after 30s: ${targetUrl}`);
        }
        throw err;
      }
      clearTimeout(fetchTimeout);

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const ext = fileExtMatch[0].toLowerCase();
      const result = await parseDocument(buffer, ext);
      text = result.text;
      metadata = { ...result.metadata, url: targetUrl };
      title = urlPath.split("/").pop()?.replace(/\.[^.]+$/, "") || targetUrl;
    } else {
      // HTML page — use URL parser
      let fetchUrl = targetUrl;
      if (isGoogleDrive) {
        const match = targetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match) {
          fetchUrl = `https://docs.google.com/document/d/${match[1]}/export?format=txt`;
        }
      }

      const result = await parseUrl(fetchUrl);
      text = result.text;
      metadata = result.metadata;
      links = result.links;
      title = (result.metadata.title as string) || new URL(targetUrl).hostname;
    }

    if (!text.trim()) {
      throw new Error("No text content could be extracted from the URL");
    }

    const chunks = chunkText(text);

    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk.content);
      const tokenCount = estimateTokenCount(chunk.content);

      await supabase.from("knowledge_document_chunks").insert({
        document_id: doc.id,
        chunk_index: chunk.index,
        content: chunk.content,
        token_count: tokenCount,
        embedding: JSON.stringify(embedding),
        metadata: chunk.metadata,
      });
    }

    await supabase
      .from("knowledge_documents")
      .update({
        title,
        status: "completed",
        chunk_count: chunks.length,
        metadata,
      })
      .eq("id", doc.id);

    // Crawl-aware: discover child URLs if within depth limit
    const jobId = doc.crawl_job_id || crawlJobId;
    const depth = doc.crawl_depth || crawlDepth;

    if (jobId && links.length > 0) {
      // Get the crawl job to check limits
      const { data: job } = await supabase
        .from("knowledge_crawl_jobs")
        .select("max_depth, max_pages, pages_found, status")
        .eq("id", jobId)
        .single();

      if (job && job.status === "running" && depth < job.max_depth) {
        const remaining = job.max_pages - job.pages_found;
        if (remaining > 0) {
          // Check which URLs already exist for this crawl job
          const { data: existingDocs } = await supabase
            .from("knowledge_documents")
            .select("file_name")
            .eq("crawl_job_id", jobId);

          const existingUrls = new Set(existingDocs?.map((d) => d.file_name) || []);

          const candidateLinks = links
            .filter((link) => !existingUrls.has(link))
            .slice(0, remaining);

          // HEAD validation before inserting child URLs
          const { valid: newLinks, notFoundUrls } = await validateUrls(candidateLinks);

          // Log 404 URLs to the crawl job's deleted_urls column
          if (notFoundUrls.length > 0) {
            const { data: currentJob } = await supabase
              .from("knowledge_crawl_jobs")
              .select("deleted_urls")
              .eq("id", jobId)
              .single();

            const existingDeleted = (currentJob?.deleted_urls as Array<{ url: string; reason: string; found_on?: string }>) || [];
            const newDeleted = notFoundUrls.map((u) => ({ url: u, reason: "HEAD returned 404", found_on: targetUrl }));

            await supabase
              .from("knowledge_crawl_jobs")
              .update({ deleted_urls: [...existingDeleted, ...newDeleted] })
              .eq("id", jobId);
          }

          if (newLinks.length > 0) {
            const newDocs = newLinks.map((link) => ({
              title: link,
              source: "url" as const,
              status: "pending" as const,
              file_name: link,
              file_type: "url",
              crawl_job_id: jobId,
              crawl_depth: depth + 1,
              project_id: doc.project_id || projectId || null,
              metadata: { url: link },
            }));

            await supabase.from("knowledge_documents").insert(newDocs);

            // Update crawl job counter
            await supabase
              .from("knowledge_crawl_jobs")
              .update({ pages_found: job.pages_found + newLinks.length })
              .eq("id", jobId);
          }
        }
      }

      // Update completed counter
      await supabase
        .from("knowledge_crawl_jobs")
        .update({ pages_completed: (await supabase
          .from("knowledge_documents")
          .select("id", { count: "exact", head: true })
          .eq("crawl_job_id", jobId)
          .eq("status", "completed")).count || 0 })
        .eq("id", jobId);

      // Check if crawl is done
      const { data: updatedJob } = await supabase
        .from("knowledge_crawl_jobs")
        .select("pages_found, pages_completed, pages_failed")
        .eq("id", jobId)
        .single();

      if (updatedJob && (updatedJob.pages_completed + updatedJob.pages_failed) >= updatedJob.pages_found) {
        // Check if there are still pending docs
        const { count } = await supabase
          .from("knowledge_documents")
          .select("id", { count: "exact", head: true })
          .eq("crawl_job_id", jobId)
          .eq("status", "pending");

        if (!count || count === 0) {
          await supabase
            .from("knowledge_crawl_jobs")
            .update({ status: "completed" })
            .eq("id", jobId);
        }
      }
    }

    })()]);

    return NextResponse.json({ success: true, documentId: doc.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scraping failed";
    const is404 = message.includes("404");
    const jobId = doc.crawl_job_id || crawlJobId;

    if (jobId) {
      // Log error to crawl job's deleted_urls for the report
      const { data: currentJob } = await supabase
        .from("knowledge_crawl_jobs")
        .select("deleted_urls, pages_failed")
        .eq("id", jobId)
        .single();

      if (currentJob) {
        const existingDeleted = (currentJob.deleted_urls as Array<{ url: string; reason: string; found_on?: string }>) || [];
        const updatedDeleted = [...existingDeleted, { url: targetUrl, reason: message, found_on: "crawl discovery" }];

        await supabase
          .from("knowledge_crawl_jobs")
          .update({
            deleted_urls: updatedDeleted,
            pages_failed: currentJob.pages_failed + 1,
          })
          .eq("id", jobId);
      }

      if (is404) {
        // Auto-delete 404 documents to keep sources list clean
        await supabase
          .from("knowledge_documents")
          .delete()
          .eq("id", doc.id);
      } else {
        // Non-404: keep as failed so user can investigate
        await supabase
          .from("knowledge_documents")
          .update({ status: "failed", error_message: message })
          .eq("id", doc.id);
      }
    } else {
      // Not part of a crawl — mark as failed with error message
      await supabase
        .from("knowledge_documents")
        .update({ status: "failed", error_message: message })
        .eq("id", doc.id);
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
