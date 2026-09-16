/**
 * Start attempt handling for the proctoring quiz access rule.
 *
 * Glues the proctoring lifecycle together: the pre-attempt checks (webcam,
 * screen and face validation) on the quiz start page, and the monitoring of
 * the attempt page opened in a popup window.
 *
 * @module      quizaccess_proctoring/startAttempt
 * @copyright   2026 NED {@link http://ned.ca}
 * @author      NED {@link http://ned.ca}
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import Config from 'core/config';
import Notification from 'core/notification';
import * as State from 'quizaccess_proctoring/utils/state';
import {logger as L} from 'quizaccess_proctoring/utils/log';
import * as Media from 'quizaccess_proctoring/utils/media';
import * as Storage from 'quizaccess_proctoring/utils/storage';
import * as Upload from 'quizaccess_proctoring/utils/upload';
import * as UI from 'quizaccess_proctoring/utils/ui';

// called from PHP
// noinspection JSUnusedGlobalSymbols
export default {
    setup,
    setupBeforeAttempt,
};

/**
 * Check whether the stored access permission is still valid.
 *
 * @return {Promise<boolean>}
 */
async function checkKeyAllow() {
    const data = await Storage.get(State.ALLOW_KEY);
    if (!data) return false;

    return (data + State.ALLOW_VALID_WINDOW) >= (new Date()).getTime();
}

/**
 * Finish the proctoring session: clear the state and close the relevant window.
 *
 * @param {string|boolean} [alertTxt=false] - Optional warning to show.
 *
 * @return {Promise<void>}
 */
async function finishAttempt(alertTxt = false) {
    L.dd('finishAttempt', 'txt:', alertTxt);
    let finalFun = function() {};
    if (!State.settings[State.SETTING_IS_QUIZ_PAGE]) {
        await Storage.clear();
        UI.closeWindow(State.data.quizwindow);
    } else {
        await Storage.remove(State.QUIZ_START_KEY);
        const pageEl = document.getElementById('page');
        if (pageEl) {
            pageEl.remove();
        }
        finalFun = UI.closeWindowMain;
    }

    if (alertTxt) {
        if (typeof alertTxt !== 'string') {
            alertTxt = 'warning:keepparentwindowopen';
        }

        UI.warningAlert(alertTxt, finalFun);
    } else {
        finalFun();
    }
}

/**
 * On the attempt page: check whether the attempt should force finish.
 *
 * @return {Promise<void>}
 */
async function checkQuizPage() {
    const quizUrl = State.settings[State.SETTING_QUIZ_URL];
    const shouldFinish = async function() {
        if (!await checkKeyAllow()) return true;
        if (!window.opener || window.opener.closed) return true;

        let parentWindowURL;
        try {
            parentWindowURL = window.opener.location.href;
        } catch {
            return true;
        }

        return !parentWindowURL || !parentWindowURL.includes(quizUrl);
    };

    if (await shouldFinish()) {
        L.dd('call finishAttempt');
        await finishAttempt(false);
    }
}

/**
 * Run a function once the page has fully loaded.
 *
 * @param {function} fun
 */
function callAfterPageLoad(fun) {
    if (!fun || typeof fun !== 'function') return;

    if (document.readyState === 'complete') {
        fun();
    } else {
        window.addEventListener('load', fun);
    }
}

/**
 * Initialize the base of any page.
 *
 * @param {Object} props - Initial settings from PHP.
 *
 * @return {Promise<void>} - False on pages where proctoring is not needed.
 * @protected
 */
async function _init(props){
    let storageOpts = {};
    if (props && props.hasOwnProperty('detail_debug')){
        L.setDetailDebug(props.detail_debug);
        storageOpts.detail_debug = props.detail_debug;
    }

    State.importSettings(props);

    if (!await Storage.init(props.version, storageOpts)) {
        UI.warningAlert('error:localStorage', null, true);
    }

    window.addEventListener("pagehide", (event) => event.persisted  ? null : finishAttempt());

    L.dd('Init page base done');
}

/**
 * Initialize the proctoring on the attempt page.
 *
 * @param {Object} props - Initial settings from PHP.
 *
 * @return {Promise<boolean>} - False on pages where proctoring is not needed.
 */
