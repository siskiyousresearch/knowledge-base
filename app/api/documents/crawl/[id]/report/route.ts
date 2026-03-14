import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: job, error } = await supabase
    .from("knowledge_crawl_jobs")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: "Crawl job not found" }, { status: 404 });
  }

  const errors = (job.deleted_urls || []) as Array<{ url: string; reason: string; found_on?: string }>;

  if (errors.length === 0) {
    return NextResponse.json({ error: "No errors recorded for this crawl" }, { status: 404 });
  }

  // Categorize errors
  const categories: Record<string, Array<{ url: string; reason: string; found_on?: string }>> = {};
  for (const entry of errors) {
    let category = "Other";
    if (entry.reason.includes("404")) {
      category = "404 Not Found";
    } else if (entry.reason.includes("403")) {
      category = "403 Forbidden";
    } else if (entry.reason.includes("500") || entry.reason.includes("502") || entry.reason.includes("503")) {
      category = "Server Error (5xx)";
    } else if (entry.reason.includes("timeout") || entry.reason.includes("Timeout")) {
      category = "Timeout";
    } else if (entry.reason.includes("call stack") || entry.reason.includes("Maximum call stack")) {
      category = "Maximum Call Stack Exceeded (page too complex)";
    } else if (entry.reason.includes("No text content")) {
      category = "No Text Content Extracted";
    } else if (entry.reason.includes("HEAD returned 404")) {
      category = "404 Not Found (pre-check)";
    }
    if (!categories[category]) categories[category] = [];
    categories[category].push(entry);
  }

  const hostname = new URL(job.root_url).hostname;
  const lines = [
    `Crawl Error Report`,
    `==================`,
    `Site: ${job.root_url}`,
    `Date: ${new Date(job.created_at).toLocaleDateString()}`,
    `Pages successfully crawled: ${job.pages_completed}`,
    `Total errors: ${errors.length}`,
    ``,
    `ERROR SUMMARY`,
    `-------------`,
    ...Object.entries(categories).map(
      ([cat, entries]) => `  ${cat}: ${entries.length}`
    ),
    ``,
  ];

  // Detail section for each category
  for (const [category, entries] of Object.entries(categories)) {
    lines.push(`${category} (${entries.length})`, "-".repeat(category.length + String(entries.length).length + 3));
    for (const entry of entries) {
      lines.push(`  Broken URL:  ${entry.url}`);
      if (entry.found_on) {
        lines.push(`  Found on:    ${entry.found_on}`);
      }
      if (!entry.reason.includes(category.split(" ")[0])) {
        lines.push(`  Error:       ${entry.reason}`);
      }
      lines.push("");
    }
  }

  lines.push(`--- End of Report ---`);

  const text = lines.join("\n");
  const filename = `crawl-error-report-${hostname}-${new Date().toISOString().split("T")[0]}.txt`;

  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
