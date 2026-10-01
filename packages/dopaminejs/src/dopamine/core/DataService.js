/**
 * Data Service Module
 * Handles local storage persistence
 *
 * The storage may be synchronous (localStorage) or return promises
 * (AsyncStorage, an IndexedDB wrapper, a server call). Every call is awaited.
 */

import { resolveStorage } from '../utils/storage.js';

export class DataService {
    constructor(config = {}) {
        this.storage = config.storage || resolveStorage();
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
            await this.storage.setItem(this.prefix + key, serialized);
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
            const data = await this.storage.getItem(this.prefix + key);
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
        await this.storage.removeItem(this.prefix + key);
    }
}
