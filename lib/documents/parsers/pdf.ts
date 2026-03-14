// Import the internal module directly to avoid pdf-parse's dynamic require
// which breaks on Vercel's bundler
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

const MIN_TEXT_LENGTH = 50; // Below this, consider the PDF image-based

export async function parsePdf(buffer: Buffer): Promise<{ text: string; metadata: Record<string, unknown> }> {
  const data = await pdfParse(buffer);
  const extractedText = (data.text || "").trim();

  // If text extraction found meaningful content, use it
  if (extractedText.length >= MIN_TEXT_LENGTH) {
    return {
      text: extractedText,
      metadata: {
        pages: data.numpages,
        info: data.info,
      },
    };
  }

  // Fall back to vision AI for image-heavy / scanned PDFs
  const visionText = await parsePdfWithVision(buffer);

  return {
    text: visionText || extractedText,
    metadata: {
      pages: data.numpages,
      info: data.info,
      extractionMethod: visionText ? "vision-ai" : "text-layer",
    },
  };
}

async function parsePdfWithVision(buffer: Buffer): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return "";

  const base64 = buffer.toString("base64");
  const dataUrl = `data:application/pdf;base64,${base64}`;

  // Limit to 20MB for the API call
  if (buffer.length > 20 * 1024 * 1024) return "";

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
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
                text: "Extract ALL text and information from this PDF document. If it contains drawings, diagrams, floor plans, schematics, or architectural documents, describe them thoroughly including all labels, dimensions, annotations, room names, and any visible text. Return only the extracted content with no preamble.",
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

    if (!response.ok) return "";

    const result = await response.json();
    return result.choices?.[0]?.message?.content || "";
  } catch {
    return "";
  }
}
