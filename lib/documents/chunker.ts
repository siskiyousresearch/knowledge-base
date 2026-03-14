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

function iterativeSplit(
  text: string,
  initialSeparatorIndex: number,
  chunkSize: number
): string[] {
  const result: string[] = [];
  const stack: { text: string; separatorIndex: number }[] = [
    { text, separatorIndex: initialSeparatorIndex },
  ];

  while (stack.length > 0) {
    const item = stack.pop()!;

    if (item.text.length <= chunkSize) {
      result.push(item.text);
      continue;
    }

    // All separators exhausted — force-split at chunkSize boundaries
    if (item.separatorIndex >= SEPARATORS.length) {
      for (let i = 0; i < item.text.length; i += chunkSize) {
        result.push(item.text.slice(i, i + chunkSize));
      }
      continue;
    }

    const separator = SEPARATORS[item.separatorIndex];
    const parts = splitText(item.text, separator);
    const merged: { text: string; separatorIndex: number }[] = [];
    let current = "";

    for (const part of parts) {
      const candidate = current ? current + separator + part : part;
      if (candidate.length > chunkSize && current) {
        // current fits — emit it directly if small enough, otherwise queue it
        if (current.length <= chunkSize) {
          result.push(current);
        } else {
          merged.push({ text: current, separatorIndex: item.separatorIndex + 1 });
        }
        current = part;
      } else if (candidate.length > chunkSize && !current) {
        // Single part too large — try next separator
        merged.push({ text: part, separatorIndex: item.separatorIndex + 1 });
      } else {
        current = candidate;
      }
    }

    if (current) {
      if (current.length <= chunkSize) {
        result.push(current);
      } else {
        merged.push({ text: current, separatorIndex: item.separatorIndex + 1 });
      }
    }

    // Push in reverse order so we process them left-to-right (stack is LIFO)
    for (let i = merged.length - 1; i >= 0; i--) {
      stack.push(merged[i]);
    }
  }

  return result;
}

export function chunkText(
  text: string,
  chunkSize: number = CHUNK_SIZE,
  overlap: number = CHUNK_OVERLAP
): Chunk[] {
  const rawChunks = iterativeSplit(text.trim(), 0, chunkSize);
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
