<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Implementation for the quizaccess_proctoring plugin.
 *
 * @package    quizaccess_proctoring
 * @copyright  2020 Brain Station 23
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

use quizaccess_proctoring\shared_lib as NED;

defined('MOODLE_INTERNAL') || die();

/**
 * quizaccess_proctoring
 */
class quizaccess_proctoring extends \mod_quiz\local\access_rule_base {
    public const _JS_DETAIL_DEBUG = false;

    /**
     * Check is preflight check is required.
     *
     * @param mixed $attemptid
     *
     * @return bool
     */
    public function is_preflight_check_required($attemptid){
        if (!NED::is_secure()) return true;

        $script = $this->get_topmost_script();
        $base = basename($script);
        if ($base == "view.php"){
            return true;
        } else {
            return false;
        }
    }

    /**
     * Get topmost script path
     *
     * @return String
     */
    public function get_topmost_script(){
        $backtrace = debug_backtrace(
            defined("DEBUG_BACKTRACE_IGNORE_ARGS")
                ? DEBUG_BACKTRACE_IGNORE_ARGS
                : false);
        $topframe = array_pop($backtrace);
        return $topframe['file'];
    }

    /**
     * Get_courseid_cmid_from_preflight_form
     *
     * @param \mod_quiz\form\preflight_check_form $quizform
     *
     * @return array
     * @noinspection PhpUnusedParameterInspection
     */
    public function get_courseid_cmid_from_preflight_form(\mod_quiz\form\preflight_check_form $quizform){
        $response = [];
        $response['courseid'] = $this->quiz->course;
        $response['quizid'] = $this->quiz->id;
        $response['cmid'] = $this->quiz->cmid;
        return $response;
    }

    /**
     * @param $quizform
     * @param $enablescreenshare
     * @param $faceidcheck
     *
     * @return string
     * @noinspection PhpUnusedParameterInspection
     */
    public function make_modal_content($quizform, $enablescreenshare, $faceidcheck){
        if (!NED::is_secure()) return NED::div(NED::str('error:requiresecure'), 'error');

        $rows = [];
        $statement_key = 'proctoringstatement' . ($enablescreenshare ? '_screenshare' : '');
        $rows[] = NED::d_row_col(NED::str($statement_key));
        $rows[] = NED::d_row_col(NED::str($statement_key.'_pls'));
        $last_row = [];
        $last_row[] = NED::d_col(NED::str('camhtml'));
        if ($enablescreenshare){
            $rows[] = NED::d_row_col(NED::str('screensharemsg'));
            $last_row[] = NED::d_col(NED::str('screenhtml'), $faceidcheck ? '' : 'hidden');
        }

        $rows[] = NED::d_row($last_row);

        return NED::d_container($rows);
    }


