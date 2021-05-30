export interface CoreConfig {
  awsRegion: string
  domain: string
  secrets: {
    postgresCredentials: string
    cloudfrontContentId: string
    cloudfrontContentPrivateKey: string
  }
  content: {
    localFileUploadPath: string
  }
  server: {
    port: number
  }
  cookie: {
    name: string
  }
  sql: {
    database: string
    directory: string
  },
  logger: {
    level: string
  }
}
