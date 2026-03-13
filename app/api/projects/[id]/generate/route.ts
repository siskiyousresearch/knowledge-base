import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chatCompletionStream } from "@/lib/ai/openrouter";
import { DEFAULT_MODEL_ID } from "@/lib/ai/models";
import { ChatMessage } from "@/lib/types";

const TYPE_PROMPTS: Record<string, string> = {
  summary: "Create a structured summary with key points organized by topic",
  faq: "Generate a FAQ with 10-15 questions and answers",
  study_guide:
    "Create a study guide with key concepts, definitions, and review questions",
  briefing:
    "Create an executive briefing with key findings and recommendations",
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { type } = await request.json();

  if (!type || !TYPE_PROMPTS[type]) {
    return NextResponse.json(
      { error: "Invalid type. Must be one of: summary, faq, study_guide, briefing" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Fetch all completed document chunks for project (limit 50)
  const { data: documents } = await supabase
    .from("knowledge_documents")
    .select("id")
    .eq("project_id", id)
    .eq("status", "completed");

  if (!documents?.length) {
    return NextResponse.json({ error: "No completed documents found" }, { status: 404 });
  }

  const docIds = documents.map((d: { id: string }) => d.id);

  const { data: chunks, error: chunksError } = await supabase
    .from("knowledge_document_chunks")
    .select("content")
    .in("document_id", docIds)
    .order("chunk_index", { ascending: true })
    .limit(50);

  if (chunksError) {
    return NextResponse.json({ error: chunksError.message }, { status: 500 });
  }

  if (!chunks?.length) {
    return NextResponse.json({ error: "No document chunks found" }, { status: 404 });
  }

  // Resolve model: project model > default
  let modelId = DEFAULT_MODEL_ID;
  const { data: project } = await supabase
    .from("knowledge_projects")
    .select("model_id")
    .eq("id", id)
    .single();
  if (project?.model_id) modelId = project.model_id;

  const contextText = chunks.map((c: { content: string }) => c.content).join("\n\n");

  const messages: ChatMessage[] = [
    {
      role: "user",
      content: `Based on the following document content, ${TYPE_PROMPTS[type]}.\n\n${contextText}`,
    },
  ];

  try {
    const stream = await chatCompletionStream(messages, {
      model: modelId,
      maxTokens: 4096,
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let fullContent = "";

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = decoder.decode(chunk, { stream: true });
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                fullContent += delta;
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
        // Save to knowledge_artifacts table
        if (fullContent) {
          try {
            await supabase.from("knowledge_artifacts").insert({
              project_id: id,
              type,
              content: fullContent,
            });
          } catch {
            // Don't fail the response if artifact save fails
          }
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
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate content" },
      { status: 500 }
    );
  }
}
