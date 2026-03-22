import { Router } from "express";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || "";
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || "";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "bogisettybb@gmail.com";

function getBaseUrl(req: any): string {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "";
  return `${protocol}://${host}`;
}

function randomState() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

async function createSession(userId: number): Promise<string> {
  const token = `sess_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}${Math.random().toString(36).substring(2)}`;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await db.insert(sessionsTable).values({ userId, sessionToken: token, expiresAt });
  return token;
}

async function getUserFromRequest(req: any) {
  const token = req.cookies?.session_token || req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;
  const sessions = await db.select().from(sessionsTable).where(eq(sessionsTable.sessionToken, token));
  const session = sessions[0];
  if (!session || session.expiresAt < new Date()) return null;
  const users = await db.select().from(usersTable).where(eq(usersTable.id, session.userId));
  return users[0] || null;
}

// Google OAuth
router.get("/google", (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: "Google OAuth not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET secrets." });
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
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get("/google/callback", async (req, res) => {
  const { code } = req.query as { code?: string };
  if (!code) {
    return res.redirect("/?error=google_auth_failed");
  }
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
    const tokenData = await tokenRes.json() as any;
    if (!tokenData.access_token) throw new Error("No access token");

    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const googleUser = await userRes.json() as any;

    const isAdmin = googleUser.email === ADMIN_EMAIL;
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, googleUser.email));
    let user;
    if (existing.length > 0) {
      await db.update(usersTable).set({
        name: googleUser.name,
        avatarUrl: googleUser.picture,
        lastLoginAt: new Date(),
        isAdmin,
        updatedAt: new Date(),
      }).where(eq(usersTable.email, googleUser.email));
      user = { ...existing[0], isAdmin };
    } else {
      const inserted = await db.insert(usersTable).values({
        email: googleUser.email,
        name: googleUser.name,
        avatarUrl: googleUser.picture,
        provider: "google",
        providerId: googleUser.sub,
        isAdmin,
        lastLoginAt: new Date(),
      }).returning();
      user = inserted[0];
    }

    const token = await createSession(user.id);
    res.cookie("session_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: "/",
    });
    res.redirect("/?auth=success");
  } catch (err) {
    logger.error({ err }, "Google auth callback error");
    res.redirect("/?error=auth_failed");
  }
});

// LinkedIn OAuth
router.get("/linkedin", (req, res) => {
  if (!LINKEDIN_CLIENT_ID) {
    return res.status(503).json({ error: "LinkedIn OAuth not configured. Please add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET secrets." });
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
  res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`);
});

router.get("/linkedin/callback", async (req, res) => {
  const { code } = req.query as { code?: string };
  if (!code) {
    return res.redirect("/?error=linkedin_auth_failed");
  }
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
    const tokenData = await tokenRes.json() as any;
    if (!tokenData.access_token) throw new Error("No access token");

    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const profile = await profileRes.json() as any;

    const email = profile.email;
    const name = profile.name || `${profile.given_name || ""} ${profile.family_name || ""}`.trim();
    const isAdmin = email === ADMIN_EMAIL;

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
    let user;
    if (existing.length > 0) {
      await db.update(usersTable).set({
        name,
        avatarUrl: profile.picture,
        lastLoginAt: new Date(),
        isAdmin,
        updatedAt: new Date(),
      }).where(eq(usersTable.email, email));
      user = { ...existing[0], isAdmin };
    } else {
      const inserted = await db.insert(usersTable).values({
        email,
        name,
        avatarUrl: profile.picture,
        provider: "linkedin",
        providerId: profile.sub || email,
        isAdmin,
        lastLoginAt: new Date(),
      }).returning();
      user = inserted[0];
    }

    const token = await createSession(user.id);
    res.cookie("session_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: "/",
    });
    res.redirect("/?auth=success");
  } catch (err) {
    logger.error({ err }, "LinkedIn auth callback error");
    res.redirect("/?error=auth_failed");
  }
});

// Get current user
router.get("/me", async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.json(null);
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      provider: user.provider,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
    });
  } catch (err) {
    logger.error({ err }, "Get me error");
    res.json(null);
  }
});

// Logout
router.post("/logout", async (req, res) => {
  const token = req.cookies?.session_token;
  if (token) {
    await db.delete(sessionsTable).where(eq(sessionsTable.sessionToken, token));
  }
  res.clearCookie("session_token", { path: "/" });
  res.json({ success: true });
});

export { getUserFromRequest };
export default router;
