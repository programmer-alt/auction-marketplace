import { Router } from 'express';
import { BidsController } from '../controllers/bids.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const bidsController = new BidsController();

// POST /api/auctions/:auctionId/bids — размещение ставки
router.post('/:auctionId/bids', authMiddleware, bidsController.createBid.bind(bidsController));

// GET /api/auctions/:auctionId/bids — история ставок по аукциону
router.get('/:auctionId/bids', bidsController.getBidsByAuction.bind(bidsController));

export default router;
