const webpush = require('web-push');
const fs = require('fs-extra');
const path = require('path');

class VapidKeyManager {
    constructor() {
        this.keysPath = path.join(__dirname, '../../config/vapid-keys.json');
        this.envPath = path.join(__dirname, '../../.env');
        this.keys = null;
    }

    /**
     * Initialize VAPID keys - generate if they don't exist, load if they do
     */
    async initialize() {
        try {
            // Try to load from environment variables first
            if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
                this.keys = {
                    publicKey: process.env.VAPID_PUBLIC_KEY,
                    privateKey: process.env.VAPID_PRIVATE_KEY
                };
                console.log('VAPID keys loaded from environment variables');
                return this.keys;
            }

            // Try to load from file
            if (await fs.pathExists(this.keysPath)) {
                this.keys = await fs.readJson(this.keysPath);
                console.log('VAPID keys loaded from file');
                return this.keys;
            }

            // Generate new keys if none exist
            console.log('Generating new VAPID keys...');
            this.keys = webpush.generateVAPIDKeys();
            
            // Save to file
            await this.saveKeysToFile();
            
            // Update .env file
            await this.updateEnvFile();
            
            console.log('New VAPID keys generated and saved');
            return this.keys;
        } catch (error) {
            console.error('Error initializing VAPID keys:', error);
            throw error;
        }
    }

    /**
     * Save keys to JSON file
     */
    async saveKeysToFile() {
        try {
            // Ensure config directory exists
            await fs.ensureDir(path.dirname(this.keysPath));
            
            // Save keys to file
            await fs.writeJson(this.keysPath, this.keys, { spaces: 2 });
            
            // Set restrictive permissions (Unix-like systems)
            if (process.platform !== 'win32') {
                await fs.chmod(this.keysPath, 0o600);
            }
        } catch (error) {
            console.error('Error saving VAPID keys to file:', error);
            throw error;
        }
    }

    /**
     * Update .env file with VAPID keys
     */
    async updateEnvFile() {
        try {
            let envContent = '';
            
            // Read existing .env if it exists
            if (await fs.pathExists(this.envPath)) {
                envContent = await fs.readFile(this.envPath, 'utf8');
            }

            // Check if VAPID keys already exist in .env
            const hasPublicKey = envContent.includes('VAPID_PUBLIC_KEY=');
            const hasPrivateKey = envContent.includes('VAPID_PRIVATE_KEY=');

            if (!hasPublicKey) {
                envContent += `\nVAPID_PUBLIC_KEY=${this.keys.publicKey}`;
            }
            if (!hasPrivateKey) {
                envContent += `\nVAPID_PRIVATE_KEY=${this.keys.privateKey}`;
            }

            // Add email if not present
            if (!envContent.includes('VAPID_EMAIL=')) {
                envContent += `\nVAPID_EMAIL=your-email@example.com`;
            }

            // Write updated .env file
            if (!hasPublicKey || !hasPrivateKey) {
                await fs.writeFile(this.envPath, envContent.trim() + '\n');
                console.log('.env file updated with VAPID keys');
            }
        } catch (error) {
            console.error('Error updating .env file:', error);
            // Don't throw - this is not critical
        }
    }

    /**
     * Get the public key (safe to expose to client)
     */
    getPublicKey() {
        if (!this.keys) {
            throw new Error('VAPID keys not initialized. Call initialize() first.');
        }
        return this.keys.publicKey;
    }

    /**
     * Get both keys (for server use only)
     */
    getKeys() {
        if (!this.keys) {
            throw new Error('VAPID keys not initialized. Call initialize() first.');
        }
        return this.keys;
    }

    /**
     * Regenerate VAPID keys (use with caution - will invalidate existing subscriptions)
     */
    async regenerateKeys() {
        console.log('Regenerating VAPID keys...');
        this.keys = webpush.generateVAPIDKeys();
        await this.saveKeysToFile();
        await this.updateEnvFile();
        console.log('VAPID keys regenerated');
        return this.keys;
    }
}

module.exports = VapidKeyManager;