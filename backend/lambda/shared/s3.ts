import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({});

export async function getPresignedPutUrl(
  bucket: string,
  key: string,
  contentType: string,
  expiresIn = 300,
): Promise<string> {
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  return getSignedUrl(s3, command, { expiresIn });
}

export async function getPresignedGetUrl(
  bucket: string,
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3, command, { expiresIn });
}

// Images the apps may upload, with the extension each is stored under. The extension
// always comes from here, never from a client's filename.
export const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * Checks an uploaded object is an allowed image within the size limit. Deletes it when
 * it is not. Returns the reason it was refused, or null when it is acceptable.
 */
export async function checkUploadedImage(bucket: string, key: string): Promise<string | null> {
  let head;
  try {
    head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  } catch {
    return 'photo not found; upload it first';
  }

  const tooLarge = (head.ContentLength ?? 0) > MAX_IMAGE_BYTES;
  const wrongType = !head.ContentType || !IMAGE_EXTENSIONS[head.ContentType];
  if (tooLarge || wrongType) {
    await s3
      .send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
      .catch((error) => console.warn('Could not delete rejected upload:', error));
    return tooLarge ? 'photo is larger than 10 MB' : 'photo must be JPEG, PNG or WebP';
  }
  return null;
}