    /**
     * Add any field you want to pre-flight check form. You should only do
     * something here if {@link is_preflight_check_required()} returned true.
     *
     * @param \mod_quiz\form\preflight_check_form $quizform the form being built.
     * @param MoodleQuickForm $mform The wrapped MoodleQuickForm.
     * @param int|null $attemptid the id of the current attempt, if there is one,
     *      otherwise null.
     */
    public function add_preflight_check_form_fields(\mod_quiz\form\preflight_check_form $quizform,
        MoodleQuickForm $mform, $attemptid)
    {
        NED::page()->add_body_class('quizaccess_proctoring');
        $mform->_attributes['class'] = 'mform quizaccess_proctoring_preflight_form';

        if (!NED::is_secure()){
            $mform->addElement('html', NED::div(NED::str('error:requiresecure'), 'error'));
            $mform->hideIf('submitbutton', 'cmid', 'neq', '0');
            return;
        }

        $button = function($id, $text='', $class='', $attributes=[]){
            $text = $text ? NED::str_check($text) : '';
            $attributes['id'] = $id;
            $class =  NED::str2arr($class);
            $class[] = 'proctoring-access-button';
            return NED::div(NED::tag('button', $text, $class, $attributes));
        };
        $dspan = function($id, $text='', $label='', $class='', $attributes=[]){
            $attributes['id'] = $id;
            $text = $text ? NED::str($text) : '';
            $res = NED::span($text, $class, $attributes);
            if (!empty($label)){
                $res = NED::str($label).NED::HTML_SPACE.$res;
            }
            return NED::div($res);
        };

        $coursedata = $this->get_courseid_cmid_from_preflight_form($quizform);
        // Get Screenshot Delay and Image Width.
        $camshotdelay = NED::cfg_camshotdelay();
        $faceidcheck = NED::cfg_faceidcheck();
        $enablescreenshare = NED::cfg_enablescreenshare();

        $record = (object)[];
        $record->id = 0;
        $record->courseid = (int)$coursedata['courseid'];
        $record->cmid = (int)$coursedata['cmid'];
        $record->attemptid = $attemptid;
        $record->camshotdelay = $camshotdelay;
        $record->enablescreenshare = $enablescreenshare;
        $record->faceidcheck = $faceidcheck;
        $record->version = NED::get_config('version');
        $record->detail_debug = static::_JS_DETAIL_DEBUG;

        NED::js_call_amd('startAttempt', 'setupBeforeAttempt', $record);

        $mform->addElement('html', "<div class='quiz-check-form quizaccess-proctoring-form'>");
        if ($enablescreenshare){
            $attributesarray = $mform->_attributes;
            $attributesarray['target'] = '_blank';
            $mform->_attributes = $attributesarray;
        }

        $modalcontent = $this->make_modal_content($quizform, $enablescreenshare, $faceidcheck);

        $actionbtns = [];
        $actionbtns[] = $button('allow_camera_btn', 'modal:allowcamera');
        if ($enablescreenshare){
            $actionbtns[] = $button('share_screen_btn', 'modal:sharescreenbtn');
            if ($faceidcheck){
                $actionbtns[] = $dspan('face_validation_result','modal:pending','modal:facevalidation');
            }
        }
        if ($faceidcheck){
            $actionbtns[] = $button('fcvalidate', NED::div('', 'loadingspinner', ['id' => 'loading_spinner'])
                .NED::str('modal:validateface'));
        }

        $actionbtnhtml = NED::d_container(NED::d_row_col($actionbtns));
        $mform->addElement('html', $modalcontent);
        $mform->addElement('static', 'actionbtns', '', $actionbtnhtml);
        $mform->addElement('checkbox', 'proctoring_checkbox', '', NED::str('proctoringlabel'));
        $mform->addElement('html', "</div>");
    }

    /**
     * Validate the pre-flight check form submission. You should only do
     * something here if {@link is_preflight_check_required()} returned true.
     *
     * If the form validates, the user will be allowed to continue.
     *
     * @param array $data the submitted form data.
     * @param array $files any files in the submission.
     * @param array $errors the list of validation errors that is being built up.
     * @param int|null $attemptid the id of the current attempt, if there is one,
     *      otherwise null.
     *
     * @return array the update $errors array;
     */
    public function validate_preflight_check($data, $files, $errors, $attemptid){
        if (!NED::is_secure()){
            $errors['error:requiresecure'] = NED::str('error:requiresecure');
        }
        if (empty($data['proctoring'])){
            $errors['proctoring'] = NED::str('youmustagree');
        }

        return $errors;
    }

    /**
     * Information, such as might be shown on the quiz view page, relating to this restriction.
     * There is no obligation to return anything. If it is not appropriate to tell students
     * about this rule, then just return ''.
     *
     * @param mod_quiz\quiz_settings|object $quizobj
     * @param int $timenow
     * @param bool $canignoretimelimits
     *
     * @return static|quizaccess_proctoring|null
     */
    public static function make($quizobj, $timenow, $canignoretimelimits){
        if (empty($quizobj->get_quiz()->proctoringrequired)){
            return null;
        }
        return new self($quizobj, $timenow);
    }

    /**
     * Add any fields that this rule requires to the quiz settings form. This
     * method is called from mod_quiz_mod_form::definition(), while the
     * security section is being built.
     *
     * @param mod_quiz_mod_form $quizform the quiz settings form that is being built.
     * @param MoodleQuickForm $mform the wrapped MoodleQuickForm.
     */
    public static function add_settings_form_fields(mod_quiz_mod_form $quizform, MoodleQuickForm $mform){
        $mform->addElement('select', 'proctoringrequired',
            NED::str('proctoringrequired'),
            [
                0 => NED::str('notrequired'),
                1 => NED::str('proctoringrequiredoption'),
            ]);
        $mform->addHelpButton('proctoringrequired', 'proctoringrequired', NED::$PLUGIN_NAME);
    }

    /**
     * Save any submitted settings when the quiz settings form is submitted. This
     * is called from quiz_after_add_or_update() in lib.php.
     *
     * @param object $quiz the data from the quiz form, including $quiz->id
     *      which is the id of the quiz being saved.
     */
    public static function save_settings($quiz){
        global $DB;
        if (empty($quiz->proctoringrequired)){
            static::delete_settings($quiz);
        } else {
            if (!$DB->record_exists(NED::TABLE_QP, ['quizid' => $quiz->id])){
                $record = new stdClass();
                $record->quizid = $quiz->id;
                $record->proctoringrequired = 1;
                $DB->insert_record(NED::TABLE_QP, $record);
            }
        }
    }

