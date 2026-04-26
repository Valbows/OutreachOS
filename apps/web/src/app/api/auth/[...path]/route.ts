import { getAuth } from "@/lib/auth/server";
import type { NextRequest } from "next/server";

// Lazy: handler() is only called on first request, not at module evaluation time.
let _handler: ReturnType<ReturnType<typeof getAuth>["handler"]> | null = null;
function handler() {
  if (!_handler) _handler = getAuth().handler();
  return _handler;
}

// Catch-all auth handler — ctx shape is internal to Better-Auth, not user-facing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function GET(req: NextRequest, ctx: any) {
  return handler().GET(req, ctx);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function POST(req: NextRequest, ctx: any) {
  return handler().POST(req, ctx);
}
