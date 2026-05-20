import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createShareAccessRequest } from "@/lib/share-access-requests";
import { readShareLinks } from "@/lib/share-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: RouteContext<"/api/share/[token]/request-access">) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  const { token } = await ctx.params;
  const share = (await readShareLinks()).find((candidate) => candidate.token === token && !candidate.disabledAt);
  if (!share) {
    return NextResponse.json({ ok: false, message: "Share not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const message = typeof body?.message === "string" ? body.message.slice(0, 500) : "";
  const request = await createShareAccessRequest({ share, user, message });

  return NextResponse.json({ ok: true, request });
}
