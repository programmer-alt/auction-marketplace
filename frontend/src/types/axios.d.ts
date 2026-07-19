// Расширяем типы axios для поддержки флага handled
import { AxiosRequestConfig, AxiosError } from 'axios';

declare module 'axios' {
  interface AxiosRequestConfig {
    handled?: boolean;
  }

  interface AxiosError<T = any> {
    config: InternalAxiosRequestConfig & {
      handled?: boolean;
    };
  }
  
  interface InternalAxiosRequestConfig<D = any> {
    handled?: boolean;
  }
}