import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: chunks, error } = await supabase
    .from("knowledge_document_chunks")
    .select("*")
    .eq("document_id", id)
    .order("chunk_index", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const content = (chunks || []).map((c: { content: string }) => c.content).join("\n\n");

  return NextResponse.json({ content, chunks: chunks || [] });
}
