import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const authController = new AuthController();

// POST /api/auth/register - Регистрация
router.post('/register', authController.register.bind(authController));

// POST /api/auth/login - Вход
router.post('/login', authController.login.bind(authController));

// GET /api/auth/me - Текущий пользователь
router.get('/me', authMiddleware, authController.getCurrentUser.bind(authController));

export default router;
