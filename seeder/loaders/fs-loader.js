const fs = require('fs').promises;
const path = require('path');

/**
 * Filesystem loader for local development
 * Loads Pokemon data files from mounted volume
 */
class FileSystemLoader {
    constructor(baseDir) {
        this.baseDir = baseDir; // e.g., '/poff-assets' or './poff-assets'
        console.log(`FileSystemLoader initialized with baseDir: ${this.baseDir}`);
    }

    /**
     * Load a file from the filesystem
     * @param {string} relativePath - Relative path from baseDir
     * @returns {Promise<string>} File contents
     */
    async loadFile(relativePath) {
        const fullPath = path.join(this.baseDir, relativePath);
        try {
            const content = await fs.readFile(fullPath, 'utf-8');
            return content;
        } catch (error) {
            console.error(`Failed to load file: ${fullPath}`, error.message);
            throw error;
        }
    }

    /**
     * Check if a file exists
     * @param {string} relativePath - Relative path from baseDir
     * @returns {Promise<boolean>} True if file exists
     */
    async fileExists(relativePath) {
        const fullPath = path.join(this.baseDir, relativePath);
        try {
            await fs.access(fullPath);
            return true;
        } catch {
            return false;
        }
    }
}

module.exports = FileSystemLoader;
