import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// POST /api/auth/register - Регистрация
router.post('/register', authController.register);

// POST /api/auth/login - Вход
router.post('/login', authController.login);

// GET /api/auth/me - Текущий пользователь
router.get('/me', authMiddleware, authController.getCurrentUser);

export default router;
