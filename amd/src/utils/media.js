/**
 * Webcam and screen stream management for the proctoring flow
 *
 * @module      quizaccess_proctoring/utils/media
 * @copyright   2026 NED {@link http://ned.ca}
 * @author      NED {@link http://ned.ca}
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import * as State from 'quizaccess_proctoring/utils/state';
import {get_string} from 'core/str';
import {logger as L} from 'quizaccess_proctoring/utils/log';
import {set as storageSet} from 'quizaccess_proctoring/utils/storage';
import {closeWindow, warningAlert} from 'quizaccess_proctoring/utils/ui';

/**
 * Play a video element, ignoring the returned promise rejection
 *
 * @param {HTMLVideoElement} videoElem
 */
function videoPlay(videoElem) {
    const playPromise = videoElem.play();
    if (playPromise !== undefined) {
        playPromise.catch(() => {});
    }
}

/**
 * Stop all tracks of a video element stream
 *
 * @param {HTMLVideoElement|null} videoElem
 */
function stopStream(videoElem) {
    if (!videoElem) return;

    if (videoElem.srcObject) {
        videoElem.srcObject.getTracks().forEach(track => track.stop());
    }
    videoElem.srcObject = null;
}

/**
 * Detect the display surface of the stream attached to a video element
 *
 * @param {HTMLVideoElement|null} videoElem
 *
 * @return {string|null}
 */
export function getDisplaySurface(videoElem) {
    let displaySurface = null;
    if (!videoElem || !videoElem.srcObject || !videoElem.srcObject.getVideoTracks) {
        return displaySurface;
    }

    for (const track of videoElem.srcObject.getVideoTracks()) {
        if (!track.enabled || track.kind !== "video") continue;

        const trackSettings = track.getSettings();
        if (!trackSettings) continue;

        displaySurface = trackSettings.displaySurface;
        if (displaySurface) {
            return displaySurface;
        }
    }

    return displaySurface;
}

/**
 * Fill the photo canvas with a neutral placeholder
 */
export function clearPhoto() {
    if (!State.settings[State.SETTING_WEB_ALLOWED]) return;

    const canvas = State.data.canvas;
    const context = canvas.getContext('2d');
    context.fillStyle = "#AAA";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const data = canvas.toDataURL('image/png');
    if (State.data.photo) {
        State.data.photo.setAttribute('src', data);
    }
}

/**
 * Compute whether the attempt may currently be started
 *
 * @return {boolean|undefined} - undefined on the quiz page
 */
function checkRules() {
    if (State.settings[State.SETTING_IS_QUIZ_PAGE]) return undefined;

    if (State.settings[State.SETTING_FINAL_DENY]) return false;
    if (!State.settings[State.SETTING_WEB_ALLOWED]) return false;
    if (State.settings[State.SETTING_SCR_ENABLE] && !State.settings[State.SETTING_SCR_ALLOWED]) return false;
    if (State.settings[State.SETTING_FACE_ENABLE] && !State.settings[State.SETTING_FACE_ALLOWED]) return false;

    return !!State.settings[State.SETTING_BOX_ALLOWED];
}

/**
 * Update the current access permission and reflect it in storage and the UI
 *
 * @param {boolean|undefined} [value] - Force a value, otherwise compute from the rules
 * @param {boolean} [final=false] - Whether an impossibility is final
 *
 * @return {Promise<boolean|undefined>}
 */
export async function updateAllow(value, final = false) {
    if (State.settings[State.SETTING_IS_QUIZ_PAGE]) return undefined;
    if (State.settings[State.SETTING_FINAL_DENY]) return false;

    const prev = State.settings[State.ALLOW_KEY];
    const res = value === undefined ? checkRules() : value;
    State.settings[State.ALLOW_KEY] = res;

    const finalDeny = !res && final;
    if (finalDeny) {
        await turnWebcam(false);
        await turnScreen(false);
        State.settings[State.SETTING_FINAL_DENY] = true;

        document.getElementById(State.ID_START_QUIZ)?.remove();
        const quizStartButtonDiv = document.querySelector(State.SELECTOR_QUIZ_START_BUTTON_DIV);
        if (quizStartButtonDiv) {
            const form = quizStartButtonDiv.querySelector('form');
            if (form) {
                form.action = '';
                form.classList.add('hidden');
                Array.from(form.elements).forEach(control => {
                    control.disabled = true;
                });
            }

            // noinspection JSCheckFunctionSignatures
            get_string('cantattempt', State.PLUGIN).done(str => {
                const errorDiv = document.createElement('div');
                errorDiv.classList.add('error');
                errorDiv.textContent = str;
                quizStartButtonDiv.appendChild(errorDiv);
            });
        }
    }

    if (res !== prev) {
        await storageSet(State.ALLOW_KEY, res ? (new Date()).getTime() : false);

        if (!finalDeny) {
            const startQuizButton = document.getElementById(State.ID_START_QUIZ);
            if (startQuizButton) {
                startQuizButton.disabled = !res;
            }
        }
    }

    return res;
}