    /**
     * Delete any rule-specific settings when the quiz is deleted. This is called
     * from quiz_delete_instance() in lib.php.
     *
     * @param object $quiz the data from the database, including $quiz->id
     *      which is the id of the quiz being deleted.
     */
    public static function delete_settings($quiz){
        global $DB;
        $DB->delete_records(NED::TABLE_QP, ['quizid' => $quiz->id]);
    }

    /**
     * Return the bits of SQL needed to load all the settings from all the access
     * plugins in one DB query. The easiest way to understand what you need to do
     * here is probalby to read the code of quiz_access_manager::load_settings().
     *
     * If you have some settings that cannot be loaded in this way, then you can
     * use the get_extra_settings() method instead, but that has
     * performance implications.
     *
     * @param int $quizid the id of the quiz we are loading settings for. This
     *     can also be accessed as quiz.id in the SQL. (quiz is a table alisas for {quiz}.)
     *
     * @return array with three elements:
     *     1. fields: any fields to add to the select list. These should be alised
     *        if neccessary so that the field name starts the name of the plugin.
     *     2. joins: any joins (should probably be LEFT JOINS) with other tables that
     *        are needed.
     *     3. params: array of placeholder values that are needed by the SQL. You must
     *        used named placeholders, and the placeholder names should start with the
     *        plugin name, to avoid collisions.
     */
    public static function get_settings_sql($quizid){
        return [
            'proctoringrequired',
            'LEFT JOIN {'.NED::TABLE_QP.'} proctoring ON proctoring.quizid = quiz.id',
            []
        ];
    }

    /**
     * Information, such as might be shown on the quiz view page, relating to this restriction.
     * There is no obligation to return anything. If it is not appropriate to tell students
     * about this rule, then just return ''.
     *
     * @return array|null a message, or array of messages, explaining the restriction
     *         (may be '' if no message is appropriate).
     */
    public function description(){
        if (!NED::is_secure()) return null;

        $messages = [NED::str('proctoringheader')];
        $messages[] = $this->get_download_config_button();

        return $messages;
    }

    /**
     * Whether the user should be blocked from starting a new attempt or continuing
     * an attempt now.
     *
     * @return string false if access should be allowed, a message explaining the
     *      reason if access should be prevented.
     */
    public function prevent_access(){
        if (!NED::is_secure()){
            return NED::div(NED::str('error:requiresecure'), 'error');
        }
        return false;
    }

    /**
     * Sets up the attempt (review or summary) page with any special extra
     * properties required by this rule.
     *
     * @param moodle_page $page the page object to initialise.
     */
    public function setup_attempt_page($page){
        global $DB, $USER;
        $page->add_body_class('quizaccess_proctoring');
        if (!NED::is_secure()) return;

        $page->set_title($this->quizobj->get_course()->shortname . ': ' . $page->title);
        $page->set_popup_notification_allowed(false); // Prevent message notifications.
        $page->set_heading($page->title);

        $cm = NED::get_cm_by_cmid($this->quizobj->get_cmid(), $this->quiz->course, null, 'quiz');
        if ($cm){
            $record = new stdClass();
            $record->courseid = $this->quiz->course;
            $record->cmid = $cm->id;
            $record->userid = $USER->id;
            $record->webcampicture = '';
            $record->status = optional_param('attempt', 0, PARAM_INT);
            $record->timemodified = time();
            $record->id = $DB->insert_record(NED::TABLE_LOG, $record, true);

            // Get Screenshot Delay and Image Width.
            $record->image_width = NED::cfg_imagewidth();
            $record->enablescreenshare = NED::cfg_enablescreenshare();
            $record->quizurl = $cm->get_url()->out(false);
            $record->version = NED::get_config('version');
            $record->detail_debug = static::_JS_DETAIL_DEBUG;

            NED::js_call_amd('startAttempt', 'setup', $record);
        }
    }

    /**
     * Get a button to view the Proctoring report.
     *
     * @return string A link to view report
     */
    protected function get_download_config_button() : string {
        global $OUTPUT, $USER;

        $context = context_module::instance($this->quiz->cmid, MUST_EXIST);
        if (NED::has_capability('viewreport', $context, $USER->id)){
            $httplink = \quizaccess_proctoring\link_generator::get_link($this->quiz->course, $this->quiz->cmid, false, is_https());

            return $OUTPUT->single_button($httplink, NED::str('picturesreport'), 'get');
        } else {
            return '';
        }
    }
}
