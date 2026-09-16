// noinspection JSUnusedGlobalSymbols

/**
 * Table accessor for IndexedDB operations
 * Usually used by 'plugindb' module
 *
 * @module      quizaccess_proctoring/storageaccessordb
 * @package     quizaccess_proctoring
 * @copyright   2026 NED {@link http://ned.ca}
 * @author      NED {@link http://ned.ca}
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

class StorageAccessorDB {
    /** @type IDBDatabase */
    _db;
    /** @type string */
    _table_name = '';

    /**
     * @param {IDBDatabase} db - The pluginDB instance with initialized _db
     * @param {string} table_name - The name of the table (object store) to work with
     */
    constructor(db, table_name) {
        this._db = db;
        this._table_name = table_name;
    }

    /**
     * @return {string}
     */
    getTableName(){
        return this._table_name;
    }

    /**
     * Execute a request within a transaction.
     *
     * @param {function(IDBObjectStore): IDBRequest} callback - Function that receives the object store and returns IDBRequest
     * @param {boolean} readonly - true, if operation is read-only (more optimized, default: false)
     * @param {*|undefined} onsuccess_res - Optional result to return on success, if not provided, returns request result
     * @param {function|undefined} onsuccess_callback - Optional callback to process result, if provided, returns callback result
     *
     * @return {Promise<*>} Promise that resolves with request result
     * @protected
     */
    async _execRequest(callback, readonly=false, onsuccess_res=undefined, onsuccess_callback=undefined) {
        if (!this._db) {
            throw new Error("Database is not initialized");
        }

        const transaction = this._db.transaction(this._table_name, readonly ? 'readonly' : 'readwrite');
        const store = transaction.objectStore(this._table_name);

        return new Promise((resolve, reject) => {
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);

            try {
                const request = callback(store);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    let res = onsuccess_res === undefined ? request.result : onsuccess_res;
                    if (onsuccess_callback && typeof onsuccess_callback === 'function'){
                        resolve(onsuccess_callback(res));
                    } else {
                        resolve(res);
                    }
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Get a value by key from the table.
     *
     * @param {*|string} key - The key to retrieve
     *
     * @return {Promise<*>} The value associated with the key
     */
    async get(key) {
        return await this._execRequest((store) => store.get(key), true);
    }

    /**
     * Put a value into the table.
     * Suitable only if the table was configured properly (has a keyPath or autoIncrement)
     *
     * @param {*|string} key - key
     * @param {*} value - The value to store
     *
     * @return {Promise<*>} The the stored value if it was successful
     */
    async set(key, value) {
        return await this._execRequest((store) => store.put(value, key), false, value);
    }

    /**
     * Put a value into the table.
     * Without key suitable only if the table was configured properly (has a keyPath or autoIncrement)
     *
     * @param {*} value - The value to store
     * @param {*} key - Optional key (if not provided, uses keyPath or autoIncrement)
     *
     * @return {Promise<*>} The key of the stored value
     */
    async put(value, key = undefined) {
        return await this._execRequest((store) =>
            key !== undefined ? store.put(value, key) : store.put(value)
        );
    }

    /**
     * Add a value into the table,
     *  the same as {@see this.put()}, but produce error if key already exists
     * Without key suitable only if the table was configured properly (has a keyPath or autoIncrement)
     *
     * @param {*} value - The value to store
     * @param {*} key - Optional key (if not provided, uses keyPath or autoIncrement)
     *
     * @return {Promise<*>} The key of the stored value
     */
    async add(value, key = undefined) {
        return await this._execRequest((store) =>
            key !== undefined ? store.add(value, key) : store.add(value)
        );
    }

    /**
     * Delete a value by key from the table.
     *
     * @param {*} key - The key to delete
     *
     * @return {Promise<boolean>} - return true on success
     */
    async delete(key) {
        return await this._execRequest((store) => store.delete(key), false, true);
    }

    /**
     * Get all values from the table.
     *
     * @return {Promise<Array>} Array of all values in the table
     */
    async getAll() {
        return await this._execRequest((store) => store.getAll(), true);
    }

    /**
     * Get all keys from the table.
     *
     * @return {Promise<Array>} Array of all keys in the table
     */
    async getAllKeys() {
        return await this._execRequest((store) => store.getAllKeys(), true);
    }

    /**
     * Clear all values from the table.
     *
     * @return {Promise<boolean>} - return true on success
     */
    async clear() {
        return await this._execRequest((store) => store.clear(), false, true);
    }

    /**
     * Count the number of records in the table.
     *
     * @return {Promise<number>} The count of records
     */
    async count() {
        return await this._execRequest((store) => store.count(), true);
    }

    /**
     * Check if a key exists in the table.
     *
     * @param {*} key - The key to check
     *
     * @return {Promise<boolean>} True if the key exists
     */
    async hasKey(key) {
        const value = await this.get(key);
        return value !== undefined;
    }

    /**
     * Check if a key exists in the table.
     *
     * @param {IDBValidKey|IDBKeyRange} query - The key or key range that identifies the record to be retrieved.
     *
     * @return {Promise<string|*>} the key for the first record matching the given key or key range
     */
    async getKey(query) {
        return await this._execRequest((store) => store.getKey(query), true);
    }

    /**
     * Open a cursor for manual iteration.
     *
     * Normally you should provide callback (if you are interested in more then one value),
     *  to process cursor values through continue() method.
     * See official example: [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBCursorWithValue)
     * Note: callback return result as result of this method after processing first cursor value - all others values are processed in parallel (as custom events)
     *
     * @param {IDBValidKey|IDBKeyRange} query - Optional key or key range, if undefined - open cursor for all records
     * @param {IDBCursorDirection} direction - Optional direction: 'next', 'nextunique', 'prev', 'prevunique' (default: 'next')
     * @param {function(IDBCursorWithValue|null): *|undefined} callback - Function that process the cursor object and returns something as method result
     *
     * @return {Promise<IDBCursorWithValue|null>} Promise that resolves with cursor or null if no records
     */
    async openCursor(query = undefined, direction = 'next', callback=undefined) {
        return await this._execRequest((store) =>
                query !== undefined ? store.openCursor(query, direction) : store.openCursor(),
            true, undefined, callback
        );
    }

    /**
     * Open a key cursor for manual iteration (keys only, no values).
     *
     * Normally you should provide callback (if you are interested in more then one key),
     *  to process cursor keys through continue() method.
     * See official example: [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBCursor)
     * Note: callback return result as result of this method after processing first cursor key - all others keys are processed in parallel (as custom events)
     *
     * @param {IDBValidKey|IDBKeyRange} query - Optional key or key range, if undefined - open cursor for all records
     * @param {IDBCursorDirection} direction - Optional direction: 'next', 'nextunique', 'prev', 'prevunique' (default: 'next')
     * @param {function(IDBCursor|null): *|undefined} callback - Function that process the key cursor object and returns something as method result
     *
     * @return {Promise<IDBCursor|null>} Promise that resolves with cursor or null if no records
     */
    async openKeyCursor(query = undefined, direction = 'next', callback=undefined) {
        return await this._execRequest((store) =>
                query !== undefined ? store.openKeyCursor(query, direction) : store.openKeyCursor(),
            true, undefined, callback
        );
    }

    /**
     * Check if storage is supported by the browser.
     *
     * @return {Promise<boolean>}
     */
    async isSupported(){
        let testKey = '__storage_test__'+Math.random();
        let testValue = Math.random();
        let res = false;
        try {
            await this.set(testKey, testValue);
            let value = await this.get(testKey);
            res = value === testValue;
            await this.delete(testKey);
        } catch (error){
            return false;
        }

        return res;
    }
}

export { StorageAccessorDB };
