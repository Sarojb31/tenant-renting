import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),

  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRY: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRY: Joi.string().default('7d'),

  // SMS — optional at startup; validated when SMS feature is invoked
  SMS_SPARROW_API_KEY: Joi.string().optional().allow(''),
  SMS_SPARROW_API_URL: Joi.string().optional().allow(''),
  SMS_TWILIO_ACCOUNT_SID: Joi.string().optional().allow(''),
  SMS_TWILIO_AUTH_TOKEN: Joi.string().optional().allow(''),

  // Payments — optional at startup
  PAYMENT_STRIPE_SECRET_KEY: Joi.string().optional().allow(''),
  PAYMENT_STRIPE_WEBHOOK_SECRET: Joi.string().optional().allow(''),
  PAYMENT_ESEWA_MERCHANT_ID: Joi.string().optional().allow(''),
  PAYMENT_ESEWA_SECRET: Joi.string().optional().allow(''),
  PAYMENT_KHALTI_SECRET_KEY: Joi.string().optional().allow(''),

  // S3 — optional at startup
  S3_BUCKET: Joi.string().optional().allow(''),
  S3_ACCESS_KEY: Joi.string().optional().allow(''),
  S3_SECRET_KEY: Joi.string().optional().allow(''),
  S3_REGION: Joi.string().default('ap-south-1'),
  S3_ENDPOINT: Joi.string().optional().allow(''),

  APP_BASE_URL: Joi.string().default('http://localhost:3000'),
  CUSTOMER_APP_BASE_URL: Joi.string().default('http://localhost:5173'),

  // Phase 3 — optional
  FB_APP_SECRET: Joi.string().optional().allow(''),
  FB_PAGE_ACCESS_TOKEN: Joi.string().optional().allow(''),
  FB_WEBHOOK_VERIFY_TOKEN: Joi.string().optional().allow(''),
});
