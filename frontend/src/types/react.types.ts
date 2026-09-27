/**
 * React component types
 */

import type React from "react";

/**
 * Тип для пропсов компонента с children
 */
// biome-ignore lint/complexity/noBannedTypes: {} is intentional default for generic props
export type PropsWithChildren<P = {}> = P & {
  children?: React.ReactNode;
};

/**
 * Тип для пропсов компонента с className
 */
// biome-ignore lint/complexity/noBannedTypes: {} is intentional default for generic props
export type PropsWithClassName<P = {}> = P & {
  className?: string;
};

/**
 * Тип для пропсов компонента с обработчиками событий
 */
// biome-ignore lint/complexity/noBannedTypes: {} is intentional default for generic props
export type PropsWithHandlers<P = {}> = P & {
  onClick?: React.MouseEventHandler;
  onChange?: React.ChangeEventHandler;
  onSubmit?: React.FormEventHandler;
};
