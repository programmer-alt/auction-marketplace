/**
 * React component types
 */

import type React from "react";

/**
 * Тип для пропсов компонента с children
 */
export type PropsWithChildren<P = {}> = P & {
  children?: React.ReactNode;
};

/**
 * Тип для пропсов компонента с className
 */
export type PropsWithClassName<P = {}> = P & {
  className?: string;
};

/**
 * Тип для пропсов компонента с обработчиками событий
 */
export type PropsWithHandlers<P = {}> = P & {
  onClick?: React.MouseEventHandler;
  onChange?: React.ChangeEventHandler;
  onSubmit?: React.FormEventHandler;
};