/**
 * Turn the webcam on or off
 *
 * @param {boolean} [value=true]
 * @param {MediaStream|null} [stream]
 *
 * @return {Promise<void>}
 */
export async function turnWebcam(value = true, stream = null) {
    if (State.settings[State.SETTING_FINAL_DENY]) return;

    const turnOn = value && State.data.videoWebcam;
    State.settings[State.SETTING_WEB_ALLOWED] = turnOn;
    if (turnOn) {
        if (stream) {
            State.data.videoWebcam.srcObject = stream;
        }
        videoPlay(State.data.videoWebcam);
    } else {
        stopStream(State.data.videoWebcam);
        if (State.data.videoWebcam) {
            State.data.videoWebcam.removeAttribute('height');
            State.data.videoWebcam.streaming = false;
        }
    }

    await updateAllow();
    const webcamButton = document.getElementById(State.ID_WEBCAM_BUTTON);
    if (webcamButton) {
        webcamButton.disabled = turnOn;
        webcamButton.classList.toggle('disabled', turnOn);
        webcamButton.classList.toggle('done', turnOn);
    }
}

/**
 * Turn the screen sharing on or off
 *
 * @param {boolean} [value=true]
 * @param {MediaStream|null} [stream]
 * @param {boolean} [finalFail=false] - Whether a display check failure is final
 *
 * @return {Promise<void>}
 */
export async function turnScreen(value = true, stream = null, finalFail = false) {
    if (State.settings[State.SETTING_FINAL_DENY]) return;

    const turnOn = value && State.data.videoScreen && !finalFail;
    State.settings[State.SETTING_SCR_ALLOWED] = turnOn;
    if (turnOn) {
        if (stream) {
            State.data.videoScreen.srcObject = stream;
        }
        videoPlay(State.data.videoScreen);
    } else {
        stopStream(State.data.videoScreen);
        if (State.data.videoScreen) {
            State.data.videoScreen.removeAttribute('height');
        }

        closeWindow(State.data.quizwindow);
    }

    if (finalFail) {
        await updateAllow(false, true);
        const screenButton = document.getElementById(State.ID_SCREEN_BUTTON);
        if (screenButton) {
            screenButton.disabled = true;
            screenButton.classList.remove('done');
            screenButton.classList.add('disabled', 'fail');
        }
    } else {
        await updateAllow();
        const screenButton = document.getElementById(State.ID_SCREEN_BUTTON);
        if (screenButton) {
            screenButton.disabled = turnOn;
            screenButton.classList.toggle('disabled', turnOn);
            screenButton.classList.toggle('done', turnOn);
        }
    }

    if (turnOn) {
        // Yes, it should be at the end
        await updateScreenStatus();
    }
}

/**
 * Check the stream of a video element and turn it off if it is no longer usable
 *
 * @param {HTMLVideoElement|null} video - The video element to check
 * @param {boolean} screenMode - Whether the video is a screen share
 */
async function updateStreamStatus(video, screenMode) {
    if (State.settings[State.SETTING_FINAL_DENY]) return;

    const finish = async (finalFail = false) => {
        if (screenMode) {
            await turnScreen(false, null, finalFail);
        } else {
            await turnWebcam(false);
        }
        return null;
    };

    if (!video || !video.srcObject) {
        return await finish();
    }

    const currentStream = video.srcObject;
    if (!currentStream.active) {
        return await finish();
    }

    if (screenMode) {
        const displaySurface = getDisplaySurface(State.data.videoScreen);
        if (displaySurface !== State.DISPLAY_SURFACE) {
            if (displaySurface === undefined) {
                warningAlert('error:sharescreen', null, true);
                return await finish(true);
            }

            warningAlert('warning:sorry:sharescreen');
            return await finish();
        }
    }
}

