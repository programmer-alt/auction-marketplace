import type { NextFunction, Request, Response } from "express";

/**
 * Конфигурация политики безопасности контента (CSP)
 */
export interface CspConfig {
  defaultSrc?: string[];
  scriptSrc?: string[];
  styleSrc?: string[];
  imgSrc?: string[];
  fontSrc?: string[];
  connectSrc?: string[];
  mediaSrc?: string[];
  objectSrc?: string[];
  frameSrc?: string[];
  frameAncestors?: string[];
  baseUri?: string[];
  formAction?: string[];
  upgradeInsecureRequests?: boolean;
  blockAllMixedContent?: boolean;
  // Добавляем специфичные директивы для разрешения inline элементов
  scriptSrcElem?: string[];
  styleSrcElem?: string[];
  scriptSrcAttr?: string[];
  styleSrcAttr?: string[];
}

/**
 * Конфигурация security headers
 */
export interface SecurityHeadersConfig {
  csp?: CspConfig;
  frameOptions?: "DENY" | "SAMEORIGIN" | "ALLOW-FROM";
  contentTypeOptions?: "nosniff";
  referrerPolicy?:
    | "no-referrer"
    | "no-referrer-when-downgrade"
    | "origin"
    | "origin-when-cross-origin"
    | "same-origin"
    | "strict-origin"
    | "strict-origin-when-cross-origin"
    | "unsafe-url";
  permissionsPolicy?: Record<string, string[]>;
  hsts?: {
    maxAge: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };
  // Дополнительные кастомные заголовки
  customHeaders?: Record<string, string>;
}

/**
 * Генерирует строку CSP из конфигурации
 */
function generateCspHeader(csp: CspConfig): string {
  const directives: string[] = [];

  // Маппинг свойств конфигурации на имена директив CSP
  const directiveMap: Record<string, string> = {
    defaultSrc: "default-src",
    scriptSrc: "script-src",
    styleSrc: "style-src",
    imgSrc: "img-src",
    fontSrc: "font-src",
    connectSrc: "connect-src",
    mediaSrc: "media-src",
    objectSrc: "object-src",
    frameSrc: "frame-src",
    frameAncestors: "frame-ancestors",
    baseUri: "base-uri",
    formAction: "form-action",
    scriptSrcElem: "script-src-elem",
    styleSrcElem: "style-src-elem",
    scriptSrcAttr: "script-src-attr",
    styleSrcAttr: "style-src-attr",
  };

  // Обрабатываем директивы с массивами источников
  for (const [key, directiveName] of Object.entries(directiveMap)) {
    const sources = csp[key as keyof CspConfig];
    if (Array.isArray(sources) && sources.length > 0) {
      directives.push(`${directiveName} ${sources.join(" ")}`);
    }
  }

  // Булевые директивы
  if (csp.upgradeInsecureRequests) {
    directives.push("upgrade-insecure-requests");
  }
  if (csp.blockAllMixedContent) {
    directives.push("block-all-mixed-content");
  }

  return directives.join("; ");
}

/**
 * Генерирует строку Permissions-Policy из конфигурации
 */
function generatePermissionsPolicyHeader(policy: Record<string, string[]>): string {
  const directives = Object.entries(policy).map(([feature, origins]) => {
    if (origins.length === 0) {
      return `${feature}=()`;
    }
    return `${feature}=(${origins.join(" ")})`;
  });
  return directives.join(", ");
}

/**
 * Дефолтная конфигурация CSP для приложения Global Auction Marketplace
 */
const defaultCspConfig: CspConfig = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "https://fonts.googleapis.com"],
  imgSrc: ["'self'", "data:", "https:", "http://localhost:*"], // Изображения с любых HTTPS источников и локального сервера
  fontSrc: ["'self'", "data:", "https:", "https://fonts.gstatic.com", "https://fonts.googleapis.com"],
  connectSrc: ["'self'", "http://localhost:*", "ws://localhost:*"], // WebSocket и API вызовы
  mediaSrc: ["'self'"],
  objectSrc: ["'none'"], // Запрещаем <object>, <embed>, <applet>
  frameSrc: ["'none'"], // Запрещаем <iframe>, <frame>
  frameAncestors: ["'none'"], // Запрещаем встраивание в iframe (аналогично X-Frame-Options DENY)
  baseUri: ["'self'"],
  formAction: ["'self'"],
  upgradeInsecureRequests: false, // Включать только в production
  blockAllMixedContent: false,
  // Явно добавляем специфичные директивы для разрешения элементов стилей из Google Fonts
  styleSrcElem: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
  styleSrcAttr: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
};

// Конфигурация CSP для development режима - улучшенная версия для поддержки инструментов разработки
const devCspConfig: CspConfig = {
  ...defaultCspConfig,
  // В development разрешаем больше источников для инструментов разработки
  connectSrc: [
    ...(defaultCspConfig.connectSrc || []),
    "https://*",
    "wss://*",
    "chrome-extension:*",
    "https://clients2.google.com",
    "https://www.google-analytics.com",
  ],
  // Расширяем разрешения для Chrome DevTools и расширений
  scriptSrc: [...(defaultCspConfig.scriptSrc || []), "chrome-extension:*", "'unsafe-eval'", "'wasm-unsafe-eval'"],
  styleSrc: [
    ...(defaultCspConfig.styleSrc || []),
    "chrome-extension:*",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
  ],
  // Явно добавляем специфичные директивы для inline элементов
  scriptSrcElem: [
    "'self'",
    "'unsafe-inline'",
    "chrome-extension:*",
    "https://fonts.googleapis.com",
    "https://fonts.gstatic.com",
  ],
  styleSrcElem: [
    ...(defaultCspConfig.styleSrcElem || []),
    "chrome-extension:*",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
    "https://fonts.gstatic.com",
  ],
  scriptSrcAttr: ["'self'", "'unsafe-inline'", "chrome-extension:*"],
  styleSrcAttr: [
    ...(defaultCspConfig.styleSrcAttr || []),
    "chrome-extension:*",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
    "https://fonts.gstatic.com",
  ],
  imgSrc: [...(defaultCspConfig.imgSrc || []), "chrome-extension:*", "https://*", "data:", "blob:", "filesystem:"],
  fontSrc: [...(defaultCspConfig.fontSrc || []), "https://fonts.gstatic.com", "https://fonts.googleapis.com"],
  // Разрешаем доступ к well-known ресурсам для Chrome и других инструментов разработки
  defaultSrc: [...(defaultCspConfig.defaultSrc || []), "https://*", "chrome-extension:*"],
};

