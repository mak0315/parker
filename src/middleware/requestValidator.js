import { logger } from '../utils/logger.js';

const suspiciousPatterns = [
  /(<script[\s>])/i,
  /(union\s+select)/i,
  /(;\s*drop\s+table)/i,
  /(javascript:)/i
];

export function requestValidator(req, res, next) {
  const suspicious = suspiciousPatterns.some(pattern =>
    pattern.test(req.url) || pattern.test(JSON.stringify(req.body))
  );

  if (suspicious) {
    logger.warn(`Suspicious request blocked: ${req.method} ${req.url} from ${req.ip}`);
    return res.status(400).json({
      success: false,
      message: 'Invalid request'
    });
  }

  const contentLength = parseInt(req.headers['content-length'] || '0');
  if (contentLength > 10 * 1024 * 1024) {
    return res.status(413).json({
      success: false,
      message: 'Request entity too large'
    });
  }

  next();
}