/**
 * Check the webcam stream status
 */
async function updateWebcamStatus() {
    await updateStreamStatus(State.data.videoWebcam, false);
}

/**
 * Check the screen share stream status
 */
async function updateScreenStatus() {
    await updateStreamStatus(State.data.videoScreen, true);
}

/**
 * Start the webcam stream
 *
 * @param {function|null} [funFail] - Optional callback run when the camera can't be started
 *
 * @return {boolean|null} - True if the startup was initiated, false/null otherwise
 */
export async function videoStartup(funFail = null) {
    if (State.settings[State.SETTING_FINAL_DENY]) return false;

    let res = null;
    const videoWebcam = State.data.videoWebcam;
    if (videoWebcam) {
        const getCameraFail = async (...debugData) => {
            if (debugData.length > 0) {
                L.dd(...debugData);
            }

            await turnWebcam(false);
            warningAlert('warning:cameraallowwarning');
            res = false;
            if (funFail && typeof funFail === 'function') {
                funFail();
            }
        };

        if (navigator.mediaDevices) {
            res = true;
            navigator.mediaDevices.getUserMedia({video: true, audio: false})
                .then(stream => turnWebcam(true, stream))
                .catch(err => getCameraFail('navigator.mediaDevices.getUserMedia error', err));
        } else {
            await getCameraFail('No navigator.mediaDevices');
            return res;
        }

        if (!videoWebcam[State.PLUGIN + '_init']) {
            videoWebcam.addEventListener('canplay', function() {
                if (!videoWebcam.streaming) {
                    State.settings[State.SETTING_H] = videoWebcam.videoHeight
                        / (videoWebcam.videoWidth / State.settings[State.SETTING_W]);
                    // Firefox currently has a bug where the height can't be read from the video, so we will make assumptions if this happens
                    if (isNaN(State.settings[State.SETTING_H])) {
                        State.settings[State.SETTING_H] = State.settings[State.SETTING_W] / (4 / 3);
                    }
                    videoWebcam.setAttribute('width', State.settings[State.SETTING_W]);
                    videoWebcam.setAttribute('height', State.settings[State.SETTING_H]);
                    State.data.canvas.setAttribute('width', State.settings[State.SETTING_W]);
                    State.data.canvas.setAttribute('height', State.settings[State.SETTING_H]);

                    videoWebcam.streaming = true;
                }
            }, false);

            videoWebcam.addEventListener('suspend', () => updateWebcamStatus());
            videoWebcam.addEventListener('pause', () => updateWebcamStatus());

            videoWebcam[State.PLUGIN + '_init'] = true;
        }
    } else {
        res = false;
    }

    clearPhoto();
    return res;
}

/**
 * Start the screen share stream
 *
 * @return {boolean|null} - True if the startup was initiated, false/null otherwise
 */
export async function screenStartup() {
    if (State.settings[State.SETTING_FINAL_DENY]) return false;

    let res = null;
    const videoScreen = State.data.videoScreen;
    const getScreenFail = async (...debugData) => {
        L.dd(...debugData);

        await turnScreen(false);
        warningAlert('warning:sharescreen');
        res = false;
    };

    if (!State.data.videoScreen) {
        return res;
    }

    if (navigator.mediaDevices) {
        res = true;
        // noinspection JSValidateTypes
        /** @type {DisplayMediaStreamOptions} */
        const displayMediaOptions = {
            video: {
                cursor: "always"
            },
            audio: false
        };
        const supportedConstraints = navigator.mediaDevices.getSupportedConstraints();
        if (supportedConstraints.displaySurface) {
            displayMediaOptions.video.displaySurface = State.DISPLAY_SURFACE;
        }

        navigator.mediaDevices.getDisplayMedia(displayMediaOptions)
            .then(stream => turnScreen(true, stream))
            .catch(err => getScreenFail('navigator.mediaDevices.getDisplayMedia error', err));
    } else {
        await getScreenFail('No navigator.mediaDevices');
        return false;
    }

    if (!videoScreen[State.PLUGIN + '_init']) {
        videoScreen.addEventListener('suspend', () => updateScreenStatus());
        videoScreen.addEventListener('pause', () => updateScreenStatus());

        videoScreen[State.PLUGIN + '_init'] = true;
    }

    return res;
}
