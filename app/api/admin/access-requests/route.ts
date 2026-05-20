import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import {
  approveShareAccessRequest,
  readShareAccessRequests,
  updateShareAccessRequest,
  type ShareAccessRequestStatus,
} from "@/lib/share-access-requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidStatus(value: unknown): value is ShareAccessRequestStatus {
  return value === "PENDING" || value === "APPROVED" || value === "REJECTED";
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, message: "Admin access required." }, { status: 401 });
  return NextResponse.json({ ok: true, requests: await readShareAccessRequests() });
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, message: "Admin access required." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";
  const status = body?.status;

  if (!id || !isValidStatus(status)) {
    return NextResponse.json({ ok: false, message: "Valid id and status are required." }, { status: 400 });
  }

  if (status === "APPROVED") {
    const result = await approveShareAccessRequest(id);
    if (!result) return NextResponse.json({ ok: false, message: "Request not found." }, { status: 404 });
    return NextResponse.json({ ok: true, request: result.request, share: result.share });
  }

  const request = await updateShareAccessRequest(id, status);
  if (!request) return NextResponse.json({ ok: false, message: "Request not found." }, { status: 404 });
  return NextResponse.json({ ok: true, request });
}
