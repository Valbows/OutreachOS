import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { ContactService } from "@outreachos/services";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export async function POST(request: NextRequest) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 25MB limit" },
        { status: 400 },
      );
    }

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".csv") && !fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
      return NextResponse.json(
        { error: "Invalid file type. Supported formats: .csv, .xlsx, .xls" },
        { status: 400 },
      );
    }

    let rows;
    let warning: string | undefined;

    if (fileName.endsWith(".csv")) {
      const text = await file.text();
      try {
        rows = ContactService.parseCSV(text);
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "Failed to parse CSV" },
          { status: 400 },
        );
      }
    } else {
      // Excel files — dynamic import xlsx only when needed
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return NextResponse.json(
          { error: "Excel file contains no sheets" },
          { status: 400 },
        );
      }
      // Track if multiple sheets exist to warn caller
      const hasMultipleSheets = workbook.SheetNames.length > 1;
      if (hasMultipleSheets) {
        warning = `Excel file has ${workbook.SheetNames.length} sheets; only the first sheet (${sheetName}) was processed.`;
      }
      const csvContent = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
      try {
        rows = ContactService.parseCSV(csvContent);
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "Failed to parse Excel file" },
          { status: 400 },
        );
      }
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "File contains no data rows" },
        { status: 400 },
      );
    }

    const result = await ContactService.bulkCreate(account.id, rows);

    return NextResponse.json({
      count: result.count,
      errors: result.errors.map((e: { row: number; message: string }) => ({ row: e.row, message: e.message })),
      ...(warning && { warning }),
    });
  } catch (err) {
    console.error("Upload error:", {
      name: err instanceof Error ? err.name : "Unknown",
      message: err instanceof Error ? err.message : "Upload failed",
      stack: err instanceof Error ? err.stack : String(err),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
