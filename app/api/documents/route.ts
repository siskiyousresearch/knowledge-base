import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFileExtension } from "@/lib/utils";
import { isSupportedExtension } from "@/lib/documents";
import { MAX_FILE_SIZE } from "@/lib/constants";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File exceeds 50MB limit" }, { status: 400 });
  }

  const extension = getFileExtension(file.name);
  if (!isSupportedExtension(extension)) {
    return NextResponse.json({ error: `Unsupported file type: ${extension}` }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("knowledge_documents")
    .insert({
      title: file.name.replace(/\.[^.]+$/, ""),
      source: "upload",
      status: "pending",
      file_name: file.name,
      file_type: extension,
      file_size: file.size,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Store file content as base64 in metadata for processing
  const buffer = Buffer.from(await file.arrayBuffer());
  await supabase
    .from("knowledge_documents")
    .update({ metadata: { fileContent: buffer.toString("base64") } })
    .eq("id", data.id);

  return NextResponse.json(data, { status: 201 });
}
