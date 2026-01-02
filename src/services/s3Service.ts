import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

/**
 * Uploads a file buffer to AWS S3.
 * @param buffer - The file buffer to upload.
 * @param fileName - The original filename or a generated one.
 * @param contentType - The MIME type of the file.
 * @param folder - The bucket sub-folder (e.g. 'profiles', 'events', 'members').
 * @returns Promise<string> - The public URL of the uploaded file.
 */
export const uploadToS3 = async (
    buffer: Buffer,
    fileName: string,
    contentType: string,
    folder: string = 'uploads'
): Promise<string> => {
    try {
        const timestamp = Date.now();
        const safeFileName = fileName.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
        const key = `${folder}/${timestamp}-${safeFileName}`;

        const command = new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: contentType,
            // ACL: 'public-read', // Depends on bucket policy, but usually we want them public for easy access
        });

        await s3Client.send(command);

        const url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
        console.log(`📡 [S3 UPLOAD] Success: ${url}`);
        return url;
    } catch (error) {
        console.error('❌ [S3 UPLOAD] Error:', error);
        throw error;
    }
};
