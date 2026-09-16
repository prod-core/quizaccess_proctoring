/**
 * Storage accessor for the proctoring plugin based on IndexedDB and BroadcastChannel
 *
 * @module      quizaccess_proctoring/utils/storage
 * @copyright   2026 NED {@link http://ned.ca}
 * @author      NED {@link http://ned.ca}
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { init as pluginDBInit } from 'quizaccess_proctoring/plugindb';
import { logger as L } from 'quizaccess_proctoring/utils/log';
import { PLUGIN } from 'quizaccess_proctoring/utils/state';

/** @type {import('quizaccess_proctoring/storageaccessordb').StorageAccessorDB|null} */
let accessor = null;

/** @type {BroadcastChannel|null} */
const channel = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel(PLUGIN + '_storage') : null;

/**
 * Normalize a key: arrays are joined with '_', everything else is stringified
 *
 * @param {string|Array|*} key - The key to normalize, if it's an array - join it by '_'
 *
 * @return {string} - The normalized key
 */
function normaliseKey(key) {
    if (key instanceof Array) {
        key = key.join('_');
    }

    return key.toString();
}

// noinspection JSUnusedGlobalSymbols
/**
 * Check that a full key name and a key are the same
 *
 * @param {string} fullKeyName - The full key name to check
 * @param {string|Array|*} key - The key to check, if it's an array - join it by '_'
 *
 * @return {boolean}
 */
export function keyCheck(fullKeyName, key) {
    return fullKeyName.toString() === normaliseKey(key);
}

/**
 * Init IndexedDB storage accessor from plugindb
 *
 * @param {number} version - The plugin version
 * @param {object|null} options
 *
 * @return {Promise<boolean>} - True if the storage is working, false otherwise
 */
export async function init(version = 0, options=null) {
    if (!version) {
        L.dd("There is no plugin version, can't init storage");
        return false;
    }

    const db = await pluginDBInit(PLUGIN, version, options);
    accessor = db.getStorageAccessorDef();

    return await accessor.isSupported();
}

/**
 * Get a value from the plugin IndexedDB storage
 *
 * @param {string|Array|*} key - The key to get, if it's an array - join it by '_'
 *
 * @return {Promise<*>} - The stored value, or undefined if missing
 */
export async function get(key) {
    if (!accessor) return undefined;

    return await accessor.get(normaliseKey(key));
}

/**
 * Remove a value from the plugin IndexedDB storage
 *
 * @param {string|Array|*} key - The key to remove, if it's an array - join it by '_'
 *
 * @return {Promise<boolean>} - True on success, false otherwise
 */
export async function remove(key) {
    if (!accessor) return false;

    const fullKey = normaliseKey(key);
    let res = await accessor.delete(fullKey);
    if (channel) {
        channel.postMessage({key: fullKey, value: null});
    }

    return res;
}

/**
 * Set a value in the plugin IndexedDB storage and notify other windows
 *
 * @param {string|Array|*} key - The key to set, if it's an array - join it by '_'
 * @param {*} value - The value to store (stored as structured data)
 *
 * @return {Promise<boolean>} - False if the value can't be saved, true otherwise
 */
export async function set(key, value) {
    if (!accessor) return false;

    try {
        const fullKey = normaliseKey(key);
        await accessor.set(fullKey, value);
        if (channel) {
            channel.postMessage({key: fullKey, value: value});
        }
    } catch (error) {
        return false;
    }

    return true;
}

/**
 * Subscribe to cross-window storage change notifications (BroadcastChannel)
 *
 * @param {function({key: string, value: *})} callback
 */
export function setCallbackOnChange(callback) {
    if (!channel || typeof callback !== 'function') return;

    channel.onmessage = (event) => callback(event.data || {});
}

// noinspection JSUnusedGlobalSymbols
/**
 * Check if the storage is supported by the browser
 *
 * @return {Promise<boolean>}
 */
export async function isSupported() {
    if (!accessor) return false;

    return await accessor.isSupported();
}

/**
 * Clear all the storage
 *
 * @return {Promise<boolean>}
 */
export async function clear(){
    if (!accessor) return false;

    await accessor.clear();
    if (channel) {
        channel.postMessage({key: null, value: null});
    }

    return true;
}
