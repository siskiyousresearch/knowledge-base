export async function parseImage(buffer: Buffer, extension: string): Promise<{ text: string; metadata: Record<string, unknown> }> {
  const mimeMap: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
    ".svg": "image/svg+xml",
  };

  const mimeType = mimeMap[extension.toLowerCase()] || "image/png";
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "X-Title": "Knowledge Base RAG",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-001",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract ALL text content from this image. If it contains a document, form, chart, or diagram, describe it thoroughly including all visible text, labels, numbers, and data. If it's a photo or illustration, describe it in detail. Return only the extracted/described content with no preamble.",
            },
            {
              type: "image_url",
              image_url: { url: dataUrl },
            },
          ],
        },
      ],
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vision API error: ${response.status} — ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";

  if (!text.trim()) {
    throw new Error("No text could be extracted from the image");
  }

  return {
    text,
    metadata: {
      type: "image",
      mimeType,
      extractionMethod: "vision-ai",
    },
  };
}
