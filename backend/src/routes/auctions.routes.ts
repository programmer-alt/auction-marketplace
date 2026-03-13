import { Router } from 'express';
import { AuctionsController } from '../controllers/auctions.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const auctionsController = new AuctionsController();

// GET /api/auctions — получение списка аукционов
router.get('/', auctionsController.getAuctions.bind(auctionsController));

// GET /api/auctions/:id — получение конкретного аукциона
router.get('/:id', auctionsController.getAuctionById.bind(auctionsController));

// POST /api/auctions — создание нового аукциона
router.post('/', authMiddleware, auctionsController.createAuction.bind(auctionsController));

// PUT /api/auctions/:id — обновление аукциона
router.put('/:id', authMiddleware, auctionsController.updateAuction.bind(auctionsController));

// DELETE /api/auctions/:id — удаление аукциона
router.delete('/:id', authMiddleware, auctionsController.deleteAuction.bind(auctionsController));

export default router;
