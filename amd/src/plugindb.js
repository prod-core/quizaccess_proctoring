// noinspection JSUnresolvedReference,JSUnusedGlobalSymbols,NpmUsedModulesInstalled

/**
 * Plugin DB modal
 * Require 'storageaccessordb' module
 *
 * @module      quizaccess_proctoring/plugindb
 * @package     quizaccess_proctoring
 * @copyright   2026 NED {@link http://ned.ca}
 * @author      NED {@link http://ned.ca}
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import * as Log from 'core/loglevel';
import {StorageAccessorDB} from 'quizaccess_proctoring/storageaccessordb';

/**
 *
 * @param {string} plugin
 * @param {number} version
 * @param {object|null} options
 *
 * @return {Promise<*>}
 */
export const init = async(plugin, version=0, options=null) => {
    return await PluginDB.get_plugin_object(plugin, version, options);
};

class PluginDB {
    static _objects = {};
    static _constructor_allow = false;

    // settings
    _detail_debug = true;
    _use_def_storage = true;
    _def_storage_name = 'cfg';

    _plugin = '';
    _db_name = '';
    _version = 0;
    _log;
    _options = null;
    _is_supported = false;
    /** @type IDBDatabase */
    _db;
    /** @type IDBOpenDBRequest */
    _request;
    _init_status = 0;
    _init_flag = 0;

    ignore_call_option = false;

    // Declared as a normal static property
    static C;

    // Static initialization block freezes the property upon class evaluation
    static {
        this.C = Object.freeze({
            STATUS_INIT_NONE: 0,
            STATUS_INIT_PROGRESS: 1,
            STATUS_INIT_UPD: 2,
            STATUS_INIT_DONE: 3,
            STATUS_INIT_ERROR: -1,

            FLAG_NONE: 0,
            FLAG_DELETE_DB: 1,
            FLAG_REINIT_DB: 2,
        });
    }

    /**
     * Use this instead of constructor
     *
     * @param {string} plugin
     * @param {number} version
     * @param {object|null} options
     * @param {boolean} recreate
     *
     * @return {Promise<this>}
     */
    static async get_plugin_object(plugin, version=0, options=[], recreate=false){
        if (recreate || !this._objects[plugin]){
            this._constructor_allow = true;
            this._objects[plugin] = new this(plugin, version, options);
            this._constructor_allow = false;
            await this._objects[plugin].fullInit();
        }

        return this._objects[plugin];
    }

    /**
     * constructor, but do not use it, use get_plugin_object() method instead
     *
     * @param {string} plugin
     * @param {number} version
     * @param {object|null} options
     */
    constructor(plugin, version=0, options=null) {
        if (!this.constructor._constructor_allow){
            throw new TypeError("Cannot construct pluginDB instances directly, use static get_plugin_object() method!");
        }

        this._plugin = plugin;
        this._version = version || 1;
        this._options = options;
        this._init_status = this.constructor.C.STATUS_INIT_NONE;
    }

    /**
     * @return {Promise<void>}
     */
    async fullInit(){
        this._init();
        await this._initDB();
    }

