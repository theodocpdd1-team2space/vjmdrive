import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { revokeShareLink } from "@/lib/share-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/admin/shares/[token]">) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });

  const { token } = await ctx.params;
  const revoked = await revokeShareLink(token);
  return NextResponse.json({ ok: true, revoked });
}
