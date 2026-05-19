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
     * Uses caching to avoid thousands of API calls
     * @param {string} relativePath - Relative path from basePath
     * @returns {Promise<boolean>} True if file exists
     */
    async fileExists(relativePath) {
        if (!this.fileCache) {
            await this._initCache();
        }

        const key = this.basePath ? `${this.basePath}/${relativePath}` : relativePath;
        return this.fileCache.has(key);
    }

    /**
     * Initialize file cache by listing all objects in the bucket
     * @private
     */
    async _initCache() {
        console.log('📦 Caching S3 bucket file list...');
        this.fileCache = new Set();

        let continuationToken = null;
        let count = 0;

        try {
            do {
                const params = {
                    Bucket: this.bucketName,
                    Prefix: this.basePath || undefined,
                    ContinuationToken: continuationToken
                };

                const data = await this.s3.listObjectsV2(params).promise();
                if (data.Contents) {
                    data.Contents.forEach(obj => this.fileCache.add(obj.Key));
                    count += data.Contents.length;
                }
                continuationToken = data.NextContinuationToken;

            } while (continuationToken);

            console.log(`✓ Cached ${count} files from S3`);
        } catch (error) {
            console.error('Failed to cache S3 file list:', error);
            // Fallback to no cache if listing fails (though unlikely if getObject works)
            this.fileCache = null;
            throw error;
        }
    }
}

module.exports = S3Loader;
