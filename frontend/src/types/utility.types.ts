/**
 * Утилитарные типы
 */

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object
    ? T[P] extends Array<infer U>
      ? Array<DeepPartial<U>>
      : DeepPartial<T[P]>
    : T[P];
};

export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object
    ? T[P] extends Array<infer U>
      ? Array<DeepRequired<U>>
      : DeepRequired<T[P]>
    : T[P];
};

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? (T[P] extends Function ? T[P] : DeepReadonly<T[P]>) : T[P];
};

export type ArrayElement<T> = T extends (infer U)[] ? U : never;

export type PickByType<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K];
};

export type OmitByType<T, U> = {
  [K in keyof T as T[K] extends U ? never : K]: T[K];
};

export type FormErrors<T> = {
  [K in keyof T]?: string[];
};

export type FormFieldState<T> = {
  value: T;
  error?: string;
  touched: boolean;
};

export type FormState<T extends Record<string, any>> = {
  [K in keyof T]: FormFieldState<T[K]>;
} & {
  isValid: boolean;
  isSubmitting: boolean;
};

export type WebSocketEvent = `auction:${AuctionStatusUnion | "created" | "updated" | "deleted"}` | 
                           `bid:${"created" | "updated" | "deleted" | "won"}` | 
                           `payment:${PaymentStatusUnion}`;

export type EventHandlers = {
  [K in WebSocketEvent as `on${Capitalize<K>}`]?: (data: any) => void;
};

export type LoadingState = {
  status: "idle" | "loading" | "refreshing";
  error?: string;
};

export type SuccessState<T> = {
  status: "success";
  data: T;
  updatedAt: Date;
};

export type ErrorState = {
  status: "error";
  error: string;
  retryCount: number;
};

export type AsyncState<T> = LoadingState | SuccessState<T> | ErrorState;

export type Immutable<T> = {
  readonly [K in keyof T]: Immutable<T[K]>;
};

export type ReadonlyPartial<T> = {
  readonly [K in keyof T]?: T[K];
};

export type Nullable<T> = {
  [K in keyof T]: T[K] | null;
};

export type PropsWithChildren<P = {}> = P & {
  children?: React.ReactNode;
};

export type PropsWithClassName<P = {}> = P & {
  className?: string;
};

export type PropsWithHandlers<P = {}> = P & {
  onClick?: React.MouseEventHandler;
  onChange?: React.ChangeEventHandler;
  onSubmit?: React.FormEventHandler;
};

export type CreateAuctionForm = FormState<{
  title: string;
  description: string;
  startingPrice: number;
  endsAt: string;
  imageUrl: string;
}>;