import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chatCompletion } from "@/lib/ai/openrouter";
import { DEFAULT_MODEL_ID } from "@/lib/ai/models";
import { ChatMessage } from "@/lib/types";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  // Fetch first 5 completed document chunks for this project
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
    .limit(5);

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

  const excerpts = chunks.map((c: { content: string }) => c.content).join("\n\n---\n\n");

  const messages: ChatMessage[] = [
    {
      role: "user",
      content: `Given these document excerpts, generate exactly 4 concise starter questions. Return as JSON array of strings only.\n\n${excerpts}`,
    },
  ];

  try {
    const response = await chatCompletion(messages, { model: modelId });

    // Parse the JSON array from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse suggestions" }, { status: 500 });
    }

    const suggestions = JSON.parse(jsonMatch[0]);
    return NextResponse.json(suggestions);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
