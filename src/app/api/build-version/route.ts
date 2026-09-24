import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Identifies the currently-running deployment so the client can detect
 * "I'm looking at an old build" and auto hard-refresh.
 *
 * Vercel sets VERCEL_GIT_COMMIT_SHA / VERCEL_DEPLOYMENT_ID automatically on
 * every deploy (no manual env var setup needed) -- these are stable across
 * every serverless instance of the SAME deployment, so they won't cause
 * false-positive refreshes between cold starts of one deploy, only across
 * an actual new deploy. Falls back to a per-process timestamp for local
 * dev where those aren't set.
 */
const BUILD_VERSION =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.VERCEL_DEPLOYMENT_ID ||
  String(Date.now());

export async function GET() {
  return NextResponse.json(
    { version: BUILD_VERSION },
    { headers: { "Cache-Control": "no-store, must-revalidate" } }
  );
}
