/**
 * UI helpers for the proctoring flow: alerts and window handling
 *
 * @module      quizaccess_proctoring/utils/ui
 * @copyright   2026 NED {@link http://ned.ca}
 * @author      NED {@link http://ned.ca}
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import Notification from 'core/notification';
import ModalEvents from 'core/modal_events';
import {get_strings} from 'core/str';
import * as State from 'quizaccess_proctoring/utils/state';

/**
 * Show a warning/error modal and run a callback once it is closed
 *
 * @param {string} textKey - The language string key (in the plugin)
 * @param {function|null} okCallback - Optional callback to run on modal close
 *
 * @param {boolean} [isError=false] - Whether to render it as an error modal
 */
export function warningAlert(textKey, okCallback = null, isError = false) {
    get_strings([
        {'key': isError ? 'error' : 'warning'},
        {'key': textKey, 'component': State.PLUGIN},
        {'key': 'ok'},
    ]).done(function(translations) {
        Notification.alert(translations[0], translations[1], translations[2])
            .then(function(modal) {
                if (okCallback) {
                    modal.getRoot().on(ModalEvents.hidden, () => okCallback());
                }
                return modal;
            });
    }).fail(Notification.exception);
}

/**
 * Set or change loading spinner display style
 *
 * @param {boolean|undefined} val - true - show, false - hide
 */
export function toggleLoadingSpinner(val=undefined){
    const loading_spinner = document.getElementById('loading_spinner');
    if (!loading_spinner?.style) return;

    if (val === undefined){
        val = loading_spinner.style.display === 'none';
    }
    loading_spinner.style.display = val ? 'block' : 'none';
}

/**
 * @param {boolean} res
 */
export function setFaceResult(res){
    const faceResult = document.getElementById(State.ID_FACE_RESULT);
    if (res) {
        State.settings[State.SETTING_FACE_ALLOWED] = true;
        if (State.data.videoWebcam?.style){
            State.data.videoWebcam.style.border = "10px solid green";
        }
        if (faceResult) {
            faceResult.innerHTML = '<span style="color: green">True</span>';
        }

        const faceButton = document.getElementById(State.ID_FACE_BUTTON);
        if (faceButton?.classList){
            faceButton.classList.add('hidden');
        }
    } else {
        if (State.data.videoWebcam?.style){
            State.data.videoWebcam.style.border = "10px solid red";
        }
        if (faceResult) {
            faceResult.innerHTML = '<span style="color: red">False</span>';
        }
    }
}

/**
 * Reset form before attempt to default
 */
export function resetBeforeForm(){
    State.settings[State.SETTING_FACE_ALLOWED] = false;
    document.getElementById(State.ID_FACE_BUTTON)?.classList?.remove('hidden');

    const faceResult = document.getElementById(State.ID_FACE_RESULT);
    if (faceResult) {
        faceResult.innerHTML = '';
    }
}

/**
 * Close a popup window, or redirect it if the browser forbids programmatic closing
 *
 * @param {Window|null} win - The window to close
 */
export function closeWindow(win) {
    if (!win) return;

    win.close();
    // If the window is not allowed to close, change its location
    if (win.location && win.location.assign) {
        win.location.assign('/mod/quiz/view.php?id=' + State.settings[State.SETTING_CMID]);
    }
}

/**
 * Close the main window
 *
 * @param {Window|null} [win]
 */
export function closeWindowMain(win) {
    closeWindow(win || window);
}
