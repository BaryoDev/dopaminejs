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

        // Last write still in flight on promise storage, or null.
        this._tail = null;
    }

    /**
     * Run a write after any write still in flight.
     *
     * Promise storage can finish two overlapping writes in either order, and
     * the older value would win. Synchronous storage never has one in flight,
     * so it still writes before this returns.
     * @private
     */
    _write(op) {
        const result = this._tail ? this._tail.then(op) : op();

        if (typeof result?.then === 'function') {
            const tail = Promise.resolve(result).catch(() => {}).then(() => {
                if (this._tail === tail) this._tail = null;
            });
            this._tail = tail;
        }

        return result;
    }

    /**
     * Save data to local storage
     * @param {string} key 
     * @param {any} data 
     */
    async save(key, data) {
        try {
            const serialized = JSON.stringify(data);
            await this._write(() => this.storage.setItem(this.prefix + key, serialized));
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
            await this._tail;
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
        await this._write(() => this.storage.removeItem(this.prefix + key));
    }
}
