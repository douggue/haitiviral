import { NextResponse } from "next/server";
import { readLocalPublicFile } from "@/lib/storage";

/** Serves locally stored public images in development. In production images live on Vercel Blob. */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  try {
    const buf = await readLocalPublicFile(path.join("/"));
    const ext = path.at(-1)?.split(".").pop();
    const type = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    return new NextResponse(new Uint8Array(buf), { headers: { "content-type": type, "cache-control": "public, max-age=31536000, immutable" } });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
