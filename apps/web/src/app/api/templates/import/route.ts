import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { TemplateService } from "@outreachos/services";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "text/plain",
  "text/markdown",
  "text/html",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export async function POST(request: NextRequest) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = formData.get("name") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ error: "Template name is required" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }

    // Validate MIME type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${file.type}. Allowed types: ${ALLOWED_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Handle .docx files
    if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.name.endsWith(".docx")) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const template = await TemplateService.importFromDocx(account.id, name, buffer);
      return NextResponse.json({ data: template }, { status: 201 });
    }

    // Handle text-based files
    const content = await file.text();
    let format: "text" | "markdown" | "html" = "text";

    if (file.type === "text/html" || file.name.endsWith(".html")) {
      format = "html";
    } else if (file.type === "text/markdown" || file.name.endsWith(".md")) {
      format = "markdown";
    }

    const template = await TemplateService.importFromText(
      account.id,
      name,
      content,
      format,
    );

    return NextResponse.json({ data: template }, { status: 201 });
  } catch (error) {
    console.error("Template import error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
