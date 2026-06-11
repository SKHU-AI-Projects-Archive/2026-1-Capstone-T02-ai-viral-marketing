#!/usr/bin/env node

import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: "dclso5c4s",
  api_key: "175832432193613",
  api_secret: "cOnBeqyebPZcfBpaMdUMFR_dbIk",
  secure: true,
});

const sampleImageUrl = "https://res.cloudinary.com/demo/image/upload/sample.jpg";

async function main() {
  const uploaded = await cloudinary.uploader.upload(sampleImageUrl, {
    folder: "ovms-onboarding",
    overwrite: false,
  });

  console.log("Uploaded secure URL:");
  console.log(uploaded.secure_url);
  console.log("Uploaded public ID:");
  console.log(uploaded.public_id);

  const details = await cloudinary.api.resource(uploaded.public_id);

  console.log("Image metadata:");
  console.log(`width: ${details.width}`);
  console.log(`height: ${details.height}`);
  console.log(`format: ${details.format}`);
  console.log(`bytes: ${details.bytes}`);

  const transformedUrl = cloudinary.url(uploaded.public_id, {
    secure: true,
    // f_auto lets Cloudinary choose the best image format for the browser.
    fetch_format: "auto",
    // q_auto lets Cloudinary choose a balanced quality level automatically.
    quality: "auto",
  });

  console.log("Done! Click link below to see optimized version of the image. Check the size and the format.");
  console.log(transformedUrl);
}

main().catch((error) => {
  console.error("Cloudinary onboarding failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
