/**
 * Data Service Module
 * Handles local storage persistence
 */

export class DataService {
    constructor(config = {}) {
        this.storage = config.storage || window.localStorage;
        this.prefix = config.prefix || 'dopamine_';
    }

    /**
     * Save data to local storage
     * @param {string} key 
     * @param {any} data 
     */
    async save(key, data) {
        try {
            const serialized = JSON.stringify(data);
            this.storage.setItem(this.prefix + key, serialized);
            return true;
        } catch (e) {
            console.error('Error saving data:', e);
            return false;
        }
    }

    /**
     * Load data from local storage
     * @param {string} key 
     * @param {any} defaultValue 
     */
    async load(key, defaultValue = null) {
        try {
            const data = this.storage.getItem(this.prefix + key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            console.error('Error loading data:', e);
            return defaultValue;
        }
    }

    /**
     * Clear specific data
     * @param {string} key 
     */
    async clear(key) {
        this.storage.removeItem(this.prefix + key);
    }
}
