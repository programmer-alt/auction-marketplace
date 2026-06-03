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

// В TransformableInfo `level` типизирован как string, поэтому убираем строгую типизацию.
const colorizedFormat = printf((info: any) => {
  const lvl = (info?.level as string) as LogLevel;
  const color = colors[lvl] ?? colors.info;
  const ts = info?.timestamp ?? '';
  const msg = info?.message ?? '';
  return `\u001b[${color}m${lvl}: ${msg}\u001b[0m`;
});

const fileFormat = printf((info: any) => {
  const lvl = (info?.level as string) ?? 'info';
  const ts = info?.timestamp ?? '';
  const msg = info?.message ?? '';
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
  new (DailyRotateFile as any)({
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
  level: level() as any,
  levels: levels as any,
  format,
  transports,
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        printf((info: any) => `${info.level}: ${info.message}`)
      ),
    })
  );
}

export default logger;

