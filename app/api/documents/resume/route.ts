import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Reset stalled "processing" documents back to "pending" so the queue picks them up again.
// Called on page load to recover from interrupted crawls / closed browser tabs.
export async function POST(request: NextRequest) {
  const { projectId } = await request.json().catch(() => ({}));
  const supabase = createAdminClient();

  // First count how many are stalled
  let countQuery = supabase
    .from("knowledge_documents")
    .select("id", { count: "exact", head: true })
    .eq("status", "processing");

  if (projectId) {
    countQuery = countQuery.eq("project_id", projectId);
  }

  const { count } = await countQuery;

  if (count && count > 0) {
    // Reset them back to pending
    let updateQuery = supabase
      .from("knowledge_documents")
      .update({ status: "pending" })
      .eq("status", "processing");

    if (projectId) {
      updateQuery = updateQuery.eq("project_id", projectId);
    }

    const { error } = await updateQuery;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ resumed: count || 0 });
}
