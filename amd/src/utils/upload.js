/**
 * Picture/screenshot capture and upload for the proctoring flow
 *
 * @module      quizaccess_proctoring/utils/upload
 * @copyright   2026 NED {@link http://ned.ca}
 * @author      NED {@link http://ned.ca}
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import Ajax from 'core/ajax';
import * as State from 'quizaccess_proctoring/utils/state';
import Notification from 'core/notification';
import {logger as L} from 'quizaccess_proctoring/utils/log';
import {clearPhoto, getDisplaySurface} from 'quizaccess_proctoring/utils/media';
import {get as storageGet} from 'quizaccess_proctoring/utils/storage';
import {warningAlert} from 'quizaccess_proctoring/utils/ui';

const WS_SEND_CAMSHOT = 'quizaccess_proctoring_send_camshot';
const WS_VALIDATE_FACE = 'quizaccess_proctoring_validate_face';

/**
 * Perform a Moodle webservice call
 *
 * @param {string} methodname - The webservice function name
 * @param {Object} params - The webservice arguments
 *
 * @return {jQuery.Promise} - The webservice promise
 */
function callWS(methodname, params) {
    const request = {
        methodname: methodname,
        args: params
    };
    return Ajax.call([request])[0];
}

/**
 * Stop the screenshot interval and close the quiz window
 *
 * @param {boolean} [closeQuizWindow=true] - Whether to attempt to close the quiz window
 *
 * @return {boolean} - Always false
 */
function stopScreenShots(closeQuizWindow = true) {
    clearInterval(State.data.screenShotInterval);
    if (closeQuizWindow && State.data.quizwindow) {
        State.data.quizwindow.close();
    }

    return false;
}

/**
 * Capture and upload a webcam picture
 */
export function takePicture() {
    const canvas = State.data.canvas;
    if (!State.settings[State.SETTING_W] || !State.settings[State.SETTING_H]) {
        clearPhoto();
        return;
    }

    canvas.width = State.settings[State.SETTING_W];
    canvas.height = State.settings[State.SETTING_H];
    canvas.getContext('2d').drawImage(State.data.videoWebcam, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/png');
    State.data.photo.setAttribute('src', data);

    const params = {
        'courseid': State.settings[State.SETTING_COURSEID],
        'screenshotid': State.settings[State.SETTING_ID],
        'cmid': State.settings[State.SETTING_CMID],
        'webcampicture': data,
        'imagetype': 1
    };

    // noinspection JSUnresolvedReference
    callWS(WS_SEND_CAMSHOT, params).done(function(response) {
        if (response.warnings.length >= 1 && State.data.videoWebcam) {
            warningAlert('error:takingimage', null, true);
        }
    }).fail(Notification.exception);
}

/**
 * Capture and upload a screenshot
 */
export function takeScreenshot() {
    if (State.data.videoScreen.srcObject === null) return;

    const currentStream = State.data.videoScreen.srcObject;
    const active = currentStream.active;
    const displaySurface = getDisplaySurface(State.data.videoScreen);

    if (!active) {
        warningAlert('warning:sorry:restartattempt');
        return stopScreenShots();
    }

    if (displaySurface !== State.DISPLAY_SURFACE) {
        L.dd(displaySurface);
        warningAlert('warning:sorry:sharescreen');
        return stopScreenShots();
    }

    const canvasScreen = document.getElementById('canvas-screen');
    const screenContext = canvasScreen.getContext('2d');

    canvasScreen.width = screen.width;
    canvasScreen.height = screen.height;
    screenContext.drawImage(State.data.videoScreen, 0, 0, screen.width, screen.height);
    const screenData = canvasScreen.toDataURL('image/png');

    const params = {
        'courseid': State.settings[State.SETTING_COURSEID],
        'screenshotid': State.settings[State.SETTING_ID],
        'cmid': State.settings[State.SETTING_CMID],
        'webcampicture': screenData,
        'imagetype': 2
    };

    // noinspection JSUnresolvedReference
    callWS(WS_SEND_CAMSHOT, params).done(function(response) {
        if (response.warnings.length >= 1 && State.data.videoScreen) {
            warningAlert('error:takingimage', null, true);
            stopScreenShots(false);
        }
    }).fail(Notification.exception);
}

/**
 * Take a webcam picture when the quiz has been started
 */
export async function takePictureInterval() {
    if (!await storageGet(State.QUIZ_START_KEY)) return;

    takePicture();
}

/**
 * Take a screenshot when the quiz has been started
 */
export async function takeScreenshotInterval() {
    if (!await storageGet(State.QUIZ_START_KEY)) return;

    takeScreenshot();
}

/**
 * Send a face snapshot for validation
 *
 * @param {string} dataUrl - The captured image as a data URL
 *
 * @return {jQuery.Promise} - The webservice promise
 */
export function validateFace(dataUrl) {
    const params = {
        'courseid': State.settings[State.SETTING_COURSEID],
        'cmid': State.settings[State.SETTING_CMID],
        'webcampicture': dataUrl,
    };

    return callWS(WS_VALIDATE_FACE, params);
}
