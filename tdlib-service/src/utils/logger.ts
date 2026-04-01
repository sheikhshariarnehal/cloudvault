const MAX_LOGS = 100;

export interface LogEntry {
  type: "info" | "error" | "warn";
  msg: string;
  timestamp: string;
}

const logBuffer: LogEntry[] = [];

const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

function addLog(type: LogEntry["type"], args: any[]) {
  const msg = args.map(a => {
    if (a instanceof Error) return a.message;
    if (typeof a === 'object') {
      try {
        return JSON.stringify(a);
      } catch (e) {
        return String(a);
      }
    }
    return String(a);
  }).join(' ');

  logBuffer.push({ msg, type, timestamp: new Date().toISOString() });
  if (logBuffer.length > MAX_LOGS) {
    logBuffer.shift();
  }
}

export function initLogger() {
  console.log = function(...args) {
    addLog('info', args);
    originalLog.apply(console, args as any);
  };

  console.error = function(...args) {
    addLog('error', args);
    originalError.apply(console, args as any);
  };

  console.warn = function(...args) {
    addLog('warn', args);
    originalWarn.apply(console, args as any);
  };
}

export function getLogs(): LogEntry[] {
  return [...logBuffer];
}
