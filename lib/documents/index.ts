import { parsePdf } from "./parsers/pdf";
import { parseDocx } from "./parsers/docx";
import { parseXlsx } from "./parsers/xlsx";
import { parseCsv } from "./parsers/csv";
import { parsePptx } from "./parsers/pptx";
import { parseMarkdown } from "./parsers/markdown";
import { parseImage } from "./parsers/image";

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tiff", ".tif", ".svg"];

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
  const ext = extension.toLowerCase();

  if (IMAGE_EXTENSIONS.includes(ext)) {
    return parseImage(buffer, ext);
  }

  const parser = PARSER_MAP[ext];
  if (!parser) {
    throw new Error(`Unsupported file type: ${extension}`);
  }
  return parser(buffer);
}

export function isSupportedExtension(extension: string): boolean {
  const ext = extension.toLowerCase();
  return ext in PARSER_MAP || IMAGE_EXTENSIONS.includes(ext);
}
