import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseUrl } from "@/lib/documents/parsers/url";
import { chunkText, estimateTokenCount } from "@/lib/documents/chunker";
import { generateEmbedding } from "@/lib/ai/embeddings";

export async function POST(request: NextRequest) {
  const { url } = await request.json();

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Determine source type
  const isGoogleDrive = url.includes("drive.google.com") || url.includes("docs.google.com");

  // Create document record
  const { data: doc, error: insertError } = await supabase
    .from("knowledge_documents")
    .insert({
      title: url,
      source: isGoogleDrive ? "google_drive" : "url",
      status: "processing",
      file_name: url,
      file_type: "url",
    })
    .select()
    .single();

  if (insertError || !doc) {
    return NextResponse.json({ error: insertError?.message || "Failed to create document" }, { status: 500 });
  }

  try {
    // For Google Drive, convert share link to export URL
    let fetchUrl = url;
    if (isGoogleDrive) {
      const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match) {
        fetchUrl = `https://docs.google.com/document/d/${match[1]}/export?format=txt`;
      }
    }

    const { text, metadata } = await parseUrl(fetchUrl);

    if (!text.trim()) {
      throw new Error("No text content could be extracted from the URL");
    }

    // Update title from scraped metadata
    const title = (metadata.title as string) || new URL(url).hostname;

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

    return NextResponse.json({ success: true, documentId: doc.id, chunks: chunks.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scraping failed";
    await supabase
      .from("knowledge_documents")
      .update({ status: "failed", error_message: message })
      .eq("id", doc.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
