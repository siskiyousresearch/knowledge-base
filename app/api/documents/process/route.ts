import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseDocument } from "@/lib/documents";
import { chunkText, estimateTokenCount } from "@/lib/documents/chunker";
import { generateEmbedding } from "@/lib/ai/embeddings";

export async function POST(request: NextRequest) {
  const { documentId } = await request.json();

  if (!documentId) {
    return NextResponse.json({ error: "documentId required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Fetch document
  const { data: doc, error: fetchError } = await supabase
    .from("knowledge_documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (fetchError || !doc) {
    return NextResponse.json({ error: `Document not found: ${fetchError?.message || "no data"}` }, { status: 404 });
  }

  // Update status to processing
  await supabase
    .from("knowledge_documents")
    .update({ status: "processing" })
    .eq("id", documentId);

  try {
    // Download file from Supabase Storage
    const storagePath = doc.metadata?.storagePath as string | undefined;
    if (!storagePath) {
      throw new Error("Storage path not found in document metadata");
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(storagePath);

    if (downloadError || !fileData) {
      throw new Error(`Storage download error: ${downloadError?.message || "no data"}`);
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const extension = doc.file_type || "";

    // Parse document
    const { text, metadata: parseMetadata } = await parseDocument(buffer, extension);

    if (!text.trim()) {
      throw new Error("No text content could be extracted from the document");
    }

    // Chunk text
    const chunks = chunkText(text);

    // Generate embeddings and insert chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await generateEmbedding(chunk.content);
      const tokenCount = estimateTokenCount(chunk.content);

      const { error: insertError } = await supabase.from("knowledge_document_chunks").insert({
        document_id: documentId,
        chunk_index: chunk.index,
        content: chunk.content,
        token_count: tokenCount,
        embedding: JSON.stringify(embedding),
        metadata: chunk.metadata,
      });

      if (insertError) {
        throw new Error(`Chunk ${i} insert error: ${insertError.message}`);
      }
    }

    // Update document status, clean up storage file
    await supabase
      .from("knowledge_documents")
      .update({
        status: "completed",
        chunk_count: chunks.length,
        metadata: parseMetadata,
      })
      .eq("id", documentId);

    // Delete the uploaded file from storage (no longer needed)
    await supabase.storage.from("documents").remove([storagePath]);

    return NextResponse.json({
      success: true,
      chunks: chunks.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    await supabase
      .from("knowledge_documents")
      .update({ status: "failed", error_message: message })
      .eq("id", documentId);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
