import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

import type { ServerConfig } from "../config";

export type CloudinaryRuntimeConfig = Pick<
  ServerConfig,
  "cloudinaryCloudName" | "cloudinaryApiKey" | "cloudinaryApiSecret" | "cloudinaryFolder"
>;

export type UploadedCloudinaryImage = {
  cloudinaryPublicId: string;
  sourceUrl: string;
  displayUrl: string;
  width?: number;
  height?: number;
  format?: string;
};

export function isCloudinaryConfigured(config: CloudinaryRuntimeConfig): boolean {
  return Boolean(config.cloudinaryCloudName && config.cloudinaryApiKey && config.cloudinaryApiSecret);
}

function configureCloudinary(config: CloudinaryRuntimeConfig): void {
  if (!isCloudinaryConfigured(config)) {
    throw new Error("Cloudinary is not configured.");
  }

  cloudinary.config({
    cloud_name: config.cloudinaryCloudName!,
    api_key: config.cloudinaryApiKey!,
    api_secret: config.cloudinaryApiSecret!,
    secure: true,
  });
}

export function uploadImageToCloudinary(
  config: CloudinaryRuntimeConfig,
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }
): Promise<UploadedCloudinaryImage> {
  configureCloudinary(config);

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: config.cloudinaryFolder,
        resource_type: "image",
        use_filename: true,
        unique_filename: true,
        overwrite: false,
      },
      (error, result?: UploadApiResponse) => {
        if (error || !result) {
          reject(error || new Error("Cloudinary upload response was empty."));
          return;
        }

        resolve({
          cloudinaryPublicId: result.public_id,
          sourceUrl: result.secure_url,
          displayUrl: result.secure_url,
          ...(result.width ? { width: result.width } : {}),
          ...(result.height ? { height: result.height } : {}),
          ...(result.format ? { format: result.format } : {}),
        });
      }
    );

    uploadStream.end(file.buffer);
  });
}
