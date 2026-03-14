import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTemplate } from "@/lib/templates";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("knowledge_projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const supabase = createAdminClient();

  // Fetch current project to detect template change
  let oldTemplate: string | null = null;
  if (body.template !== undefined) {
    const { data: current } = await supabase
      .from("knowledge_projects")
      .select("template")
      .eq("id", id)
      .single();
    oldTemplate = current?.template || "general";
  }

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title.trim();
  if (body.description !== undefined) updates.description = body.description?.trim() || null;
  if (body.model_id !== undefined) updates.model_id = body.model_id || null;
  if (body.template !== undefined) updates.template = body.template;

  const { data, error } = await supabase
    .from("knowledge_projects")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Trigger auto-scrape if switching to a new template that has it
  if (body.template && body.template !== oldTemplate) {
    const template = getTemplate(body.template);
    if (template.autoScrape.length > 0) {
      const baseUrl = request.nextUrl.origin;
      Promise.allSettled(
        template.autoScrape.map((scrape) =>
          fetch(`${baseUrl}/api/documents/crawl`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: scrape.url,
              maxDepth: scrape.maxDepth,
              ...(scrape.maxPages ? { maxPages: scrape.maxPages } : {}),
              projectId: id,
            }),
          })
        )
      ).catch(() => {});
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  // Delete storage files for all project documents
  const { data: docs } = await supabase
    .from("knowledge_documents")
    .select("id, file_name")
    .eq("project_id", id);

  if (docs?.length) {
    const paths = docs.map((d) => `uploads/${d.id}/${d.file_name}`).filter(Boolean);
    if (paths.length > 0) {
      await supabase.storage.from("documents").remove(paths);
    }
  }

  // Cascade delete handles documents, chunks, and conversations
  const { error } = await supabase
    .from("knowledge_projects")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
