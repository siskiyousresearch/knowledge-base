import { parsePdf } from "./parsers/pdf";
import { parseDocx } from "./parsers/docx";
import { parseXlsx } from "./parsers/xlsx";
import { parseCsv } from "./parsers/csv";
import { parsePptx } from "./parsers/pptx";
import { parseMarkdown } from "./parsers/markdown";

const PARSER_MAP: Record<string, (buffer: Buffer) => Promise<{ text: string; metadata: Record<string, unknown> }>> = {
  ".pdf": parsePdf,
  ".docx": parseDocx,
  ".xlsx": parseXlsx,
  ".xls": parseXlsx,
  ".csv": parseCsv,
  ".pptx": parsePptx,
  ".txt": parseMarkdown,
  ".md": parseMarkdown,
};

export async function parseDocument(
  buffer: Buffer,
  extension: string
): Promise<{ text: string; metadata: Record<string, unknown> }> {
  const parser = PARSER_MAP[extension.toLowerCase()];
  if (!parser) {
    throw new Error(`Unsupported file type: ${extension}`);
  }
  return parser(buffer);
}

export function isSupportedExtension(extension: string): boolean {
  return extension.toLowerCase() in PARSER_MAP;
}
