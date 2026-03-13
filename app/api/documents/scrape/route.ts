import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseUrl } from "@/lib/documents/parsers/url";
import { chunkText, estimateTokenCount } from "@/lib/documents/chunker";
import { generateEmbedding } from "@/lib/ai/embeddings";

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
    // For Google Drive, convert share link to export URL
    let fetchUrl = targetUrl;
    if (isGoogleDrive) {
      const match = targetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match) {
        fetchUrl = `https://docs.google.com/document/d/${match[1]}/export?format=txt`;
      }
    }

    const { text, metadata, links } = await parseUrl(fetchUrl);

    if (!text.trim()) {
      throw new Error("No text content could be extracted from the URL");
    }

    const title = (metadata.title as string) || new URL(targetUrl).hostname;
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

          const newLinks = links
            .filter((link) => !existingUrls.has(link))
            .slice(0, remaining);

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

    return NextResponse.json({ success: true, documentId: doc.id, chunks: chunks.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scraping failed";
    await supabase
      .from("knowledge_documents")
      .update({ status: "failed", error_message: message })
      .eq("id", doc.id);

    // Update crawl job failed counter if applicable
    const jobId = doc.crawl_job_id || crawlJobId;
    if (jobId) {
      const { data: job } = await supabase
        .from("knowledge_crawl_jobs")
        .select("pages_failed")
        .eq("id", jobId)
        .single();
      if (job) {
        await supabase
          .from("knowledge_crawl_jobs")
          .update({ pages_failed: job.pages_failed + 1 })
          .eq("id", jobId);
      }
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
