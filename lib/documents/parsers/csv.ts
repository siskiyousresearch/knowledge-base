import Papa from "papaparse";

export async function parseCsv(buffer: Buffer): Promise<{ text: string; metadata: Record<string, unknown> }> {
  const csvString = buffer.toString("utf-8");
  const result = Papa.parse<Record<string, string>>(csvString, {
    header: true,
    skipEmptyLines: true,
  });

  const lines = result.data.map((row) =>
    Object.entries(row)
      .filter(([, v]) => v !== "")
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ")
  );

  return {
    text: lines.join("\n"),
    metadata: {
      rowCount: result.data.length,
      fields: result.meta.fields,
    },
  };
}
