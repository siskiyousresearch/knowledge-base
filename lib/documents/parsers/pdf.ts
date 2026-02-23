import pdfParse from "pdf-parse";

export async function parsePdf(buffer: Buffer): Promise<{ text: string; metadata: Record<string, unknown> }> {
  const data = await pdfParse(buffer);
  return {
    text: data.text,
    metadata: {
      pages: data.numpages,
      info: data.info,
    },
  };
}
