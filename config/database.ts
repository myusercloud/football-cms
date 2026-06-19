import path from 'path'

export default ({ env }: { env: any }) => {
  const client = env('DATABASE_CLIENT', 'sqlite')

  const connections: Record<string, any> = {
    sqlite: {
      connection: {
        filename: path.join(
          process.cwd(),
          env('DATABASE_FILENAME', '.tmp/data.db')
        ),
      },
      useNullAsDefault: true,
    },
    postgres: {
      connection: env('DATABASE_URL')
        ? {
            connectionString: env('DATABASE_URL'),
            ssl: { rejectUnauthorized: false },
          }
        : {
            host: env('DATABASE_HOST', '127.0.0.1'),
            port: env.int('DATABASE_PORT', 5432),
            database: env('DATABASE_NAME', 'footballke_cms'),
            user: env('DATABASE_USERNAME', 'postgres'),
            password: env('DATABASE_PASSWORD', 'postgres'),
            ssl: env.bool('DATABASE_SSL', false) ? { rejectUnauthorized: false } : false,
          },
    },
  }

  return {
    connection: {
      client,
      ...connections[client],
      acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
    },
  }
}
