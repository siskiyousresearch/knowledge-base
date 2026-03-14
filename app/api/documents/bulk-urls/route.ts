import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const { urls, projectId } = await request.json();

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: "urls array required" }, { status: 400 });
    }

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Deduplicate input
    const uniqueUrls = [...new Set(urls.map((u: string) => u.trim()).filter((u: string) => u && u.startsWith("http")))];

    // Check which URLs already exist in this project
    const { data: existingDocs } = await supabase
      .from("knowledge_documents")
      .select("file_name")
      .eq("project_id", projectId)
      .eq("source", "url");

    const existingUrls = new Set(existingDocs?.map((d) => d.file_name) || []);
    const newUrls = uniqueUrls.filter((u: string) => !existingUrls.has(u));

    if (newUrls.length === 0) {
      return NextResponse.json({ queued: 0, skipped: uniqueUrls.length, message: "All URLs already exist in this project" });
    }

    const docsToInsert = newUrls.map((url: string) => ({
      title: url,
      source: "url",
      status: "pending",
      file_name: url,
      file_type: "url",
      project_id: projectId,
      metadata: { url },
    }));

    const { error: insertError } = await supabase
      .from("knowledge_documents")
      .insert(docsToInsert);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      queued: newUrls.length,
      skipped: uniqueUrls.length - newUrls.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
