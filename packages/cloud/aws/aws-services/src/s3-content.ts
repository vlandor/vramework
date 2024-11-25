import {
  S3Client,
  DeleteObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner'
import { ContentService } from '@vramework/core/services/content-service'
import { Logger } from '@vramework/core/services/logger'

// @ts-ignore
import { getSignedUrl as getCDNSignedUrl } from 'aws-cloudfront-sign'
import { readFile } from 'fs/promises'

export interface S3ContentConfig {
  bucketName: string
  region: string
  endpoint?: string
}

export class S3Content implements ContentService {
  private s3: S3Client

  constructor(
    private config: S3ContentConfig,
    private logger: Logger,
    private signConfig: { keypairId: string; privateKeyString: string }
  ) {
    this.s3 = new S3Client([
      {
        endpoint: this.config.endpoint,
        region: this.config.region,
      },
    ])
  }

  public async signURL(url: string) {
    try {
      return getCDNSignedUrl(url, {
        ...this.signConfig,
        expireTime: Math.round(Date.now() + 3600000),
      })
    } catch {
      this.logger.error(`Error signing url: ${url}`)
      return url
    }
  }

  public async signContentKey(key: string) {
    return this.signURL(`https://${this.config.bucketName}/${key}`)
  }

  public async getUploadURL(Key: string, ContentType: string) {
    const command = new PutObjectCommand({
      Bucket: this.config.bucketName,
      Key,
      ContentType,
    })
    return {
      uploadUrl: await getS3SignedUrl(this.s3, command, {
        expiresIn: 3600,
      }),
      assetKey: Key,
    }
  }

  public async readFile(Key: string) {
    this.logger.debug(`Getting file, key: ${Key}`)
    const response = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key,
      })
    )
    const body = response.Body as any
    const responseDataChunks: any[] = []
    body.on('data', (chunk: any) => responseDataChunks.push(chunk))

    return new Promise<Buffer>((resolve, reject) => {
      body.once('end', () => resolve(Buffer.concat(responseDataChunks)))
      body.on('error', reject)
    })
  }

  public async writeFile(Key: string, buffer: Buffer) {
    try {
      this.logger.debug(`Write file, key: ${Key}`)
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.config.bucketName,
          Key,
          Body: buffer,
        })
      )
      return true
    } catch (e: any) {
      this.logger.error(`Error writing file, key: ${Key}`, e)
      return false
    }
  }

  public async copyFile(Key: string, fromAbsolutePath: string) {
    try {
      this.logger.debug(`Uploading file, key: ${Key} from: ${fromAbsolutePath}`)

      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.config.bucketName,
          Key,
          Body: await readFile(fromAbsolutePath),
        })
      )
      return true
    } catch (e: any) {
      this.logger.error(`Error writing file, key: ${Key}`, e)
      return false
    }
  }

  public async deleteFile(Key: string) {
    try {
      this.logger.debug(`Deleting file, key: ${Key}`)
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.config.bucketName,
          Key,
        })
      )
      return true
    } catch (e: any) {
      this.logger.error(`Error deleting file, key: ${Key}`, e)
      return false
    }
  }
}
