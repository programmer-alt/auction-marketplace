import { Router } from 'express';
import { bidsController } from '../controllers/bids.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// POST /api/auctions/:auctionId/bids — размещение ставки
router.post('/:auctionId/bids', authMiddleware, bidsController.createBid);

// GET /api/auctions/:auctionId/bids — история ставок по аукциону
router.get('/:auctionId/bids', bidsController.getBidsByAuction);

export default router;
