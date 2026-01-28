import { NextResponse } from "next/server";
import { getSheetData, SHEETS } from "@/app/lib/googleSheets";
import { requireAuth } from "@/app/lib/session";
import { normalizeRole } from "@/app/lib/roleUtils";

/**
 * GET /api/signals/prompt-history?profile_id=...
 * Returns saved prompt history entries for the given profile.
 * Admin-only (for now), since this is used by admin clients page.
 */
export async function GET(request) {
  try {
    const session = await requireAuth();
    const normalizedRole = normalizeRole(session.role || "");
    if (normalizedRole !== "Admin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = (searchParams.get("profile_id") || "").trim();
    const limit = Math.min(parseInt(searchParams.get("limit") || "25", 10) || 25, 100);

    if (!profileId) {
      return NextResponse.json({ error: "profile_id is required" }, { status: 400 });
    }

    let rows = [];
    try {
      rows = await getSheetData(SHEETS.SIGNAL_PROMPT_HISTORY);
    } catch (e) {
      // Sheet might not exist yet
      return NextResponse.json({ success: true, prompts: [] });
    }

    const filtered = rows
      .filter((r) => {
        const pid = r.profile_id || r["profile_id"] || r["Profile ID"] || "";
        return String(pid).trim() === String(profileId).trim();
      })
      .map((r) => ({
        profile_id: r.profile_id || r["profile_id"] || r["Profile ID"] || "",
        prompt_text: r.prompt_text || r["prompt_text"] || r["Prompt Text"] || "",
        created_at: r.created_at || r["created_at"] || r["Created At"] || "",
        created_by: r.created_by || r["created_by"] || r["Created By"] || "",
      }))
      .filter((r) => r.prompt_text && String(r.prompt_text).trim() !== "");

    filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    return NextResponse.json({
      success: true,
      prompts: filtered.slice(0, limit),
      count: filtered.length,
    });
  } catch (error) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching signal prompt history:", error);
    return NextResponse.json(
      { error: "Failed to fetch prompt history", details: error.message },
      { status: 500 }
    );
  }
}

