export async function parseMarkdown(buffer: Buffer): Promise<{ text: string; metadata: Record<string, unknown> }> {
  return {
    text: buffer.toString("utf-8"),
    metadata: {},
  };
}
