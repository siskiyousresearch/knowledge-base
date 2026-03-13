import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  const { shareId } = await params;
  const supabase = createAdminClient();

  // Find project by share_id
  const { data: project, error } = await supabase
    .from("knowledge_projects")
    .select("*")
    .eq("share_id", shareId)
    .eq("is_shared", true)
    .single();

  if (error || !project) {
    return NextResponse.json({ error: "Shared project not found" }, { status: 404 });
  }

  // Fetch documents
  const { data: documents } = await supabase
    .from("knowledge_documents")
    .select("id, title, file_type, file_size, chunk_count, status, created_at")
    .eq("project_id", project.id)
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  // Fetch artifacts
  const { data: artifacts } = await supabase
    .from("knowledge_artifacts")
    .select("*")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    project: {
      id: project.id,
      title: project.title,
      description: project.description,
      created_at: project.created_at,
    },
    documents: documents || [],
    artifacts: artifacts || [],
  });
}
