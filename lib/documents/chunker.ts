import { CHUNK_SIZE, CHUNK_OVERLAP } from "@/lib/constants";

interface Chunk {
  content: string;
  index: number;
  metadata: {
    charStart: number;
    charEnd: number;
  };
}

const SEPARATORS = ["\n\n", "\n", ". ", " "];

function splitText(text: string, separator: string): string[] {
  return text.split(separator).filter((s) => s.trim().length > 0);
}

function recursiveSplit(
  text: string,
  separatorIndex: number,
  chunkSize: number
): string[] {
  if (text.length <= chunkSize) return [text];

  const separator = SEPARATORS[separatorIndex];
  if (!separator) return [text]; // last resort: return as-is

  const parts = splitText(text, separator);
  const chunks: string[] = [];
  let current = "";

  for (const part of parts) {
    const candidate = current ? current + separator + part : part;
    if (candidate.length > chunkSize && current) {
      chunks.push(current);
      current = part;
    } else if (candidate.length > chunkSize && !current) {
      // Single part too large — try next separator
      chunks.push(...recursiveSplit(part, separatorIndex + 1, chunkSize));
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

export function chunkText(
  text: string,
  chunkSize: number = CHUNK_SIZE,
  overlap: number = CHUNK_OVERLAP
): Chunk[] {
  const rawChunks = recursiveSplit(text.trim(), 0, chunkSize);
  const chunks: Chunk[] = [];

  let charOffset = 0;
  for (let i = 0; i < rawChunks.length; i++) {
    const content = rawChunks[i].trim();
    if (!content) continue;

    const charStart = text.indexOf(content, charOffset);
    const charEnd = charStart + content.length;

    chunks.push({
      content,
      index: chunks.length,
      metadata: { charStart, charEnd },
    });

    // Move offset forward, accounting for overlap
    charOffset = Math.max(0, charEnd - overlap);
  }

  return chunks;
}

export function estimateTokenCount(text: string): number {
  // Rough estimate: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}
