export default ({ env }: { env: any }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET', 'change-me-in-production'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT', 'change-me-in-production'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT', 'change-me-in-production'),
    },
  },
})
