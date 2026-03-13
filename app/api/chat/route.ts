import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { chatCompletionStream } from "@/lib/ai/openrouter";
import { SIMILARITY_THRESHOLD, MAX_CONTEXT_CHUNKS } from "@/lib/constants";
import { DEFAULT_MODEL_ID } from "@/lib/ai/models";
import { ChatMessage, ChunkSearchResult } from "@/lib/types";
import { checkBudget } from "@/lib/ai/usage";
import { logUsage } from "@/lib/ai/usage";

export async function POST(request: NextRequest) {
  const { messages, conversationId, projectId } = (await request.json()) as {
    messages: ChatMessage[];
    conversationId?: string;
    projectId?: string;
  };

  if (!messages?.length) {
    return new Response(JSON.stringify({ error: "Messages required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check daily budget
  const budget = await checkBudget();
  if (!budget.allowed) {
    return new Response(
      JSON.stringify({
        error: `Daily budget exceeded. Today's spend: $${budget.todaySpend.toFixed(4)} / $${budget.dailyBudget?.toFixed(2)} limit.`,
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createAdminClient();
  const userMessage = messages[messages.length - 1].content;

  // 1. Embed user query
  const queryEmbedding = await generateEmbedding(userMessage);

  // 2. Vector similarity search (project-scoped if projectId provided)
  const rpcName = projectId ? "knowledge_match_chunks_by_project" : "knowledge_match_chunks";
  const rpcParams: Record<string, unknown> = {
    query_embedding: JSON.stringify(queryEmbedding),
    match_threshold: SIMILARITY_THRESHOLD,
    match_count: MAX_CONTEXT_CHUNKS,
  };
  if (projectId) {
    rpcParams.p_project_id = projectId;
  }

  const { data: chunks, error: searchError } = await supabase.rpc(rpcName, rpcParams);

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
    content: `You are a knowledge base assistant. You must ONLY answer using the provided context from the knowledge base documents below. Do NOT use any outside knowledge, training data, or general information.

If the context contains relevant information, answer the question and cite which source(s) you're drawing from.
If the context does NOT contain relevant information, respond with: "I don't have information about that in the knowledge base." Do not guess, speculate, or supplement with outside knowledge.

## Context from Knowledge Base:
${contextBlock}`,
  };

  // 5. Resolve model: project model > default
  let modelId = DEFAULT_MODEL_ID;
  if (projectId) {
    const { data: proj } = await supabase
      .from("knowledge_projects")
      .select("model_id")
      .eq("id", projectId)
      .single();
    if (proj?.model_id) modelId = proj.model_id;
  }

  const fullMessages = [systemMessage, ...messages];
  const stream = await chatCompletionStream(fullMessages, { model: modelId });

  // 6. Create a transform stream to pass through SSE data and save conversation after
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let assistantContent = "";
  let usageData: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null = null;

  const transformStream = new TransformStream({
    transform(chunk, controller) {
      const text = decoder.decode(chunk, { stream: true });
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
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
            // Capture usage data from the final chunk
            if (parsed.usage) {
              usageData = parsed.usage;
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    },
    async flush() {
      // Log usage
      try {
        const promptTokens = usageData?.prompt_tokens || Math.ceil(JSON.stringify(fullMessages).length / 4);
        const completionTokens = usageData?.completion_tokens || Math.ceil(assistantContent.length / 4);

        await logUsage({
          conversationId: conversationId || undefined,
          model: modelId,
          promptTokens,
          completionTokens,
        });
      } catch {
        // Don't fail the response if usage logging fails
      }

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
