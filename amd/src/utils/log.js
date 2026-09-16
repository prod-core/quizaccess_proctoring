/**
 * Shared loglevel instance for the proctoring plugin
 *
 * @module      quizaccess_proctoring/utils/log
 * @copyright   2026 NED {@link http://ned.ca}
 * @author      NED {@link http://ned.ca}
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// noinspection NpmUsedModulesInstalled
import * as Log from 'core/loglevel';
import {PLUGIN} from 'quizaccess_proctoring/utils/state';

// noinspection JSPotentiallyInvalidConstructorUsage,JSUnresolvedReference
export const logger = new Log.default.constructor(PLUGIN);
logger._showDetailDebug = false;
logger.originalFactory = logger.methodFactory;
logger.methodFactory = (methodName, logLevel) => logger.originalFactory(methodName, logLevel).bind(logger, "[" + PLUGIN + "]");
logger.setLevel(logger.getLevel());

/**
 * @param {boolean} val
 */
logger.setDetailDebug = function (val){
    this._showDetailDebug = !!val;

    this.detailDebug = this._showDetailDebug ? this.debug.bind(this) : () => {};
    this.dd = this.detailDebug.bind(this);
}

/**
 * @return {boolean}
 */
logger.getDetailDebug = function (){
    return this._showDetailDebug;
}

/**
 * Show debug is detail debug is on
 *
 * @param args
 */
logger.detailDebug = function(...args){
    // Note: it's how it's work, but it's not real implementation
    if (!this._showDetailDebug) return;

    this.debug(...args);
}

/**
 * Show debug is detail debug is on
 * Alias for detailDebug
 *
 * @param args
 */
logger.dd = logger.detailDebug.bind(logger);

logger.setDetailDebug(logger._showDetailDebug);
