import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

import * as path from 'path';

const { combine, timestamp, printf, colorize } = winston.format;

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
} as const;

type LogLevel = keyof typeof levels;

// Safe type for Winston log info (flexible internal structure)
interface LogInfo {
  level?: unknown;
  message?: unknown;
  timestamp?: unknown;
  [key: string]: unknown;
}

const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return (isDevelopment ? 'debug' : 'warn') as LogLevel;
};

const colors: Record<LogLevel, string> = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

const colorizedFormat = printf((info: LogInfo) => {
  const lvl = String(info?.level ?? 'info');
  const safeLevel = (lvl in colors ? lvl : 'info') as LogLevel;
  const color = colors[safeLevel];
  const msg = String(info?.message ?? '');
  return `\u001b[${color}m${lvl}: ${msg}\u001b[0m`;
});

const fileFormat = printf((info: LogInfo) => {
  const lvl = String(info?.level ?? 'info');
  const ts = String(info?.timestamp ?? '');
  const msg = String(info?.message ?? '');
  return `[${ts}] ${lvl}: ${msg}`;
});

const format = combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), colorizedFormat);

const transports: winston.transport[] = [
  new DailyRotateFile({
    filename: path.join(process.cwd(), 'logs', 'application-%DATE%.log'),

    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    level: 'info',
    format: fileFormat,
  }),
  new (DailyRotateFile as unknown as new (options: object) => winston.transport)({
    filename: path.join(process.cwd(), 'logs', 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    level: 'error',
    format: fileFormat,
  }),
];

const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        printf((info: LogInfo) => `${String(info.level ?? '')}: ${String(info.message ?? '')}`)
      ),
    })
  );
}

export default logger;

