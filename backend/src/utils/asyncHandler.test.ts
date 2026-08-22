import { describe, expect, it, vi } from "vitest";
import { asyncHandler } from "./asyncHandler";

describe("asyncHandler", () => {
  it("должен вызвать переданную функцию с правильными аргументами", async () => {
    const handlerFn = vi.fn().mockResolvedValue(undefined);
    const req = { body: { test: true } } as any;
    const res = { json: vi.fn() } as any;
    const next = vi.fn();

    const wrapped = asyncHandler(handlerFn);
    await wrapped(req, res, next);

    expect(handlerFn).toHaveBeenCalledWith(req, res, next);
  });

  it("должен передать ошибку в next() при rejected promise", async () => {
    const testError = new Error("Test error");
    const handlerFn = vi.fn().mockRejectedValue(testError);
    const req = {} as any;
    const res = {} as any;
    const next = vi.fn();

    const wrapped = asyncHandler(handlerFn);
    await wrapped(req, res, next);

    expect(next).toHaveBeenCalledWith(testError);
  });

  it("должен обработать async функцию без ошибок", async () => {
    const handlerFn = vi.fn().mockImplementation(async (_req: any, res: any) => {
      res.json({ success: true });
    });
    const req = {} as any;
    const res = { json: vi.fn() } as any;
    const next = vi.fn();

    const wrapped = asyncHandler(handlerFn);
    await wrapped(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(next).not.toHaveBeenCalled();
  });

  it("должен обработать синхронное исключение внутри async функции", async () => {
    const handlerFn = vi.fn().mockImplementation(async () => {
      throw new Error("Sync throw inside async");
    });
    const req = {} as any;
    const res = {} as any;
    const next = vi.fn();

    const wrapped = asyncHandler(handlerFn);
    await wrapped(req, res, next);

    expect(next).toHaveBeenCalledWith(new Error("Sync throw inside async"));
  });

  it("должен работать с кастомным типом Request", async () => {
    interface CustomRequest {
      user?: { id: number };
      body: Record<string, unknown>;
    }
    const handlerFn = vi.fn().mockResolvedValue(undefined);
    const req = { user: { id: 1 }, body: {} } as unknown as CustomRequest;
    const res = {} as any;
    const next = vi.fn();

    const wrapped = asyncHandler<CustomRequest>(handlerFn);
    await wrapped(req, res, next);

    expect(handlerFn).toHaveBeenCalledWith(req, res, next);
  });
});
