import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { chatCompletionStream } from "@/lib/ai/openrouter";
import { SIMILARITY_THRESHOLD, MAX_CONTEXT_CHUNKS } from "@/lib/constants";
import { ChatMessage, ChunkSearchResult } from "@/lib/types";

export async function POST(request: NextRequest) {
  const { messages, conversationId } = (await request.json()) as {
    messages: ChatMessage[];
    conversationId?: string;
  };

  if (!messages?.length) {
    return new Response(JSON.stringify({ error: "Messages required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createAdminClient();
  const userMessage = messages[messages.length - 1].content;

  // 1. Embed user query
  const queryEmbedding = await generateEmbedding(userMessage);

  // 2. Vector similarity search
  const { data: chunks, error: searchError } = await supabase.rpc(
    "knowledge_match_chunks",
    {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: SIMILARITY_THRESHOLD,
      match_count: MAX_CONTEXT_CHUNKS,
    }
  );

  if (searchError) {
    return new Response(JSON.stringify({ error: searchError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3. Fetch parent document titles
  const sources: ChunkSearchResult[] = [];
  if (chunks?.length) {
    const docIds = [...new Set(chunks.map((c: ChunkSearchResult) => c.document_id))];
    const { data: docs } = await supabase
      .from("knowledge_documents")
      .select("id, title")
      .in("id", docIds);

    const titleMap = new Map(docs?.map((d: { id: string; title: string }) => [d.id, d.title]) || []);

    for (const chunk of chunks) {
      sources.push({
        ...chunk,
        document_title: titleMap.get(chunk.document_id) || "Unknown",
      });
    }
  }

  // 4. Build system prompt with context
  const contextBlock = sources.length
    ? sources
        .map(
          (s, i) =>
            `[Source ${i + 1}: ${s.document_title}]\n${s.content}`
        )
        .join("\n\n")
    : "No relevant documents found in the knowledge base.";

  const systemMessage: ChatMessage = {
    role: "system",
    content: `You are a helpful knowledge base assistant. Answer questions using the provided context from the knowledge base documents. If the context doesn't contain relevant information, say so clearly. Always cite which source(s) you're drawing from.

## Context from Knowledge Base:
${contextBlock}`,
  };

  // 5. Stream response from DeepSeek
  const fullMessages = [systemMessage, ...messages];
  const stream = await chatCompletionStream(fullMessages);

  // 6. Create a transform stream to pass through SSE data and save conversation after
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let assistantContent = "";

  const transformStream = new TransformStream({
    transform(chunk, controller) {
      const text = decoder.decode(chunk, { stream: true });
      // Extract content from SSE data lines
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            // Append sources metadata
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ sources })}\n\n`
              )
            );
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`)
              );
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    },
    async flush() {
      // Save conversation to DB
      if (assistantContent && conversationId) {
        const allMessages = [
          ...messages,
          { role: "assistant" as const, content: assistantContent, sources },
        ];
        await supabase
          .from("knowledge_conversations")
          .update({
            messages: allMessages,
            title:
              messages.length === 1
                ? userMessage.slice(0, 100)
                : undefined,
          })
          .eq("id", conversationId);
      }
    },
  });

  stream.pipeThrough(transformStream);

  return new Response(transformStream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
