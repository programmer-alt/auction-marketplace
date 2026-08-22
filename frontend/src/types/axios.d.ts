import type { InternalAxiosRequestConfig } from "axios";

declare module "axios" {
  interface AxiosRequestConfig {
    handled?: boolean;
  }

  interface AxiosError<T = any> {
    config?: InternalAxiosRequestConfig & {
      handled?: boolean;
    };
  }
}