    /**
     * @return {boolean}
     */
    isSupported(){
        return this._is_supported;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @param {boolean} val
     */
    set_detail_debug(val){
        this._detail_debug = val;

        this._dd = (this._detail_debug && this._log) ? this._log.debug.bind(this) : () => {};
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @return {boolean}
     */
    get_detail_debug(){
        return this._detail_debug;
    }

    /**
     * @return {void}
     * @protected
     */
    _init(){
        this._callOpt('before_init');

        if (this._hasOption('ignore_init')){
            // Init from options
            this._callOpt('init');
        } else {
            // Init Log
            let log_prefix = this._hasOption('log_prefix') || `[${this._plugin}::DB]`;

            // noinspection JSPotentiallyInvalidConstructorUsage
            this._log = new Log.default.constructor(log_prefix);
            this._log.originalFactory = this._log.methodFactory;
            this._log.methodFactory = (methodName, logLevel) => this._log.originalFactory(methodName, logLevel).bind(this._log, log_prefix);
            this._log.setLevel(this._hasOption('log_level') || this._log.getLevel());

            this._debug = this._log.debug.bind(this);
            this._info = this._log.info.bind(this);
            this._warn = this._log.warn.bind(this);
            this._error = this._log.error.bind(this);

            this.set_detail_debug(this._options ? this._options.detail_debug : this._detail_debug);

            // Init db name
            this._db_name = this._hasOption('db_name') || this._plugin;

            // End init
            this._dd(`Init pluginDB '${this._db_name}': ${this._version}`);
        }

        this._callOpt('after_init');
    }

    /**
     * @return {Promise<boolean>}
     * @protected
     */
    async _initDB(){
        let res = await this._callOptReturnAsync('_initDB');
        if (!isU(res)) return res;

        this._checkSupportedDB();
        if (!this._is_supported) return false;

        res = await this._initOpenIndexedDB();
        // call afterInit in any case
        return await this._afterInitOpenIndexedDB() && res;
    }

    /**
     * @return {void}
     * @protected
     */
    _checkSupportedDB(){
        if (this._callOpt('_checkSupportedDB')) return;

        this._is_supported = false;
        if (!window.indexedDB){
            window.indexedDB = window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
        }

        if (!window.indexedDB){
            this._error("indexedDB is not supported!")
            return;
        }

        if (!window.IDBTransaction){
            window.IDBTransaction = window.webkitIDBTransaction || window.msIDBTransaction;
        }
        if (!window.IDBKeyRange){
            window.IDBKeyRange = window.webkitIDBKeyRange || window.msIDBKeyRange;
        }

        if (!this._db_name){
            this._error("Provide DB name or allow init process!")
            return;
        }

        this._is_supported = true;
    }

    /**
     * @return {Promise<boolean>}
     * @protected
     */
    async _initOpenIndexedDB(){
        let res = await this._callOptReturnAsync('_initOpenIndexedDB');
        if (!isU(res)) return res;

        return await new Promise((resolve) => {
            this._init_status = this.constructor.C.STATUS_INIT_PROGRESS;

            this._request = window.indexedDB.open(this._db_name, this._version);
            this._request.onupgradeneeded = async (event) => {
                this._init_status = this.constructor.C.STATUS_INIT_UPD;
                this._use_db(event.target.result || this._request.result);
                await this._onupgradeneeded(event);
            };

            this._request.onerror = async (event) => {
                let res = await this._callOptReturnAsync('initdb_onerror');
                if (!isU(res)) return resolve(res);

                this._init_status = this.constructor.C.STATUS_INIT_ERROR;
                let error = event.target.error || this._request.error;
                if (error.name === 'VersionError'){
                    // noinspection JSCheckFunctionSignatures
                    if (await this._processVersionError(event)) return resolve(true);
                }

                this._error("[Init DB error]", error);
                this._is_supported = false;
                resolve(false);
            };

            this._request.onblocked = async (event) => {
                if (await this._processOnBlocked(event)) return resolve(true);

                this._init_status = this.constructor.C.STATUS_INIT_ERROR;
                this._error("Init DB is blocked!");
                this._is_supported = false;
                resolve(false);
            }

            this._request.onsuccess = (event) => {
                this._init_status = this.constructor.C.STATUS_INIT_DONE;
                this._use_db(event.target.result || this._request.result);
                resolve(true);
            }
        });
    }

    /**
     * @return {Promise<boolean>}
     * @protected
     */
    async _afterInitOpenIndexedDB(){
        let res = await this._callOptReturnAsync('_afterInitOpenIndexedDB');
        if (!isU(res)) return res;

        if (!this._is_supported) return false;
        switch (this._init_flag){
            case this.constructor.C.FLAG_DELETE_DB:
                await this.deleteDB();
                break;
            case this.constructor.C.FLAG_REINIT_DB:
                await this.reInitDB();
                break;
        }

        return true;
    }

    /**
     * @param {Event|CustomEvent} event
     *
     * @return {Promise<boolean>}
     * @protected
     */
    async _processVersionError(event){
        let res = this._callOptReturn('_processVersionError', event);
        if (res !== undefined) return res;

        this._warn('The requested version is less than the existing version, reinit DB');
        event.stopPropagation();
        await this.reInitDB();
        return true;
    }

    /**
     *
     * @param event
     *
     * @return {Promise<*|boolean>} - return true, if it's OK
     * @protected
     */
    async _processOnBlocked(event){
        let res = this._callOptReturn('_processOnBlocked', event);
        if (res !== undefined) return res;

        return false;
    }

    /**
     * @param {IDBVersionChangeEvent} event
     *
     * @protected
     */
    async _onupgradeneeded(event){
        if (!this._db) return;
        if (this._callOpt('initdb_onupgradeneeded', event)) return;

        this._init_status = this.constructor.C.STATUS_INIT_UPD;
        this._dd('onupgradeneeded with old version '+event.oldVersion);
        // if oldVersion = 0 - it's new db
        if (event.oldVersion > 0){
            // just purge all and start with scratch
            await this.reInitDB();
        } else {
            // init db structure
            let db_structure = this._get_db_structure();
            if (db_structure){
                /** @type {Object|IDBObjectStoreParameters|null} value */
                for (const [name, value] of Object.entries(db_structure)){
                    this._dd('Create Store: '+name);
                    this._db.createObjectStore(name, value);
                }
            }

        }
    }

    /**
     *
     * @return {{ [key: string]: Object|IDBObjectStoreParameters|null }}
     * @protected
     */
    _get_db_structure(){
        /** @type {{ [key: string]: Object|IDBObjectStoreParameters|null }} */
        let structure = this._callOptReturn('get_db_structure');
        if (structure !== undefined) return structure;

        return {...(this._get_db_def_structure() || {}), ...(this._get_db_base_structure() || {})};
    }

    /**
     *
     * @return {{ [key: string]: Object|IDBObjectStoreParameters|null }}
     * @protected
     */
    _get_db_base_structure(){
        let structure = this._callOptReturn('_get_db_base_structure');
        if (structure !== undefined) return structure;

        structure = {};

        return structure;
    }

    /**
     *
     * @return {{ [key: string]: Object|IDBObjectStoreParameters|null }}
     * @protected
     */
    _get_db_def_structure(){
        let structure = this._callOptReturn('_get_db_def_structure');
        if (structure !== undefined) return structure;

        structure = {};
        if (!this._hasOption('skip_def_structure') && this._use_def_storage){
            structure[this._def_storage_name] = null;
        }

        return structure;
    }

    /**
     *
     * @param {IDBDatabase} db
     * @protected
     */
    _use_db(db){
        this._db = db;
        this._db.onversionchange = async (event) => {
            if (this._callOpt('onversionchange', event)) return;

            await this.reInitDB();
        }
        this._db.onerror = (event) => {
            if (this._callOpt('db_onerror', event)) return;

            this._error("[Database error]", event.target.error)
        }
    }

    /**
     * @return {Promise<boolean>}
     */
    async reInitDB(){
        let res = await this._callOptReturnAsync('reInitDB');
        if (!isU(res)) return res;

        if ([this.constructor.C.STATUS_INIT_UPD, this.constructor.C.STATUS_INIT_PROGRESS].includes(this._init_status)){
            this._init_flag = this.constructor.C.FLAG_REINIT_DB;
            return false;
        }

        this._dd('reInitDB');
        await this.deleteDB().catch(error => {
            this._error('Error during DB deleted', error);
            return false;
        });
        return await this._initDB();
    }

    /**
     * @return {void}
     */
    closeDB(){
        if (this._db){
            this._db.close();
            this._db = null;
        }

        this._init_flag = this.constructor.C.FLAG_NONE;
        this._init_status = this.constructor.C.STATUS_INIT_NONE;
    }

    /**
     * @return {void}
     */
    reset(){
        this.closeDB();
    }

    /**
     *
     * @return {Promise<*|boolean>} - return true, if DB was successfully deleted, false otherwise (or error)
     */
    async deleteDB(){
        let res = await this._callOptReturnAsync('deleteDB');
        if (!isU(res)) return res;

        if (!this._is_supported) return false;
        // this._request && this._request?.transaction?.mode === 'versionchange'
        if ([this.constructor.C.STATUS_INIT_UPD, this.constructor.C.STATUS_INIT_PROGRESS].includes(this._init_status)){
            this._init_flag = this.constructor.C.FLAG_DELETE_DB;
            return false;
        }

        this.closeDB();

        return await new Promise((resolve, reject) => {
            let deleteRequest = window.indexedDB.deleteDatabase(this._db_name);
            deleteRequest.onsuccess = () => resolve(true);
            deleteRequest.onerror = (event) => reject(event.target.error || deleteRequest.error)
        });
    }

    /**
     * @param {string} tableName
     *
     * @return {StorageAccessorDB}
     */
    getStorageAccessor(tableName){
        return new StorageAccessorDB(this._db, tableName);
    }

    /**
     * @return {StorageAccessorDB}
     */
    getStorageAccessorDef(){
        return new StorageAccessorDB(this._db, this._def_storage_name);
    }

    /**
     *
     * @param {string} name
     *
     * @return {boolean|*}
     * @protected
     */
    _hasOption(name){
        return this._options && this._options[name];
    }

    /**
     *
     * @param {string} name
     * @param {*} args
     *
     * @return {boolean}
     * @protected
     */
    _callOpt(name, ...args){
        if (this.ignore_call_option) return false;
        return call_isf(this._options, name, this, ...args);
    }

    /**
     *
     * @param {string} name
     * @param {*} args
     *
     * @return {Promise<boolean>}
     * @protected
     */
    async _callOptAsync(name, ...args){
        if (this.ignore_call_option) return false;
        return await call_isf_async(this._options, name, this, ...args);
    }

    /**
     *
     * @param {string} name
     * @param {*} args
     *
     * @return {*|undefined}
     * @protected
     */
    _callOptReturn(name, ...args){
        if (this.ignore_call_option) return undefined;
        return call_isf_return(this._options, name, this, ...args);
    }

    /**
     *
     * @param {string} name
     * @param {*} args
     *
     * @return {Promise<undefined|*>}
     * @protected
     */
    async _callOptReturnAsync(name, ...args){
        if (this.ignore_call_option) return undefined;
        return await call_isf_return_async(this._options, name, this, ...args);
    }

    /**
     *
     * @param {*} args
     *
     * @return {boolean}
     * @protected
     */
    _debug(...args){
        // Note: it's how it's work, but it's not real implementation
        return call_isf(this._log, 'debug', ...args);
    }

    /**
     *
     * @param {*} args
     *
     * @return {boolean}
     * @protected
     */
    _dd(...args){
        // Note: it's how it's work, but it's not real implementation
        if (!this._detail_debug) return false;
        return this._debug(...args);
    }

    /**
     *
     * @param {*} args
     *
     * @return {boolean}
     * @protected
     */
    _info(...args){
        // Note: it's how it's work, but it's not real implementation
        return call_isf(this._log, 'info', ...args);
    }

    /**
     *
     * @param {*} args
     *
     * @return {boolean}
     * @protected
     */
    _warn(...args){
        // Note: it's how it's work, but it's not real implementation
        return call_isf(this._log, 'warn', ...args);
    }

    /**
     *
     * @param {*} args
     *
     * @return {boolean}
     * @protected
     */
    _error(...args){
        // Note: it's how it's work, but it's not real implementation
        return call_isf(this._log, 'error', ...args);
    }
}

/**
 *
 * @param {function|*} object
 * @param {string} name
 *
 * @return {boolean}
 */
function isf(object, name){
    return object && object[name] && typeof object[name] === 'function';
}

/**
 *
 * @param {function|*} object
 * @param {string} name
 * @param {*} args
 *
 * @return {boolean}
 */
function call_isf(object, name, ...args){
    if (isf(object, name)){
        object[name](...args);
        return true;
    }
    return false;
}

/**
 * @param {function|*} object
 * @param {string} name
 * @param {*} args
 *
 * @return {Promise<boolean>}
 */
async function call_isf_async(object, name, ...args){
    if (isf(object, name)){
        await object[name](...args);
        return true;
    }
    return false;
}

/**
 * @param {function|*} object
 * @param {string} name
 * @param {*} args
 *
 * @return {undefined|*}
 */
function call_isf_return(object, name, ...args){
    if (isf(object, name)){
        return object[name](...args);
    }
    return undefined;
}

/**
 *
 * @param {function|*} object
 * @param {string} name
 * @param {*} args
 *
 * @return {Promise<undefined|*>}
 */
async function call_isf_return_async(object, name, ...args){
    if (isf(object, name)){
        return await object[name](...args);
    }
    return undefined;
}

/**
 * @param {*} val
 *
 * @return {boolean}
 */
function isU(val){
    return val === undefined;
}
