// Расширяем типы axios для поддержки флага handled
import { AxiosRequestConfig } from 'axios';

declare module 'axios' {
  interface AxiosRequestConfig {
    handled?: boolean;
  }
}