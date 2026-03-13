import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("knowledge_crawl_jobs")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  // Cancel the crawl job
  await supabase
    .from("knowledge_crawl_jobs")
    .update({ status: "cancelled" })
    .eq("id", id);

  // Delete any pending documents for this crawl
  await supabase
    .from("knowledge_documents")
    .delete()
    .eq("crawl_job_id", id)
    .eq("status", "pending");

  return NextResponse.json({ success: true });
}
