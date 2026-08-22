import { z } from "zod";

export const createAuctionSchema = z.object({
  title: z.string().min(3, "Название должно содержать минимум 3 символа").max(100),
  description: z.string().max(500).optional(),
  imageUrl: z.string().url("Некорректный URL").optional().or(z.literal("")),
  startingPrice: z.coerce.number().positive("Начальная цена должна быть положительной").min(1),
  endsAt: z.string().refine((val) => {
    const date = new Date(val);
    const now = new Date();
    return date > new Date(now.getTime() + 60 * 60 * 1000); // минимум 1 час в будущем
  }, "Дата окончания должна быть минимум на 1 час позже текущего времени"),
});

export const bidSchema = z.object({
  amount: z.coerce.number().positive("Ставка должна быть положительной").min(0.01),
});

export type CreateAuctionFormData = z.infer<typeof createAuctionSchema>;
export type BidFormData = z.infer<typeof bidSchema>;
