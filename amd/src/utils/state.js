/**
 * Shared constants and mutable state for the proctoring start attempt flow
 *
 * @module      quizaccess_proctoring/utils/state
 * @copyright   2026 NED {@link http://ned.ca}
 * @author      NED {@link http://ned.ca}
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

export const PLUGIN = 'quizaccess_proctoring';

// Storage keys
export const ALLOW_KEY = 'access_granted';
export const QUIZ_START_KEY = 'quiz_start';
export const ALLOW_VALID_WINDOW = 24 * 3600 * 1000; // 1 day
export const INTERVAL_DELAY = 1000;

// Settings keys
export const SETTING_H = 'height';
export const SETTING_W = 'width';
export const SETTING_ID = 'id';
export const SETTING_CMID = 'cmid';
export const SETTING_COURSEID = 'courseid';
export const SETTING_SCR_ENABLE = 'enablescreenshare';
export const SETTING_FACE_ENABLE = 'faceidcheck';
export const SETTING_CAMSHOT_DELAY = 'camshotdelay';
export const SETTING_WEB_ALLOWED = 'webcam_allowed';
export const SETTING_SCR_ALLOWED = 'screen_allowed';
export const SETTING_FACE_ALLOWED = 'face_allowed';
export const SETTING_BOX_ALLOWED = 'checkbox_validation';
export const SETTING_FINAL_DENY = 'final_deny';
export const SETTING_QUIZ_URL = 'quizurl';
export const SETTING_IS_QUIZ_PAGE = 'is_quiz_page';

// Element ids
export const ID_START_QUIZ = 'id_start_quiz';
export const ID_WEBCAM_BUTTON = 'allow_camera_btn';
export const ID_SCREEN_BUTTON = 'share_screen_btn';
export const ID_FACE_BUTTON = 'fcvalidate';
export const ID_FACE_RESULT = 'face_validation_result';

// Selectors
export const SELECTOR_QUIZ_START_BUTTON_DIV = 'div.singlebutton.quizstartbuttondiv';
export const DISPLAY_SURFACE = 'monitor';

// Device detection
// noinspection RegExpRedundantEscape,RegExpSingleCharAlternation
const isMobile = new RegExp(
    '(android|bb\\d+|meego).+mobile|avantgo|bada\\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)' +
        '|ipad|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\\/' +
        '|plucker|pocket|psp|series(4|6)0|symbian|treo|up\\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino', 'i').test(navigator.userAgent)
    || new RegExp('1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au' +
        '(di|\\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\\-(n|u)|c55\\/|capi|ccwa|cdm\\-|cell|chtm|cldc|cmd\\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\\-s' +
        '|devi|dica|dmob|do(c|p)o|ds(12|\\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\\-|_)|g1 u' +
        '|g560|gene|gf\\-5|g\\-mo|go(\\.w|od)|gr(ad|un)|haie|hcit' +
        '|hd\\-(m|p|t)|hei\\-|hi(pt|ta)|hp( i|ip)|hs\\-c|ht(c(\\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\\-(20|go|ma)|i230|iac( |\\-|\\/)' +
        '|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\\/)|klon|kpt |kwc\\-|kyo(c|k)|le(no|xi)|lg( g|\\/(k|l|u)|50|54|\\-[a-w])|libw' +
        '|lynx|m1\\-w|m3ga|m50\\/|ma(te|ui|xo)|mc(01|21|ca)|m\\-cr|me(rc|ri)|mi(o8|oa|ts)' +
        '|mmef|mo(01|02|bi|de|do|t(\\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\\-' +
        '|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\\-([1-8]|c))|phil|pire|pl(ay|uc)' +
        '|pn\\-2|po(ck|rt|se)|prox|psio|pt\\-g|qa\\-a|qc(07|12|21|32|60|\\-[2-7]|i\\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\\-|oo|p\\-)' +
        '|sdk\\/|se(c(\\-|0|1)|47|mc|nd|ri)|sgh\\-|shar|sie(\\-|m)|sk\\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\\-|v\\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)' +
        '|tcl\\-|tdg\\-|tel(i|m)|tim\\-|t\\-mo|to(pl|sh)|ts(70|m\\-|m3|m5)|tx\\-9|up(\\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\\-v)|vm40|voda|vulc|vx' +
        '(52|53|60|61|70|80|81|83|85|98)|w3c(\\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\\-|your|zeto|zte\\-', 'i').test(navigator.userAgent.slice(0, 4));

/**
 * Shared settings for the proctoring flow, filled from the PHP-provided props
 *
 * @constant
 * @type {Object}
 */
export const settings = {
    [SETTING_W]: isMobile ? 100 : 320,
    [SETTING_H]: 0, // This will be computed based on the input stream
};

/**
 * Shared mutable runtime data for the proctoring flow
 *
 * @constant
 * @type {Object}
 */
export const data = {
    canvas: null,
    photo: null,
    videoWebcam: null,
    videoScreen: null,
    quizwindow: null,
    webcamShotInterval: null,
    screenShotInterval: null,
};

/**
 * Copy the provided settings into the shared settings object
 *
 * @param {Object} props - Settings to merge
 */
export function importSettings(props) {
    Object.assign(settings, props);
}

/**
 * Search video,canvas and photo elements on the page for data
 */
export function updateDataElems(){
    data.videoWebcam = document.getElementById('video');
    data.canvas = document.getElementById('canvas');
    data.photo = document.getElementById('photo');
}
