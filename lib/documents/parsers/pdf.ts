// Import the internal module directly to avoid pdf-parse's dynamic require
// which breaks on Vercel's bundler
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

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
