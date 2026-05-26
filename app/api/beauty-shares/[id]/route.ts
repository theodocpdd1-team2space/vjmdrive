import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { disableBeautyShare, getBeautyShareById, updateBeautyShare } from "@/lib/beauty-share-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireOwner(id: string) {
  const user = await getCurrentUser();
  if (!user) return { response: NextResponse.json({ ok: false, message: "Login required." }, { status: 401 }) };

  const share = await getBeautyShareById(id);
  if (!share) return { response: NextResponse.json({ ok: false, message: "Beauty Share not found." }, { status: 404 }) };
  if (share.ownerUserId !== user.id) {
    return { response: NextResponse.json({ ok: false, message: "Access denied." }, { status: 403 }) };
  }

  return { user, share };
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/beauty-shares/[id]">) {
  const { id } = await ctx.params;
  const owner = await requireOwner(id);
  if ("response" in owner) return owner.response;

  const body = await req.json().catch(() => ({}));
  const patch = {
    title: typeof body?.title === "string" && body.title.trim() ? body.title.trim() : undefined,
    subtitle: typeof body?.subtitle === "string" ? body.subtitle.trim() : undefined,
    clientName: typeof body?.clientName === "string" ? body.clientName.trim() : undefined,
    theme: body?.theme === "dark" || body?.theme === "light" ? body.theme : undefined,
    layout: body?.layout === "collage" || body?.layout === "grid" || body?.layout === "magazine" ? body.layout : undefined,
    isActive: typeof body?.isActive === "boolean" ? body.isActive : undefined,
  };

  const updated = await updateBeautyShare(id, patch);
  return NextResponse.json({ ok: true, share: updated, publicUrl: updated ? `/b/${updated.slug}` : null });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/beauty-shares/[id]">) {
  const { id } = await ctx.params;
  const owner = await requireOwner(id);
  if ("response" in owner) return owner.response;

  const updated = await disableBeautyShare(id);
  return NextResponse.json({ ok: true, share: updated, publicUrl: updated ? `/b/${updated.slug}` : null });
}
