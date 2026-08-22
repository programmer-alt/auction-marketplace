import type { NextFunction, Request, Response } from "express";

type AsyncHandler<T extends Request = Request> = (
  req: T,
  res: Response,
  next: NextFunction,
) => Promise<undefined | Response>;

export function asyncHandler<T extends Request = Request>(fn: AsyncHandler<T>) {
  return (req: T, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
