import type { LoginCredentials, RegisterCredentials, User } from "../types";
import api from "./axios";

export const authApi = {
  login: async (credentials: LoginCredentials) => {
    const response = await api.post<{ token: string; user: User }>("/auth/login", credentials);
    return response.data;
  },

  register: async (credentials: RegisterCredentials) => {
    const response = await api.post<{ token: string; user: User }>("/auth/register", credentials);
    return response.data;
  },

  getMe: async () => {
    const response = await api.get<{ user: User }>("/auth/me");
    return response.data.user;
  },

  logout: async () => {
    // На бэкенде может не быть эндпоинта для логаута, просто очищаем токен на фронте
    return Promise.resolve();
  },
};
