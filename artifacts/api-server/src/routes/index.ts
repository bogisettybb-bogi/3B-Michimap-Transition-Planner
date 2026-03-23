// @ts-nocheck
import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import generateRouter from "./generate";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use("/generate", generateRouter);
router.use("/admin", adminRouter);

export default router;
