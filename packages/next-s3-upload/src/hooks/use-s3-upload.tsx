import {
  CompleteMultipartUploadCommandOutput,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Uploader, useUploader } from './use-uploader';
import { FetchHttpHandler } from '@smithy/fetch-http-handler';

type Params = {
  key: string;
  bucket: string;
  token: Record<string, any>;
  region: string;
};

let upload: Uploader<Params> = async (file, params, { onProgress }) => {
  let { key, bucket, token, region } = params;

  // requestChecksumCalculation/responseChecksumValidation disable automatic CRC32
  // checksums added in AWS SDK v3.729.0+. Without this, multipart uploads fail in
  // browsers because the SDK can't compute per-part checksums in browser environments.
  // See: https://github.com/aws/aws-sdk-js-v3/issues/6818
  let client = new S3Client({
    requestHandler: new FetchHttpHandler({ keepAlive: false }),
    credentials: {
      accessKeyId: token.Credentials.AccessKeyId,
      secretAccessKey: token.Credentials.SecretAccessKey,
      sessionToken: token.Credentials.SessionToken,
    },
    region: region,
    // These options are valid in SDK v3.729.0+ but may not be in type definitions
    ...({ requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' }),
  });

  let uploadParams = {
    Bucket: bucket,
    Key: key,
    Body: file,
    CacheControl: 'max-age=630720000, public',
    ContentType: file.type,
  };

  // at some point make this configurable
  // let uploadOptions = {
  //   partSize: 100 * 1024 * 1024,
  //   queueSize: 1,
  // };

  let s3Upload = new Upload({
    client,
    params: uploadParams,
  });

  s3Upload.on('httpUploadProgress', progress => {
    let uploaded = progress.loaded ?? 0;
    onProgress(uploaded);
  });

  let uploadResult = (await s3Upload.done()) as CompleteMultipartUploadCommandOutput;

  let url =
    uploadResult.Bucket && uploadResult.Key
      ? `https://${uploadResult.Bucket}.s3.${region}.amazonaws.com/${uploadResult.Key}`
      : '';

  return {
    url,
    bucket: uploadResult.Bucket ?? '',
    key: uploadResult.Key ?? '',
  };
};

export const useS3Upload = (options?: { endpoint: string }) => {
  let hook = useUploader('aws-sdk', upload, options);
  return hook;
};
