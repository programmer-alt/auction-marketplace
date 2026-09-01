/// <reference types="vite/client" />

declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

interface Window {
  Stripe?: (key: string) => Promise<any>;
}
