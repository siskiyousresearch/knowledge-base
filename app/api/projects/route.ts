import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createAdminClient();

  const { data: projects, error } = await supabase
    .from("knowledge_projects")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get document counts per project
  const { data: counts } = await supabase
    .from("knowledge_documents")
    .select("project_id")
    .not("project_id", "is", null);

  const countMap: Record<string, number> = {};
  for (const row of counts || []) {
    if (row.project_id) {
      countMap[row.project_id] = (countMap[row.project_id] || 0) + 1;
    }
  }

  const enriched = (projects || []).map((p) => ({
    ...p,
    document_count: countMap[p.id] || 0,
  }));

  return NextResponse.json(enriched);
}

export async function POST(request: NextRequest) {
  const { title, description } = await request.json();

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("knowledge_projects")
    .insert({ title: title.trim(), description: description?.trim() || null })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
