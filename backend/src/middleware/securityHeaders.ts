import { Request, Response, NextFunction } from 'express';

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
}

/**
 * Конфигурация security headers
 */
export interface SecurityHeadersConfig {
  csp?: CspConfig;
  frameOptions?: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM';
  contentTypeOptions?: 'nosniff';
  referrerPolicy?: 'no-referrer' | 'no-referrer-when-downgrade' | 'origin' | 'origin-when-cross-origin' | 'same-origin' | 'strict-origin' | 'strict-origin-when-cross-origin' | 'unsafe-url';
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
    defaultSrc: 'default-src',
    scriptSrc: 'script-src',
    styleSrc: 'style-src',
    imgSrc: 'img-src',
    fontSrc: 'font-src',
    connectSrc: 'connect-src',
    mediaSrc: 'media-src',
    objectSrc: 'object-src',
    frameSrc: 'frame-src',
    frameAncestors: 'frame-ancestors',
    baseUri: 'base-uri',
    formAction: 'form-action',
  };

  // Обрабатываем директивы с массивами источников
  for (const [key, directiveName] of Object.entries(directiveMap)) {
    const sources = csp[key as keyof CspConfig];
    if (Array.isArray(sources) && sources.length > 0) {
      directives.push(`${directiveName} ${sources.join(' ')}`);
    }
  }

  // Булевые директивы
  if (csp.upgradeInsecureRequests) {
    directives.push('upgrade-insecure-requests');
  }
  if (csp.blockAllMixedContent) {
    directives.push('block-all-mixed-content');
  }

  return directives.join('; ');
}

/**
 * Генерирует строку Permissions-Policy из конфигурации
 */
function generatePermissionsPolicyHeader(policy: Record<string, string[]>): string {
  const directives = Object.entries(policy).map(([feature, origins]) => {
    if (origins.length === 0) {
      return `${feature}=()`;
    }
    return `${feature}=(${origins.join(' ')})`;
  });
  return directives.join(', ');
}

/**
 * Дефолтная конфигурация CSP для приложения Global Auction Marketplace
 */
const defaultCspConfig: CspConfig = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Разрешаем inline скрипты и eval для совместимости
  styleSrc: ["'self'", "'unsafe-inline'"], // Разрешаем inline стили
  imgSrc: ["'self'", "data:", "https:", "http://localhost:*"], // Изображения с любых HTTPS источников и локального сервера
  fontSrc: ["'self'", "data:", "https:"],
  connectSrc: ["'self'", "http://localhost:*", "ws://localhost:*"], // WebSocket и API вызовы
  mediaSrc: ["'self'"],
  objectSrc: ["'none'"], // Запрещаем <object>, <embed>, <applet>
  frameSrc: ["'none'"], // Запрещаем <iframe>, <frame>
  frameAncestors: ["'none'"], // Запрещаем встраивание в iframe (аналогично X-Frame-Options DENY)
  baseUri: ["'self'"],
  formAction: ["'self'"],
  upgradeInsecureRequests: false, // Включать только в production
  blockAllMixedContent: false,
};

/**
 * Дефолтная конфигурация security headers
 */
const defaultSecurityHeadersConfig: SecurityHeadersConfig = {
  csp: defaultCspConfig,
  frameOptions: 'DENY',
  contentTypeOptions: 'nosniff',
  referrerPolicy: 'strict-origin-when-cross-origin',
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
    const isProduction = process.env.NODE_ENV === 'production';

    // Content-Security-Policy
    if (config.csp) {
      let cspHeader = generateCspHeader(config.csp);
      // В production добавляем upgrade-insecure-requests и block-all-mixed-content
      if (isProduction) {
        const cspWithUpgrade = { ...config.csp };
        cspWithUpgrade.upgradeInsecureRequests = true;
        cspWithUpgrade.blockAllMixedContent = true;
        cspHeader = generateCspHeader(cspWithUpgrade);
      }
      res.setHeader('Content-Security-Policy', cspHeader);
    }

    // X-Frame-Options
    if (config.frameOptions) {
      res.setHeader('X-Frame-Options', config.frameOptions);
    }

    // X-Content-Type-Options
    if (config.contentTypeOptions) {
      res.setHeader('X-Content-Type-Options', config.contentTypeOptions);
    }

    // Referrer-Policy
    if (config.referrerPolicy) {
      res.setHeader('Referrer-Policy', config.referrerPolicy);
    }

    // Permissions-Policy (ранее Feature-Policy)
    if (config.permissionsPolicy) {
      res.setHeader('Permissions-Policy', generatePermissionsPolicyHeader(config.permissionsPolicy));
    }

    // Strict-Transport-Security (только в production)
    if (isProduction && config.hsts) {
      let hstsValue = `max-age=${config.hsts.maxAge}`;
      if (config.hsts.includeSubDomains) {
        hstsValue += '; includeSubDomains';
      }
      if (config.hsts.preload) {
        hstsValue += '; preload';
      }
      res.setHeader('Strict-Transport-Security', hstsValue);
    }

    // Кастомные заголовки
    if (config.customHeaders) {
      Object.entries(config.customHeaders).forEach(([key, value]) => {
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