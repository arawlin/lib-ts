import pino from 'pino'
import { createStream } from 'rotating-file-stream'
import { existsSync, mkdirSync } from 'fs'

export interface LogConfig {
  /**
   * The directory where log files will be stored
   * @default './logs'
   */
  logDir?: string

  /**
   * The log level to use
   *
   * NODE_ENV is used to determine the default level:
   * - 'production' defaults to 'info'
   * - other environments default to 'debug'
   *
   * @default 'info'
   */
  level?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace'

  /**
   * The base name for log files (without extension)
   * @default 'app'
   */
  fileName?: string

  /**
   * The size limit for log files, rotating when exceeded
   * @default '10M'
   */
  fileSize?: string

  /**
   * Number of rotated files to keep
   * @default 10
   */
  maxFiles?: number

  /**
   * Whether to compress rotated files
   * @default true
   */
  compress?: boolean
}

/**
 * Creates a logger instance with date-based file rotation
 */
export function createLogger(config: LogConfig = {}): pino.Logger {
  const {
    logDir = './logs',
    level = process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    fileName = 'app',
    fileSize = '10M',
    maxFiles = 10,
    compress = true,
  } = config

  // Ensure log directory exists
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true })
  }

  // Create rotating file stream with date-based rotation
  const fileStream = createStream(
    (time: Date | number | string, index?: number) => {
      if (!time) {
        return `${fileName}.log`
      }

      const date = time instanceof Date ? time : new Date(time)
      const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD format

      if (index) {
        return `${fileName}-${dateStr}.${index}.log${compress ? '.gz' : ''}`
      }

      return `${fileName}-${dateStr}.log${compress ? '.gz' : ''}`
    },
    {
      path: logDir,
      size: fileSize,
      interval: '1d', // rotate daily
      maxFiles,
      compress: compress ? 'gzip' : false,
    },
  )

  const logger = pino(
    {
      level,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => {
          return { level: label }
        },
      },
      serializers: {
        err: pino.stdSerializers.err,
      },
    },
    pino.multistream([
      { stream: pino.transport({ target: 'pino-pretty' }), level },
      { stream: fileStream, level },
    ]),
  )

  return logger
}

/**
 * Default logger instance with standard configuration
 */
export const logger = createLogger()

/**
 * Creates a child logger with additional context
 */
export function createChildLogger(context: Record<string, unknown>, config?: LogConfig): pino.Logger {
  const parentLogger = config ? createLogger(config) : logger
  return parentLogger.child(context)
}

/**
 * Log levels enum for convenience
 */
export enum LogLevel {
  FATAL = 'fatal',
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace',
}
