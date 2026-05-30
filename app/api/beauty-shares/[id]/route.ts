import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  deleteBeautyShare,
  getBeautyShareById,
  normalizeBeautyShareCustomText,
  updateBeautyShare,
  type BeautyShare,
} from "@/lib/beauty-share-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireOwner(id: string) {
  const user = await getCurrentUser();
  if (!user) return { response: NextResponse.json({ ok: false, message: "Login required." }, { status: 401 }) };

  const share = await getBeautyShareById(id);
  if (!share) return { response: NextResponse.json({ ok: false, message: "Beauty Share not found." }, { status: 404 }) };
  if (share.ownerUserId !== user.id && user.role !== "ADMIN") {
    return { response: NextResponse.json({ ok: false, message: "Access denied." }, { status: 403 }) };
  }

  return { user, share };
}

function cleanText(value: unknown, limit: number) {
  if (typeof value !== "string") return undefined;
  return value.replace(/\s+/g, " ").trim().slice(0, limit);
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/beauty-shares/[id]">) {
  const { id } = await ctx.params;
  const owner = await requireOwner(id);
  if ("response" in owner) return owner.response;

  const body = await req.json().catch(() => ({}));
  const patch: Partial<Pick<BeautyShare, "title" | "subtitle" | "clientName" | "theme" | "layout" | "isActive" | "customText">> = {};

  if (typeof body?.title === "string") {
    const title = cleanText(body.title, 160);
    if (!title) return NextResponse.json({ ok: false, message: "Title is required." }, { status: 400 });
    patch.title = title;
  }

  if (typeof body?.subtitle === "string") patch.subtitle = cleanText(body.subtitle, 260) || "";
  if (typeof body?.clientName === "string") patch.clientName = cleanText(body.clientName, 160) || "";
  if (body?.theme === "dark" || body?.theme === "light" || body?.theme === "cream") patch.theme = body.theme;
  if (body?.layout === "clean" || body?.layout === "collage" || body?.layout === "grid" || body?.layout === "magazine") patch.layout = body.layout;
  if (typeof body?.isActive === "boolean") patch.isActive = body.isActive;
  if (body && typeof body === "object" && "customText" in body) {
    patch.customText = normalizeBeautyShareCustomText(body.customText);
  }

  const updated = await updateBeautyShare(id, patch);
  return NextResponse.json({ ok: true, share: updated, publicUrl: updated ? `/b/${updated.slug}` : null });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/beauty-shares/[id]">) {
  const { id } = await ctx.params;
  const owner = await requireOwner(id);
  if ("response" in owner) return owner.response;

  const deleted = await deleteBeautyShare(id);
  return NextResponse.json({ ok: true, deleted });
}
