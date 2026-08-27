import { Router } from "express";
import { auctionsController } from "../controllers/auctions.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// GET /api/auctions — получение списка аукционов
router.get("/", auctionsController.getAuctions);

// GET /api/auctions/:id — получение конкретного аукциона
router.get("/:id", auctionsController.getAuctionById);

// POST /api/auctions — создание нового аукциона
router.post("/", authMiddleware, auctionsController.createAuction);

// PUT /api/auctions/:id — обновление аукциона
router.put("/:id", authMiddleware, auctionsController.updateAuction);

// DELETE /api/auctions/:id — удаление аукциона
router.delete("/:id", authMiddleware, auctionsController.deleteAuction);

// POST /api/auctions/:id/complete — завершение аукциона (ручное)
router.post("/:id/complete", authMiddleware, auctionsController.completeAuction);

export default router;
