import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");
  const supabase = createAdminClient();

  let query = supabase
    .from("knowledge_conversations")
    .select("id, title, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("knowledge_conversations")
    .insert({
      title: body.title || "New Conversation",
      messages: [],
      project_id: body.projectId || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
