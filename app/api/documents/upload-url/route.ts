import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const { documentId, fileName } = await request.json();

    if (!documentId || !fileName) {
      return NextResponse.json({ error: "documentId and fileName required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const storagePath = `uploads/${documentId}/${fileName}`;

    // Create a signed upload URL (valid for 10 minutes)
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUploadUrl(storagePath);

    if (error) {
      return NextResponse.json({ error: `Signed URL error: ${error.message}` }, { status: 500 });
    }

    // Save storage path to document metadata
    await supabase
      .from("knowledge_documents")
      .update({ metadata: { storagePath } })
      .eq("id", documentId);

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      storagePath,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Upload URL error: ${message}` }, { status: 500 });
  }
}
