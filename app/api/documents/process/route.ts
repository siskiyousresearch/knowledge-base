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

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Supabase client error: ${msg}` }, { status: 500 });
  }

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
    // Get file content from metadata
    const fileContent = doc.metadata?.fileContent as string | undefined;
    if (!fileContent) {
      throw new Error("File content not found in document metadata");
    }

    const buffer = Buffer.from(fileContent, "base64");
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
      try {
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
      } catch (chunkErr) {
        const msg = chunkErr instanceof Error ? chunkErr.message : String(chunkErr);
        throw new Error(`Failed at chunk ${i}/${chunks.length}: ${msg}`);
      }
    }

    // Update document: completed, clear file content from metadata
    await supabase
      .from("knowledge_documents")
      .update({
        status: "completed",
        chunk_count: chunks.length,
        metadata: parseMetadata,
      })
      .eq("id", documentId);

    return NextResponse.json({
      success: true,
      chunks: chunks.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    const stack = err instanceof Error ? err.stack : "";
    await supabase
      .from("knowledge_documents")
      .update({ status: "failed", error_message: `${message}\n${stack}` })
      .eq("id", documentId);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
