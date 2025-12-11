const AWS = require('aws-sdk');

/**
 * S3 loader for GitHub Actions / production
 * Loads Pokemon data files from S3 bucket
 */
class S3Loader {
    constructor(bucketName, basePath = '') {
        this.s3 = new AWS.S3();
        this.bucketName = bucketName;
        this.basePath = basePath;
        console.log(`S3Loader initialized with bucket: ${this.bucketName}, basePath: ${this.basePath}`);
    }

    /**
     * Load a file from S3
     * @param {string} relativePath - Relative path from basePath
     * @returns {Promise<string>} File contents
     */
    async loadFile(relativePath) {
        const key = this.basePath ? `${this.basePath}/${relativePath}` : relativePath;
        const params = {
            Bucket: this.bucketName,
            Key: key
        };

        try {
            const data = await this.s3.getObject(params).promise();
            return data.Body.toString('utf-8');
        } catch (error) {
            console.error(`Failed to load S3 object: s3://${this.bucketName}/${key}`, error.message);
            throw error;
        }
    }

    /**
     * Check if a file exists in S3
     * @param {string} relativePath - Relative path from basePath
     * @returns {Promise<boolean>} True if file exists
     */
    async fileExists(relativePath) {
        const key = this.basePath ? `${this.basePath}/${relativePath}` : relativePath;
        try {
            await this.s3.headObject({ Bucket: this.bucketName, Key: key }).promise();
            return true;
        } catch {
            return false;
        }
    }
}

module.exports = S3Loader;
