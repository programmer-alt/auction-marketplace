/**
 * Auth-related types
 */

import type { User, ApiResponse } from "./index";
import type { UserUpdate } from "./user.types";

/**
 * Пример: Тип для контекста аутентификации
 */
export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<ApiResponse<User>>;
  logout: () => void;
  register: (data: { email: string; password: string; name: string }) => Promise<ApiResponse<User>>;
  updateProfile: (data: UserUpdate) => Promise<ApiResponse<User>>;
}
