/**
 * Structured logging utility.
 *
 * In development, logs to console. Can be swapped for a remote service
 * (e.g. Sentry, Datadog) in production by changing the transport here.
 */

type LogLevel = "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, context?: LogContext) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };

  switch (level) {
    case "info":
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(entry));
      break;
    case "warn":
      console.warn(JSON.stringify(entry));
      break;
    case "error":
      console.error(JSON.stringify(entry));
      break;
  }
}

export const logger = {
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, context?: LogContext) => log("error", message, context),
};
