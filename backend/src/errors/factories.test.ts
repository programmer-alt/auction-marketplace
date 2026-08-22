import { describe, expect, it } from "vitest";
import { createForbiddenError, createNotFoundError, createValidationError } from "./factories";

describe("Error Factories", () => {
  describe("createNotFoundError", () => {
    it("должен создать ошибку с типом NOT_FOUND и статусом 404", () => {
      const error = createNotFoundError("Объект не найден");

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("Объект не найден");
      expect(error.errorType).toBe("NOT_FOUND");
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe("NotFoundError");
    });

    it("должен использовать сообщение по умолчанию", () => {
      const error = createNotFoundError();

      expect(error.message).toBe("Объект не найден");
    });

    it("должен использовать кастомное сообщение", () => {
      const error = createNotFoundError("Аукцион не найден");

      expect(error.message).toBe("Аукцион не найден");
    });
  });

  describe("createForbiddenError", () => {
    it("должен создать ошибку с типом FORBIDDEN и статусом 403", () => {
      const error = createForbiddenError("Недостаточно прав");

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("Недостаточно прав");
      expect(error.errorType).toBe("FORBIDDEN");
      expect(error.statusCode).toBe(403);
      expect(error.name).toBe("ForbiddenError");
    });

    it("должен использовать сообщение по умолчанию", () => {
      const error = createForbiddenError();

      expect(error.message).toBe("Недостаточно прав для выполнения операции");
    });
  });

  describe("createValidationError", () => {
    it("должен создать ошибку с типом VALIDATION и статусом 400", () => {
      const error = createValidationError("Неверный email");

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("Неверный email");
      expect(error.errorType).toBe("VALIDATION");
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe("ValidationError");
    });

    it("должен создать ошибку с сообщением undefined, если не передан message", () => {
      // @ts-expect-error — проверяем поведение без аргумента
      const error = createValidationError();

      expect(error).toBeInstanceOf(Error);
      expect(error.errorType).toBe("VALIDATION");
      expect(error.statusCode).toBe(400);
    });
  });
});
