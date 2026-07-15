export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY ?? '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY ?? '7d',
  },

  sms: {
    sparrow: {
      apiKey: process.env.SMS_SPARROW_API_KEY,
      apiUrl: process.env.SMS_SPARROW_API_URL,
      from: process.env.SMS_SPARROW_FROM ?? 'RoomFinder',
    },
    aakash: {
      apiKey: process.env.SMS_AAKASH_API_KEY,
      apiUrl: process.env.SMS_AAKASH_API_URL,
    },
    twilio: {
      accountSid: process.env.SMS_TWILIO_ACCOUNT_SID,
      authToken: process.env.SMS_TWILIO_AUTH_TOKEN,
      from: process.env.SMS_TWILIO_FROM,
    },
  },

  payments: {
    stripe: {
      secretKey: process.env.PAYMENT_STRIPE_SECRET_KEY,
      webhookSecret: process.env.PAYMENT_STRIPE_WEBHOOK_SECRET,
    },
    esewa: {
      merchantId: process.env.PAYMENT_ESEWA_MERCHANT_ID,
      secret: process.env.PAYMENT_ESEWA_SECRET,
    },
    khalti: {
      secretKey: process.env.PAYMENT_KHALTI_SECRET_KEY,
    },
  },

  s3: {
    bucket: process.env.S3_BUCKET,
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY,
    region: process.env.S3_REGION ?? 'ap-south-1',
    endpoint: process.env.S3_ENDPOINT,
  },

  facebook: {
    appSecret: process.env.FB_APP_SECRET ?? '',
    verifyToken: process.env.FB_WEBHOOK_VERIFY_TOKEN ?? '',
    pageAccessToken: process.env.FB_PAGE_ACCESS_TOKEN ?? '',
  },

  app: {
    baseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
    customerAppBaseUrl: process.env.CUSTOMER_APP_BASE_URL ?? 'http://localhost:5173',
  },
});
