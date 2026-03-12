import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupportedExtension } from "@/lib/documents";
import { MAX_FILE_SIZE } from "@/lib/constants";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("knowledge_documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: `DB fetch error: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `GET /api/documents failed: ${message}` }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { fileName, fileType, fileSize } = await request.json();

    if (!fileName || !fileType) {
      return NextResponse.json({ error: "fileName and fileType are required" }, { status: 400 });
    }

    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds 50MB limit" }, { status: 400 });
    }

    if (!isSupportedExtension(fileType)) {
      return NextResponse.json({ error: `Unsupported file type: ${fileType}` }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("knowledge_documents")
      .insert({
        title: fileName.replace(/\.[^.]+$/, ""),
        source: "upload",
        status: "pending",
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: `DB insert error: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `POST /api/documents failed: ${message}` }, { status: 500 });
  }
}
