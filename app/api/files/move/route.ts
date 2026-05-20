import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { findUserById, getCurrentUser } from "@/lib/auth";
import { moveItems } from "@/lib/file-ops";
import { moveUserItems } from "@/lib/user-files";
import { getCacheRoot } from "@/lib/preview-cache";
import { normalizeDrivePath } from "@/lib/safe-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

type MetadataUpdateSummary = {
  updatedShares: number;
  updatedPreviewQueue: number;
  updatedPreviewJobs: number;
};

function normalizeRel(value: string) {
  return normalizeDrivePath(value || "");
}

function joinRel(parent: string, name: string) {
  return normalizeRel(path.posix.join(normalizeRel(parent), name));
}

function isSameOrChildPath(candidate: string, oldPath: string) {
  const safeCandidate = normalizeRel(candidate);
  const safeOldPath = normalizeRel(oldPath);

  return safeCandidate === safeOldPath || safeCandidate.startsWith(`${safeOldPath}/`);
}

function remapRelativePath(candidate: unknown, oldPath: string, newPath: string) {
  if (typeof candidate !== "string") return candidate;

  const safeCandidate = normalizeRel(candidate);
  const safeOldPath = normalizeRel(oldPath);
  const safeNewPath = normalizeRel(newPath);

  if (!isSameOrChildPath(safeCandidate, safeOldPath)) {
    return candidate;
  }

  if (safeCandidate === safeOldPath) {
    return safeNewPath;
  }

  return normalizeRel(`${safeNewPath}/${safeCandidate.slice(safeOldPath.length + 1)}`);
}

async function readJsonArray(filePath: string) {
  const raw = await fs.readFile(filePath, "utf8").catch(() => "[]");

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as JsonRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeJsonArray(filePath: string, data: JsonRecord[]) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function updateSharesPath(oldPath: string, newPath: string) {
  const filePath = path.join(getCacheRoot(), "db", "shares.json");
  const shares = await readJsonArray(filePath);

  let changed = 0;

  const next = shares.map((share) => {
    const currentRootPath = typeof share.rootPath === "string" ? share.rootPath : "";
    const updatedRootPath = remapRelativePath(currentRootPath, oldPath, newPath);

    if (updatedRootPath !== currentRootPath) {
      changed++;
      return {
        ...share,
        rootPath: updatedRootPath,
        updatedAt: new Date().toISOString(),
      };
    }

    return share;
  });

  if (changed > 0) {
    await writeJsonArray(filePath, next);
  }

  return changed;
}

async function updatePreviewMetadataFile(fileName: "preview-queue.json" | "preview-jobs.json", oldPath: string, newPath: string) {
  const filePath = path.join(getCacheRoot(), "db", fileName);
  const jobs = await readJsonArray(filePath);

  let changed = 0;

  const pathFields = [
    "path",
    "filePath",
    "relativePath",
    "inputPath",
    "sourcePath",
    "rootPath",
  ];

  const next = jobs.map((job) => {
    let touched = false;
    const updated: JsonRecord = { ...job };

    for (const field of pathFields) {
      const currentValue = updated[field];

      if (typeof currentValue !== "string") continue;

      const remappedValue = remapRelativePath(currentValue, oldPath, newPath);

      if (remappedValue !== currentValue) {
        updated[field] = remappedValue;
        touched = true;
      }
    }

    if (touched) {
      changed++;
      updated.updatedAt = new Date().toISOString();
    }

    return updated;
  });

  if (changed > 0) {
    await writeJsonArray(filePath, next);
  }

  return changed;
}

async function updateMoveRelatedMetadata(moves: Array<{ oldPath: string; newPath: string }>) {
  const summary: MetadataUpdateSummary = {
    updatedShares: 0,
    updatedPreviewQueue: 0,
    updatedPreviewJobs: 0,
  };

  for (const move of moves) {
    summary.updatedShares += await updateSharesPath(move.oldPath, move.newPath);
    summary.updatedPreviewQueue += await updatePreviewMetadataFile("preview-queue.json", move.oldPath, move.newPath);
    summary.updatedPreviewJobs += await updatePreviewMetadataFile("preview-jobs.json", move.oldPath, move.newPath);
  }

  return summary;
}

function buildMovePlan(items: string[], targetFolder: string) {
  const safeTargetFolder = normalizeRel(targetFolder);

  return items.map((item) => {
    const oldPath = normalizeRel(item);
    const baseName = path.posix.basename(oldPath);
    const newPath = joinRel(safeTargetFolder, baseName);

    return {
      oldPath,
      newPath,
    };
  });
}

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();

  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        message: "Login required.",
      },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);

  const items = Array.isArray(body?.items)
    ? body.items
        .filter((item: unknown) => typeof item === "string")
        .map((item: string) => normalizeRel(item))
        .filter(Boolean)
    : [];

  const targetFolder = typeof body?.targetFolder === "string" ? normalizeRel(body.targetFolder) : "";

  if (items.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        message: "No items selected.",
      },
      { status: 400 }
    );
  }

  try {
    if (session.role === "ADMIN") {
      const movePlan = buildMovePlan(items, targetFolder);
      const moved = await moveItems(items, targetFolder);
      const metadata = await updateMoveRelatedMetadata(movePlan);

      return NextResponse.json({
        ok: true,
        moved,
        metadata,
      });
    }

    const user = await findUserById(session.id);

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          message: "User not found.",
        },
        { status: 401 }
      );
    }

    const moved = await moveUserItems(user, items, targetFolder);

    return NextResponse.json({
      ok: true,
      moved,
      metadata: {
        updatedShares: 0,
        updatedPreviewQueue: 0,
        updatedPreviewJobs: 0,
      },
    });
  } catch (caught) {
    return NextResponse.json(
      {
        ok: false,
        message: caught instanceof Error ? caught.message : "Move failed.",
      },
      { status: 400 }
    );
  }
}