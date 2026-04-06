import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { ContactService } from "@outreachos/services";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB max upload size

export async function POST(request: NextRequest) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size to prevent DoS
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 413 }
      );
    }

    // Validate file type - only CSV is supported for preview
    const allowedTypes = ["text/csv"];
    const fileExtension = file.name.toLowerCase().split(".").pop();
    const isValidType = allowedTypes.includes(file.type) || fileExtension === "csv";

    if (!isValidType) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a CSV file." },
        { status: 400 }
      );
    }

    // Read file content
    let content: string;
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      content = buffer.toString("utf-8");
    } catch (err) {
      return NextResponse.json(
        { error: "Failed to read file content" },
        { status: 400 }
      );
    }

    // Generate preview
    const preview = ContactService.previewCSV(content);

    return NextResponse.json({
      preview,
      fileName: file.name,
      fileSize: file.size,
    });
  } catch (err) {
    console.error("CSV preview error:", {
      name: err instanceof Error ? err.name : "Unknown",
      message: err instanceof Error ? err.message : "Failed to preview CSV",
    });
    return NextResponse.json(
      { error: "Internal server error while previewing CSV" },
      { status: 500 }
    );
  }
}
