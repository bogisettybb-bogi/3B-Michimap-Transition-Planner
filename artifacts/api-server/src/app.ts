// @ts-nocheck
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";

const __dirname_esm = path.dirname(fileURLToPath(import.meta.url));

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

// Serve static UI files from the public/ folder
const publicDir = path.resolve(__dirname_esm, "../public");
app.use(express.static(publicDir));

// Health check -- no DB dependency, responds instantly
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.use(authMiddleware);

app.use("/api", router);

// Catch-all: return the React app's index.html for any non-API route
// This enables React Router client-side navigation to work correctly
app.get("/{*path}", (_req: Request, res: Response) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

export default app;
