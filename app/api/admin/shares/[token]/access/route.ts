import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { normalizeShareVisibility, updateShareLink } from "@/lib/share-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidVisibility(value: unknown) {
  return value === "PUBLIC" || value === "PUBLIC_LOGIN" || value === "PRIVATE" || value === "PRIVATE_EMAILS";
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/shares/[token]/access">) {
  if (!(await isAdmin())) {
    return NextResponse.json(
      {
        ok: false,
        message: "Admin access required.",
      },
      { status: 401 }
    );
  }

  const { token } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const rawVisibility = body?.visibility ?? body?.accessMode;

  if (!isValidVisibility(rawVisibility)) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid share visibility.",
      },
      { status: 400 }
    );
  }

  const visibility = normalizeShareVisibility(rawVisibility);

  const link = await updateShareLink(token, {
    visibility,
    accessMode: visibility,
  });

  if (!link) {
    return NextResponse.json(
      {
        ok: false,
        message: "Share not found.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    link,
  });
}

export async function POST(req: Request, ctx: RouteContext<"/api/admin/shares/[token]/access">) {
  return PATCH(req, ctx);
}
