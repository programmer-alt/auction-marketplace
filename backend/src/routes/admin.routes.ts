import { Router } from "express";
import { getQueueStats } from "../controllers/admin.controller";
import { adminMiddleware } from "../middleware/admin";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// GET /api/admin/queue/stats — статистика очереди завершения аукционов
// Требует аутентификации И прав администратора
router.get("/queue/stats", authMiddleware, adminMiddleware, getQueueStats);

export default router;
