/// <reference types="vite/client" />

declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

// biome-ignore lint/correctness/noUnusedVariables: global augmentation for Stripe
interface Window {
  Stripe?: (key: string) => Promise<any>;
}
