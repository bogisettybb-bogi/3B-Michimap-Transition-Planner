import { Router, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  clearSession,
  createSession,
  getSessionId,
  SESSION_COOKIE,
  SESSION_TTL,
  type AuthUser,
  type SessionData,
} from "../lib/auth";

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || "";
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || "";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "bogisettybb@gmail.com";

function getBaseUrl(req: Request): string {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "";
  return `${protocol}://${host}`;
}

function randomState(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

async function upsertUser(
  providerId: string,
  provider: "google" | "linkedin",
  email: string | null,
  name: string | null,
  avatarUrl: string | null,
): Promise<AuthUser> {
  const id = `${provider}:${providerId}`;
  const isAdmin = !!(email && email === ADMIN_EMAIL);

  const [user] = await db
    .insert(usersTable)
    .values({ id, email, name, avatarUrl, isAdmin })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: { email, name, avatarUrl, isAdmin, updatedAt: new Date() },
    })
    .returning();

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt,
  };
}

async function startSession(res: Response, user: AuthUser, accessToken: string) {
  const sessionData: SessionData = {
    user,
    access_token: accessToken,
  };
  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
}

// ── GET /auth/me ────────────────────────────────────────────────────────────
router.get("/auth/me", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) return res.json(null);
  res.json(req.user);
});

// ── POST /auth/logout ────────────────────────────────────────────────────────
router.post("/auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json({ success: true });
});

// ── Google OAuth ─────────────────────────────────────────────────────────────
router.get("/auth/google", (req: Request, res: Response) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(503).json({
      error: "Google OAuth not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    });
  }
  const state = randomState();
  const redirectUri = `${getBaseUrl(req)}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get("/auth/google/callback", async (req: Request, res: Response) => {
  const { code } = req.query as { code?: string };
  if (!code) return res.redirect("/?error=google_auth_failed");

  try {
    const redirectUri = `${getBaseUrl(req)}/api/auth/google/callback`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = (await tokenRes.json()) as any;
    if (!tokenData.access_token) throw new Error("No access token");

    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const g = (await userRes.json()) as any;

    const user = await upsertUser(g.sub, "google", g.email ?? null, g.name ?? null, g.picture ?? null);
    await startSession(res, user, tokenData.access_token);
    res.redirect("/");
  } catch (err) {
    logger.error({ err }, "Google auth callback error");
    res.redirect("/?error=auth_failed");
  }
});

// ── LinkedIn OAuth ────────────────────────────────────────────────────────────
router.get("/auth/linkedin", (req: Request, res: Response) => {
  if (!LINKEDIN_CLIENT_ID) {
    return res.status(503).json({
      error: "LinkedIn OAuth not configured. Please add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET.",
    });
  }
  const state = randomState();
  const redirectUri = `${getBaseUrl(req)}/api/auth/linkedin/callback`;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: LINKEDIN_CLIENT_ID,
    redirect_uri: redirectUri,
    state,
    scope: "openid profile email",
  });
  res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
});

router.get("/auth/linkedin/callback", async (req: Request, res: Response) => {
  const { code } = req.query as { code?: string };
  if (!code) return res.redirect("/?error=linkedin_auth_failed");

  try {
    const redirectUri = `${getBaseUrl(req)}/api/auth/linkedin/callback`;
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
      }),
    });
    const tokenData = (await tokenRes.json()) as any;
    if (!tokenData.access_token) throw new Error("No access token");

    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const p = (await profileRes.json()) as any;

    const name = p.name || `${p.given_name || ""} ${p.family_name || ""}`.trim() || null;
    const user = await upsertUser(p.sub || p.email, "linkedin", p.email ?? null, name, p.picture ?? null);
    await startSession(res, user, tokenData.access_token);
    res.redirect("/");
  } catch (err) {
    logger.error({ err }, "LinkedIn auth callback error");
    res.redirect("/?error=auth_failed");
  }
});

export function getUserFromRequest(req: Request) {
  return req.isAuthenticated() ? req.user : null;
}

export default router;
