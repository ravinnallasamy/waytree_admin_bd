import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import * as dotenv from "dotenv";
import path from "path";

// Load .env from the current directory
dotenv.config();

const {
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_REGION,
    AWS_S3_BUCKET_NAME
} = process.env;

async function testS3Connection() {
    console.log("🚀 Testing S3 Connection...");
    console.log(`Region: ${AWS_REGION}`);
    console.log(`Bucket: ${AWS_S3_BUCKET_NAME}`);

    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION || !AWS_S3_BUCKET_NAME) {
        console.error("❌ Error: Missing AWS credentials in .env file.");
        console.log("Required fields:");
        console.log("- AWS_ACCESS_KEY_ID");
        console.log("- AWS_SECRET_ACCESS_KEY");
        console.log("- AWS_REGION");
        console.log("- AWS_S3_BUCKET_NAME");
        return;
    }

    const s3Client = new S3Client({
        region: AWS_REGION,
        credentials: {
            accessKeyId: AWS_ACCESS_KEY_ID,
            secretAccessKey: AWS_SECRET_ACCESS_KEY,
        },
    });

    try {
        const command = new ListObjectsV2Command({
            Bucket: AWS_S3_BUCKET_NAME,
            MaxKeys: 1, // We only need to see if we can connect
        });

        const response = await s3Client.send(command);
        console.log("✅ Success! Successfully connected to the S3 bucket.");
        console.log("Bucket Metadata Status Code:", response.$metadata.httpStatusCode);
    } catch (error: any) {
        console.error("❌ Connection Failed!");
        console.error("Error Message:", error.message);
        if (error.name === "InvalidAccessKeyId") {
            console.error("👉 Check if your AWS_ACCESS_KEY_ID is correct.");
        } else if (error.name === "SignatureDoesNotMatch") {
            console.error("👉 Check if your AWS_SECRET_ACCESS_KEY is correct.");
        } else if (error.name === "NoSuchBucket") {
            console.error("👉 Check if your AWS_S3_BUCKET_NAME exists in the specified region.");
        }
    }
}

testS3Connection();
