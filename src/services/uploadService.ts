import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';
import dotenv from 'dotenv';

dotenv.config();

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a file buffer to Cloudinary and returns the secure URL.
 * @param buffer - The file buffer to upload.
 * @param folder - The folder in Cloudinary to store the image.
 * @returns Promise<string> - The secure URL of the uploaded image.
 */
export const uploadToCloudinary = (buffer: Buffer, folder: string = 'events'): Promise<string> => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: folder,
                resource_type: 'auto',
                transformation: [
                    { width: 1000, crop: "limit" }, // Resize if larger than 1000px width
                    { quality: "auto" }, // Auto optimize quality
                    { fetch_format: "auto" } // Auto convert to best format (e.g. WebP)
                ]
            },
            (error, result) => {
                if (error) {
                    console.error('Cloudinary upload error:', error);
                    return reject(error);
                }
                if (!result) {
                    return reject(new Error('Cloudinary upload failed: No result returned'));
                }
                resolve(result.secure_url);
            }
        );

        streamifier.createReadStream(buffer).pipe(uploadStream);
    });
};
