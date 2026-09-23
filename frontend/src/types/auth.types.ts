/**
 * Типы для аутентификации и авторизации
 */

import { User } from './index';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  name: string;
}

export type PublicUser = Pick<User, "id" | "name" | "email" | "createdAt">;

export type UserUpdate = Partial<Pick<User, "name" | "email">>;

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<any>;
  logout: () => void;
  register: (data: { email: string; password: string; name: string }) => Promise<any>;
  updateProfile: (data: UserUpdate) => Promise<any>;
}