async function setup(props) {
    await _init(props);
    State.settings[State.SETTING_IS_QUIZ_PAGE] = true;

    // Skip for summary page.
    const summaryPage = document.getElementById("page-mod-quiz-summary");
    if (summaryPage !== null && summaryPage.innerHTML.length) return false;

    const reviewPage = document.getElementById("page-mod-quiz-review");
    if (reviewPage !== null && reviewPage.innerHTML.length) return false;

    await Storage.set(State.QUIZ_START_KEY, true);

    document.getElementById('mod_quiz_navblock')?.insertAdjacentHTML('beforeend',
        '<div class="card-body p-3">'
        + '<h3 class="no text-left">Webcam</h3>'
        + '<video id="video" class="navblock-video">Video stream not available.</video>'
        + '<canvas id="canvas" class="hidden"></canvas>'
        + '<div class="output hidden"><img id="photo" alt="The picture will appear in this box."/></div>'
        + '</div>'
    );

    State.updateDataElems();
    await Media.videoStartup(() => finishAttempt('warning:sorry:restartattempt'));
    Storage.setCallbackOnChange((data) => {
        L.dd('onStorageChange', data);
        checkQuizPage();
    });

    callAfterPageLoad(function() {
        checkQuizPage();
        document.body.classList.add('shown');
    });

    return true;
}

/**
 * Initialize the proctoring checks on the quiz start page (before the attempt).
 *
 * @param {Object} props - Initial settings from PHP.
 *
 * @return {Promise<boolean|undefined>}
 */
async function setupBeforeAttempt(props) {
    await _init(props);

    await Storage.clear();
    await Media.updateAllow(false);

    const submitBtn = document.getElementById("id_submitbutton");
    if (!submitBtn) {
        L.dd('Error: no submitbutton');
        await Media.updateAllow(false, true);
        return;
    }

    submitBtn.disabled = true;
    State.updateDataElems();

    const startBtn = document.createElement('button');
    startBtn.className = 'btn btn-primary';
    startBtn.id = State.ID_START_QUIZ;
    startBtn.disabled = true;
    startBtn.addEventListener('click', async function(event) {
        event.preventDefault();
        if (!await Media.updateAllow()) return;

        const form = submitBtn.closest('form');
        const url = (form ? form.action : '') + '?cmid=' + State.settings[State.SETTING_CMID] + '&sesskey=' + Config.sesskey;
        State.data.quizwindow = window.open(url, '_blank');
    });
    startBtn.textContent = submitBtn.textContent || submitBtn.value;
    submitBtn.insertAdjacentElement('afterend', startBtn);

    document.getElementById('id_proctoring_checkbox')?.addEventListener('change', async function() {
        State.settings[State.SETTING_BOX_ALLOWED] = !!this.checked;
        await Media.updateAllow();
    });

    callAfterPageLoad(() => document.querySelector(State.SELECTOR_QUIZ_START_BUTTON_DIV)?.classList?.add('shown'));

    document.getElementById(State.ID_WEBCAM_BUTTON)?.addEventListener('click', async function(event) {
        event.preventDefault();
        await Media.videoStartup();
    });

    document.getElementById("id_cancel")?.addEventListener('click', async function() {
        await Media.turnWebcam(false);
        await Media.turnScreen(false);
        await Storage.clear();

        UI.resetBeforeForm();
    });

    State.data.webcamShotInterval = setInterval(
        Upload.takePictureInterval,
        State.settings[State.SETTING_CAMSHOT_DELAY] || State.INTERVAL_DELAY
    );

    if (State.settings[State.SETTING_SCR_ENABLE]) {
        State.data.videoScreen = document.getElementById("video-screen");

        document.getElementById(State.ID_SCREEN_BUTTON)?.addEventListener('click', async function(event) {
            event.preventDefault();
            await Media.screenStartup();
        });

        State.data.screenShotInterval = setInterval(
            Upload.takeScreenshotInterval, State.settings[State.SETTING_CAMSHOT_DELAY] || State.INTERVAL_DELAY
        );
    }

    if (State.settings[State.SETTING_FACE_ENABLE]) {
        document.getElementById(State.ID_FACE_BUTTON)?.addEventListener('click', function(event) {
            event.preventDefault();
            State.settings[State.SETTING_FACE_ALLOWED] = false;

            const context = State.data.canvas.getContext('2d');
            context.drawImage(State.data.videoWebcam, 0, 0, State.data.canvas.width, State.data.canvas.height);
            const data = State.data.canvas.toDataURL('image/png');
            State.data.photo.setAttribute('src', data);

            UI.toggleLoadingSpinner(true);
            // noinspection JSUnresolvedReference
            Upload.validateFace(data).done(function(data) {
                UI.toggleLoadingSpinner(false);
                State.settings[State.SETTING_FACE_ALLOWED] = false;
                if (data.warnings.length < 1) {
                    UI.setFaceResult(data.status === 'success');
                } else {
                    if (State.data.videoWebcam) {
                        UI.warningAlert('error:takingimage', null, true);
                    }
                }
                Media.updateAllow();
            }).fail(Notification.exception);
        });
    }

    return true;
}
