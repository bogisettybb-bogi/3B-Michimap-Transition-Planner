// @ts-nocheck
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import router from "./routes";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";

const app: Express = express();

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info({ method: req.method, url: req.url?.split("?")[0], status: res.statusCode, ms: Date.now() - start }, "request");
  });
  next();
});

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// Health / root routes -- no DB dependency, respond instantly
app.get("/", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "3B Michimap API" });
});
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.use(authMiddleware);

app.use("/api", router);

export default app;
