import JSZip from "jszip";

export async function parsePptx(buffer: Buffer): Promise<{ text: string; metadata: Record<string, unknown> }> {
  const zip = await JSZip.loadAsync(buffer);
  const slideTexts: string[] = [];

  // Get slide files sorted by number
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] || "0");
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] || "0");
      return numA - numB;
    });

  for (const fileName of slideFiles) {
    const xml = await zip.files[fileName].async("text");
    // Extract text from <a:t> tags
    const textMatches = xml.match(/<a:t>([^<]*)<\/a:t>/g);
    if (textMatches) {
      const texts = textMatches.map((m) => m.replace(/<\/?a:t>/g, ""));
      const slideNum = fileName.match(/slide(\d+)/)?.[1];
      slideTexts.push(`--- Slide ${slideNum} ---\n${texts.join(" ")}`);
    }
  }

  return {
    text: slideTexts.join("\n\n"),
    metadata: {
      slideCount: slideFiles.length,
    },
  };
}
