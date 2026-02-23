import * as XLSX from "xlsx";

export async function parseXlsx(buffer: Buffer): Promise<{ text: string; metadata: Record<string, unknown> }> {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheets: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    sheets.push(`--- Sheet: ${sheetName} ---\n${csv}`);
  }

  return {
    text: sheets.join("\n\n"),
    metadata: {
      sheetCount: workbook.SheetNames.length,
      sheetNames: workbook.SheetNames,
    },
  };
}
