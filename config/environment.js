// Environment validation
require('dotenv').config();

const requiredVars = [
  'PORT',
  'NODE_ENV',
  'ADMIN_PASSWORD'
];

const optionalVars = {
  'DATABASE_PATH': 'database/cleanings.db',
  'SESSION_TTL_MINUTES': '15',
  'LOG_LEVEL': 'info',
  'CORS_ORIGIN': 'http://localhost:3000'
};

function validateEnvironment() {
  const errors = [];

  // Check required variables
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  });

  // Validate specific values
  if (process.env.NODE_ENV && !['development', 'production', 'test'].includes(process.env.NODE_ENV)) {
    errors.push('NODE_ENV must be one of: development, production, test');
  }

  if (process.env.PORT && isNaN(parseInt(process.env.PORT))) {
    errors.push('PORT must be a valid number');
  }

  if (process.env.SESSION_TTL_MINUTES && isNaN(parseInt(process.env.SESSION_TTL_MINUTES))) {
    errors.push('SESSION_TTL_MINUTES must be a valid number');
  }

  // Set defaults for optional variables
  Object.entries(optionalVars).forEach(([varName, defaultValue]) => {
    if (!process.env[varName]) {
      process.env[varName] = defaultValue;
    }
  });

  if (errors.length > 0) {
    console.error('❌ Environment validation failed:');
    errors.forEach(err => console.error(`   - ${err}`));
    process.exit(1);
  }

  console.log('✓ Environment validation passed');

  return {
    PORT: parseInt(process.env.PORT),
    NODE_ENV: process.env.NODE_ENV,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    DATABASE_PATH: process.env.DATABASE_PATH,
    SESSION_TTL_MINUTES: parseInt(process.env.SESSION_TTL_MINUTES),
    LOG_LEVEL: process.env.LOG_LEVEL,
    CORS_ORIGIN: process.env.CORS_ORIGIN
  };
}

module.exports = {
  validateEnvironment,
  requiredVars,
  optionalVars
};
