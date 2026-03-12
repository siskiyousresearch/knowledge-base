import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFileExtension } from "@/lib/utils";
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
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `FormData parse error: ${msg}` }, { status: 400 });
    }

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

    let supabase;
    try {
      supabase = createAdminClient();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `Supabase client error: ${msg}` }, { status: 500 });
    }

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
      return NextResponse.json({ error: `DB insert error: ${error.message}` }, { status: 500 });
    }

    // Store file content as base64 in metadata for processing
    let buffer: Buffer;
    try {
      buffer = Buffer.from(await file.arrayBuffer());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `File read error: ${msg}` }, { status: 500 });
    }

    const { error: updateError } = await supabase
      .from("knowledge_documents")
      .update({ metadata: { fileContent: buffer.toString("base64") } })
      .eq("id", data.id);

    if (updateError) {
      return NextResponse.json({ error: `DB update (base64) error: ${updateError.message}` }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    return NextResponse.json({ error: `POST /api/documents failed: ${message}` }, { status: 500 });
  }
}
