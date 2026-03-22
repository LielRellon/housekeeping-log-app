// Advanced rate limiting middleware
const rateLimiters = new Map(); // ip -> { count, resetTime }

class RateLimiter {
  constructor(windowMs = 60000, maxRequests = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  middleware() {
    return (req, res, next) => {
      // Disable rate limiting in test environment
      if (process.env.NODE_ENV === 'test') {
        return next();
      }

      const ip = req.ip;
      const now = Date.now();
      
      // Get or create rate limit entry
      let limiter = rateLimiters.get(ip);
      if (!limiter || now > limiter.resetTime) {
        limiter = {
          count: 0,
          resetTime: now + this.windowMs
        };
      }

      // Increment counter
      limiter.count++;
      rateLimiters.set(ip, limiter);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, this.maxRequests - limiter.count));
      res.setHeader('X-RateLimit-Reset', new Date(limiter.resetTime).toISOString());

      // Check if limit exceeded
      if (limiter.count > this.maxRequests) {
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil((limiter.resetTime - now) / 1000)
        });
      }

      next();
    };
  }
}

// Endpoint-specific rate limiters
const endpointLimiters = {
  login: new RateLimiter(15 * 60 * 1000, 5), // 5 attempts per 15 minutes
  api: new RateLimiter(60000, 100), // 100 requests per minute
  general: new RateLimiter(60000, 300) // 300 requests per minute
};

module.exports = {
  RateLimiter,
  endpointLimiters,
  loginRateLimiter: endpointLimiters.login.middleware(),
  apiRateLimiter: endpointLimiters.api.middleware(),
  generalRateLimiter: endpointLimiters.general.middleware()
};