/**
 * Дефолтная конфигурация security headers
 */
const defaultSecurityHeadersConfig: SecurityHeadersConfig = {
  csp: defaultCspConfig,
  frameOptions: "DENY",
  contentTypeOptions: "nosniff",
  referrerPolicy: "strict-origin-when-cross-origin",
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    payment: [],
    autoplay: [],
    fullscreen: ["'self'"],
  },
  hsts: {
    maxAge: 31536000, // 1 год
    includeSubDomains: true,
    preload: false,
  },
  customHeaders: {},
};

/**
 * Middleware для добавления security headers
 * @param config Конфигурация заголовков (опционально)
 */
export function securityHeaders(config: SecurityHeadersConfig = defaultSecurityHeadersConfig) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const isProduction = process.env.NODE_ENV === "production";

    // Content-Security-Policy
    if (config.csp) {
      let cspConfig = config.csp;

      // В development используем расширенную конфигурацию для поддержки инструментов разработки
      if (!isProduction) {
        // Объединяем конфигурацию, при этом сохраняя любые переопределения из config
        // Но для специфических директив, таких как элементы и атрибуты стилей,
        // расширяем разрешения из devCspConfig, а не заменяем их
        cspConfig = {
          ...devCspConfig,
          ...config.csp,
          // Объединяем значения для специфических директив, а не заменяем их
          connectSrc: [...new Set([...(config.csp.connectSrc || []), ...(devCspConfig.connectSrc || [])])],
          scriptSrc: [...new Set([...(config.csp.scriptSrc || []), ...(devCspConfig.scriptSrc || [])])],
          styleSrc: [...new Set([...(config.csp.styleSrc || []), ...(devCspConfig.styleSrc || [])])],
          scriptSrcElem: [...new Set([...(config.csp.scriptSrcElem || []), ...(devCspConfig.scriptSrcElem || [])])],
          styleSrcElem: [...new Set([...(config.csp.styleSrcElem || []), ...(devCspConfig.styleSrcElem || [])])],
          scriptSrcAttr: [...new Set([...(config.csp.scriptSrcAttr || []), ...(devCspConfig.scriptSrcAttr || [])])],
          styleSrcAttr: [...new Set([...(config.csp.styleSrcAttr || []), ...(devCspConfig.styleSrcAttr || [])])],
          imgSrc: [...new Set([...(config.csp.imgSrc || []), ...(devCspConfig.imgSrc || [])])],
          fontSrc: [...new Set([...(config.csp.fontSrc || []), ...(devCspConfig.fontSrc || [])])],
          defaultSrc: [...new Set([...(config.csp.defaultSrc || []), ...(devCspConfig.defaultSrc || [])])],
        };
      }

      let cspHeader = generateCspHeader(cspConfig);

      // В production добавляем upgrade-insecure-requests и block-all-mixed-content
      if (isProduction) {
        const cspWithUpgrade = { ...cspConfig };
        cspWithUpgrade.upgradeInsecureRequests = true;
        cspWithUpgrade.blockAllMixedContent = true;
        cspHeader = generateCspHeader(cspWithUpgrade);
      }
      res.removeHeader("Content-Security-Policy");
      res.setHeader("Content-Security-Policy", cspHeader);
    }

    // X-Frame-Options
    if (config.frameOptions) {
      res.removeHeader("X-Frame-Options");
      res.setHeader("X-Frame-Options", config.frameOptions);
    }

    // X-Content-Type-Options
    if (config.contentTypeOptions) {
      res.removeHeader("X-Content-Type-Options");
      res.setHeader("X-Content-Type-Options", config.contentTypeOptions);
    }

    // Referrer-Policy
    if (config.referrerPolicy) {
      res.removeHeader("Referrer-Policy");
      res.setHeader("Referrer-Policy", config.referrerPolicy);
    }

    // Permissions-Policy (ранее Feature-Policy)
    if (config.permissionsPolicy) {
      res.removeHeader("Permissions-Policy");
      res.setHeader("Permissions-Policy", generatePermissionsPolicyHeader(config.permissionsPolicy));
    }

    // Strict-Transport-Security (только в production)
    if (isProduction && config.hsts) {
      let hstsValue = `max-age=${config.hsts.maxAge}`;
      if (config.hsts.includeSubDomains) {
        hstsValue += "; includeSubDomains";
      }
      if (config.hsts.preload) {
        hstsValue += "; preload";
      }
      res.removeHeader("Strict-Transport-Security");
      res.setHeader("Strict-Transport-Security", hstsValue);
    }

    // Кастомные заголовки
    if (config.customHeaders) {
      Object.entries(config.customHeaders).forEach(([key, value]) => {
        res.removeHeader(key);
        res.setHeader(key, value);
      });
    }

    next();
  };
}

/**
 * Экспорт дефолтной конфигурации для использования в других частях приложения
 */
export const defaultSecurityHeaders = securityHeaders();
