import * as oidc from "openid-client";
import { Router, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  clearSession,
  createSession,
  getOidcConfig,
  getSessionId,
  SESSION_COOKIE,
  SESSION_TTL,
  type AuthUser,
  type SessionData,
} from "../lib/auth";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "bogisettybb@gmail.com";
const OIDC_COOKIE_TTL = 10 * 60 * 1000;

const router = Router();

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: SESSION_TTL,
  });
}

function setOidcCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: OIDC_COOKIE_TTL,
  });
}

function getSafeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

async function upsertUser(claims: Record<string, unknown>): Promise<AuthUser> {
  const id = claims.sub as string;
  const email = (claims.email as string) || null;
  const name = (claims.name as string) || [claims.first_name, claims.last_name].filter(Boolean).join(" ") || null;
  const avatarUrl = ((claims.profile_image_url || claims.picture) as string) || null;
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

router.get("/auth/me", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) return res.json(null);
  res.json(req.user);
});

router.get("/login", async (req: Request, res: Response) => {
  try {
    const config = await getOidcConfig();
    const callbackUrl = `${getOrigin(req)}/api/callback`;
    const returnTo = getSafeReturnTo(req.query.returnTo);

    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

    const redirectTo = oidc.buildAuthorizationUrl(config, {
      redirect_uri: callbackUrl,
      scope: "openid email profile offline_access",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      prompt: "login consent",
      state,
      nonce,
    });

    setOidcCookie(res, "code_verifier", codeVerifier);
    setOidcCookie(res, "nonce", nonce);
    setOidcCookie(res, "state", state);
    setOidcCookie(res, "return_to", returnTo);

    res.redirect(redirectTo.href);
  } catch (err) {
    logger.error({ err }, "Login initiation error");
    res.redirect("/?error=auth_failed");
  }
});

router.get("/callback", async (req: Request, res: Response) => {
  try {
    const config = await getOidcConfig();
    const callbackUrl = `${getOrigin(req)}/api/callback`;

    const codeVerifier = req.cookies?.code_verifier;
    const nonce = req.cookies?.nonce;
    const expectedState = req.cookies?.state;
    const returnTo = req.cookies?.return_to || "/";

    if (!codeVerifier || !expectedState) {
      return res.redirect("/api/login");
    }

    const currentUrl = new URL(
      `${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`,
    );

    const tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce,
      expectedState,
    });

    const claims = tokens.claims();
    if (!claims) {
      return res.redirect("/?error=auth_failed");
    }

    const dbUser = await upsertUser(claims as unknown as Record<string, unknown>);

    const now = Math.floor(Date.now() / 1000);
    const sessionData: SessionData = {
      user: dbUser,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : (claims.exp as number),
    };

    const sid = await createSession(sessionData);
    setSessionCookie(res, sid);

    ["code_verifier", "nonce", "state", "return_to"].forEach(c =>
      res.clearCookie(c, { path: "/" })
    );

    res.redirect(returnTo);
  } catch (err) {
    logger.error({ err }, "Auth callback error");
    res.redirect("/?error=auth_failed");
  }
});

router.post("/auth/logout", async (req: Request, res: Response) => {
  try {
    const sid = getSessionId(req);
    await clearSession(res, sid);
    const config = await getOidcConfig().catch(() => null);
    if (config?.serverMetadata().end_session_endpoint) {
      const endUrl = new URL(config.serverMetadata().end_session_endpoint!);
      return res.redirect(endUrl.href);
    }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Logout error");
    res.json({ success: true });
  }
});

export function getUserFromRequest(req: Request) {
  return req.isAuthenticated() ? req.user : null;
}

export default router;
