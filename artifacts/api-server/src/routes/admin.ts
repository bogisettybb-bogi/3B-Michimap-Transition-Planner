import { Router } from "express";
import { db, usersTable, generationsTable } from "@workspace/db";
import { sql, count, desc, eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

router.use((req, res, next) => {
  if (!req.isAuthenticated() || !req.user.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }
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

    const byPath = await db.select({
      transitionPath: generationsTable.transitionPath,
      count: count(),
    }).from(generationsTable).groupBy(generationsTable.transitionPath);

    const byModel = await db.select({
      aiModel: generationsTable.aiModel,
      count: count(),
    }).from(generationsTable).groupBy(generationsTable.aiModel);

    const weeklyData = await db.execute(sql`
      SELECT
        to_char(date_trunc('week', created_at), 'Mon DD') as week,
        count(*)::integer as count
      FROM generations
      WHERE created_at >= NOW() - INTERVAL '8 weeks'
      GROUP BY date_trunc('week', created_at)
      ORDER BY date_trunc('week', created_at)
    `);

    res.json({
      totalUsers: totalUsersResult.count,
      totalGenerations: totalGensResult.count,
      totalDownloads: totalDownloadsResult.count,
      generationsToday: todayGensResult.count,
      generationsByTransitionPath: Object.fromEntries(byPath.map(r => [r.transitionPath, r.count])),
      generationsByModel: Object.fromEntries(byModel.map(r => [r.aiModel, r.count])),
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
      const [genCount] = await db.select({ count: count() }).from(generationsTable).where(eq(generationsTable.userId, u.id));
      const [dlCount] = await db.select({ count: count() }).from(generationsTable).where(
        sql`${generationsTable.userId} = ${u.id} AND downloaded = true`
      );
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        provider: "replit",
        createdAt: u.createdAt,
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
      let userEmail: string | null = null;
      if (g.userId) {
        const [u] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, g.userId));
        userEmail = u?.email || null;
      }
      return {
        id: g.id,
        userId: g.userId,
        userEmail,
        transitionPath: g.transitionPath,
        aiModel: g.aiModel,
        totalWeeks: g.totalWeeks,
        downloaded: g.downloaded,
        createdAt: g.createdAt,
      };
    }));

    res.json({ generations: gensWithUser, total, page, limit });
  } catch (err) {
    logger.error({ err }, "Admin generations error");
    res.status(500).json({ error: "Failed to fetch generations" });
  }
});

export default router;
