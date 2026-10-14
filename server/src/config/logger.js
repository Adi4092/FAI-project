const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const currentLevel = process.env.NODE_ENV === 'test' ? 'error' : (process.env.LOG_LEVEL || 'info');

function formatMessage(level, message, meta = '') {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${typeof meta === 'object' ? JSON.stringify(meta) : meta}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

export const logger = {
  error(msg, meta) {
    if (levels[currentLevel] >= levels.error) {
      console.error(formatMessage('error', msg, meta));
    }
  },
  warn(msg, meta) {
    if (levels[currentLevel] >= levels.warn) {
      console.warn(formatMessage('warn', msg, meta));
    }
  },
  info(msg, meta) {
    if (levels[currentLevel] >= levels.info) {
      console.log(formatMessage('info', msg, meta));
    }
  },
  debug(msg, meta) {
    if (levels[currentLevel] >= levels.debug) {
      console.log(formatMessage('debug', msg, meta));
    }
  }
};
