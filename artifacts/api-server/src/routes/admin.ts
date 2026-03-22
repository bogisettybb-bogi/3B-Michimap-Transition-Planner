import { Router } from "express";
import { db, usersTable, generationsTable } from "@workspace/db";
import { sql, count, desc } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getUserFromRequest } from "./auth";

const router = Router();

// Auth middleware for admin
router.use(async (req, res, next) => {
  const user = await getUserFromRequest(req);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  (req as any).adminUser = user;
  next();
});

router.get("/stats", async (req, res) => {
  try {
    const [totalUsersResult] = await db.select({ count: count() }).from(usersTable);
    const [totalGensResult] = await db.select({ count: count() }).from(generationsTable);
    const [todayGensResult] = await db.select({ count: count() }).from(generationsTable).where(
      sql`created_at >= current_date`
    );
    const [totalDownloadsResult] = await db.select({ count: count() }).from(generationsTable).where(
      sql`downloaded = true`
    );

    // By provider
    const byProvider = await db.select({
      provider: usersTable.provider,
      count: count(),
    }).from(usersTable).groupBy(usersTable.provider);

    // By transition path
    const byPath = await db.select({
      transitionPath: generationsTable.transitionPath,
      count: count(),
    }).from(generationsTable).groupBy(generationsTable.transitionPath);

    // By model
    const byModel = await db.select({
      aiModel: generationsTable.aiModel,
      count: count(),
    }).from(generationsTable).groupBy(generationsTable.aiModel);

    // Recent activity
    const recentGens = await db.select({
      id: generationsTable.id,
      userId: generationsTable.userId,
      transitionPath: generationsTable.transitionPath,
      model: generationsTable.aiModel,
      createdAt: generationsTable.createdAt,
    }).from(generationsTable).orderBy(desc(generationsTable.createdAt)).limit(20);

    // Get user info for recent
    const recentActivity = await Promise.all(recentGens.map(async (g) => {
      let userName = "Guest";
      let userEmail = "guest";
      if (g.userId) {
        const users = await db.select({ name: usersTable.name, email: usersTable.email }).from(usersTable).where(
          sql`${usersTable.id} = ${g.userId}`
        );
        if (users[0]) { userName = users[0].name; userEmail = users[0].email; }
      }
      return { id: g.id, type: "generation", userName, userEmail, transitionPath: g.transitionPath, model: g.model, createdAt: g.createdAt };
    }));

    // Weekly generations (last 8 weeks)
    const weeklyData = await db.execute(sql`
      SELECT 
        to_char(date_trunc('week', created_at), 'YYYY-MM-DD') as week,
        count(*)::integer as count
      FROM generations
      WHERE created_at >= NOW() - INTERVAL '8 weeks'
      GROUP BY date_trunc('week', created_at)
      ORDER BY week
    `);

    res.json({
      totalUsers: totalUsersResult.count,
      totalGenerations: totalGensResult.count,
      totalDownloads: totalDownloadsResult.count,
      generationsToday: todayGensResult.count,
      usersByProvider: Object.fromEntries(byProvider.map(r => [r.provider, r.count])),
      generationsByTransitionPath: Object.fromEntries(byPath.map(r => [r.transitionPath, r.count])),
      generationsByModel: Object.fromEntries(byModel.map(r => [r.aiModel, r.count])),
      recentActivity,
      weeklyGenerations: (weeklyData.rows as any[]).map(r => ({ week: r.week, count: r.count })),
    });
  } catch (err) {
    logger.error({ err }, "Admin stats error");
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

router.get("/users", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt)).limit(limit).offset(offset);
    const [{ count: total }] = await db.select({ count: count() }).from(usersTable);

    const usersWithStats = await Promise.all(users.map(async (u) => {
      const [genCount] = await db.select({ count: count() }).from(generationsTable).where(sql`${generationsTable.userId} = ${u.id}`);
      const [dlCount] = await db.select({ count: count() }).from(generationsTable).where(sql`${generationsTable.userId} = ${u.id} AND downloaded = true`);
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        provider: u.provider,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        generationCount: genCount.count,
        downloadCount: dlCount.count,
      };
    }));

    res.json({ users: usersWithStats, total, page, limit });
  } catch (err) {
    logger.error({ err }, "Admin users error");
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.get("/generations", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const gens = await db.select().from(generationsTable).orderBy(desc(generationsTable.createdAt)).limit(limit).offset(offset);
    const [{ count: total }] = await db.select({ count: count() }).from(generationsTable);

    const gensWithUser = await Promise.all(gens.map(async (g) => {
      let userName = null;
      let userEmail = null;
      if (g.userId) {
        const users = await db.select({ name: usersTable.name, email: usersTable.email }).from(usersTable).where(sql`${usersTable.id} = ${g.userId}`);
        if (users[0]) { userName = users[0].name; userEmail = users[0].email; }
      }
      return { id: g.id, userId: g.userId, userName, userEmail, transitionPath: g.transitionPath, aiModel: g.aiModel, totalWeeks: g.totalWeeks, downloaded: g.downloaded, createdAt: g.createdAt };
    }));

    res.json({ generations: gensWithUser, total, page, limit });
  } catch (err) {
    logger.error({ err }, "Admin generations error");
    res.status(500).json({ error: "Failed to fetch generations" });
  }
});

export default router;
