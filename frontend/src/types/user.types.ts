/**
 * User-related types
 */

import type { User } from "./index";

/**
 * Тип для публичного профиля пользователя (без чувствительных данных)
 */
export type PublicUser = Pick<User, "id" | "name" | "email" | "createdAt">;

/**
 * Тип для обновления профиля пользователя
 */
export type UserUpdate = Partial<Pick<User, "name" | "email">>;
