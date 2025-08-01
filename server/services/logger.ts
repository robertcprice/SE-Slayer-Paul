interface LogEntry {
  timestamp: string;
  level: 'info' | 'error' | 'warn' | 'debug' | 'request';
  message: string;
  details?: any;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
}

type LogSubscriber = (log: LogEntry) => void;

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 logs
  private subscribers: Set<LogSubscriber> = new Set();

  log(level: LogEntry['level'], message: string, details?: any) {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(details && { details })
    };

    this.addLog(logEntry);
  }

  logRequest(method: string, endpoint: string, statusCode: number, duration: number) {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'request',
      message: `${method} ${endpoint}`,
      method,
      endpoint,
      statusCode,
      duration
    };

    this.addLog(logEntry);
  }

  private addLog(log: LogEntry) {
    this.logs.push(log);
    
    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Notify all subscribers
    this.subscribers.forEach(subscriber => {
      try {
        subscriber(log);
      } catch (error) {
        console.error('Error in log subscriber:', error);
      }
    });
  }

  getLogs(limit?: number): LogEntry[] {
    if (limit) {
      return this.logs.slice(-limit);
    }
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  clear(): void {
    this.clearLogs();
  }

  request(method: string, endpoint: string, statusCode: number, duration: number) {
    this.logRequest(method, endpoint, statusCode, duration);
  }

  subscribe(callback: LogSubscriber): () => void {
    this.subscribers.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  info(message: string, details?: any) {
    this.log('info', message, details);
  }

  error(message: string, details?: any) {
    this.log('error', message, details);
  }

  warn(message: string, details?: any) {
    this.log('warn', message, details);
  }

  debug(message: string, details?: any) {
    this.log('debug', message, details);
  }
}

// Global logger instance
export const logger = new Logger();

// Middleware to log HTTP requests
export function requestLoggerMiddleware(req: any, res: any, next: any) {
  const start = Date.now();
  const originalSend = res.send;

  res.send = function(body: any) {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    
    logger.logRequest(req.method, req.originalUrl, statusCode, duration);
    
    return originalSend.call(this, body);
  };

  next();
}

// Override console methods to capture logs
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

console.log = (...args) => {
  logger.info(args.join(' '));
  originalConsoleLog.apply(console, args);
};

console.error = (...args) => {
  logger.error(args.join(' '));
  originalConsoleError.apply(console, args);
};

console.warn = (...args) => {
  logger.warn(args.join(' '));
  originalConsoleWarn.apply(console, args);
};

console.info = (...args) => {
  logger.info(args.join(' '));
  originalConsoleInfo.apply(console, args);
};