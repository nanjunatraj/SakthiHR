// Model (starter) letter formats for every Template Master category. Each is a
// professionally-worded default that HR can edit in the Template Master designer.
// Bodies are HTML with {{merge.tokens}} (see PLACEHOLDER_GROUPS in lib/letters);
// the designer merges sample data in preview and real employee data on generate.
//
// `payslip` is intentionally excluded — its format is a JSON layout config, not an
// HTML body, and ships with its own default. The Template Master seeder only inserts
// a model for a category that currently has no formats, so existing data is untouched.

export interface LetterModel {
  /** Format name shown in the designer. */
  name: string;
  /** Subject / heading line (rendered centered above the body). */
  subject: string;
  /** Letter body — HTML with merge placeholders. */
  body: string;
  /** Render on the work-location letterhead (default true). */
  useLetterhead?: boolean;
}

// Shared fragments ----------------------------------------------------------------
const REF =
  `<table style="width:100%;border-collapse:collapse;margin:0 0 18px;font-size:13px;">` +
  `<tr><td>Ref: <strong>{{letter.refNo}}</strong></td>` +
  `<td style="text-align:right;">Date: <strong>{{date.today}}</strong></td></tr></table>`;

const WHOM = `<p style="text-align:center;font-weight:700;letter-spacing:.5px;margin:0 0 16px;">TO WHOMSOEVER IT MAY CONCERN</p>`;

const SIGN =
  `<div style="margin-top:42px;">` +
  `<p style="margin:0 0 2px;">For <strong>{{company.name}}</strong>,</p>` +
  `<div style="height:44px;"></div>` +
  `<p style="margin:0;font-weight:700;">Authorised Signatory</p>` +
  `<p style="margin:0;font-size:12px;color:#475569;">Human Resources Department</p></div>`;

const addressee =
  `<p>To,<br/><strong>{{employee.name}}</strong><br/>{{employment.designation}}, {{employment.department}}<br/>Employee ID: {{employee.code}}</p>`;

// One model per category (keys mirror LETTER_CATEGORIES) ---------------------------
export const LETTER_MODELS: Record<string, LetterModel> = {
  offer: {
    name: 'Standard Offer Letter',
    subject: 'Offer of Employment — {{employee.name}}',
    body: `${REF}
      <p>Dear {{employee.name}},</p>
      <p>Further to our discussions and the selection process, we are delighted to offer you the position of
      <strong>{{employment.designation}}</strong> in the <strong>{{employment.department}}</strong> department at
      <strong>{{employment.workLocation}}</strong>.</p>
      <p>Your annual cost to company (CTC) will be <strong>{{salary.ctcAnnual}}</strong>
      (<strong>{{salary.ctcMonthly}}</strong> per month), subject to applicable statutory deductions. Your proposed
      date of joining is <strong>{{employment.doj}}</strong>.</p>
      <p>This offer is contingent upon verification of your documents and background. Kindly sign and return a copy of
      this letter as a token of your acceptance.</p>
      <p>We look forward to welcoming you to {{company.name}}.</p>
      ${SIGN}`,
  },
  appointment: {
    name: 'Standard Appointment Order',
    subject: 'Appointment Order — {{employee.name}}',
    body: `${REF}
      <p>Dear {{employee.name}},</p>
      <p>With reference to your application and subsequent selection, we are pleased to appoint you as
      <strong>{{employment.designation}}</strong> in the <strong>{{employment.department}}</strong> department at
      <strong>{{employment.workLocation}}</strong>, with effect from <strong>{{employment.doj}}</strong>. Your Employee
      ID is <strong>{{employee.code}}</strong>.</p>
      <p>Your annual CTC shall be <strong>{{salary.ctcAnnual}}</strong>, subject to applicable statutory deductions.
      This appointment is governed by the terms of service, standing orders and policies of the organisation, as
      amended from time to time.</p>
      <p>You will be on probation as per company policy, during which your performance and conduct will be assessed for
      confirmation of services.</p>
      <p>We welcome you to the organisation and wish you a long and rewarding association.</p>
      ${SIGN}`,
  },
  experience: {
    name: 'Standard Experience Certificate',
    subject: 'Experience Certificate — {{employee.name}}',
    body: `${REF}${WHOM}
      <p>This is to certify that <strong>{{employee.name}}</strong> (Employee ID <strong>{{employee.code}}</strong>) was
      employed with <strong>{{company.name}}</strong> as <strong>{{employment.designation}}</strong> in the
      <strong>{{employment.department}}</strong> department from <strong>{{employment.doj}}</strong> to date at
      <strong>{{employment.workLocation}}</strong>.</p>
      <p>During the tenure of service, we found the conduct and performance of the employee to be satisfactory. We wish
      them success in all future endeavours.</p>
      ${SIGN}`,
  },
  relieving: {
    name: 'Standard Relieving Letter',
    subject: 'Relieving Letter — {{employee.name}}',
    body: `${REF}
      <p>Dear {{employee.name}},</p>
      <p>This is to confirm that you have been relieved from the services of <strong>{{company.name}}</strong> consequent
      to the acceptance of your resignation. You served as <strong>{{employment.designation}}</strong> in the
      <strong>{{employment.department}}</strong> department (Employee ID <strong>{{employee.code}}</strong>), having
      joined on <strong>{{employment.doj}}</strong>.</p>
      <p>We confirm that, as on the date of relieving, you have handed over charge and have no dues pending against you,
      subject to full &amp; final settlement. We thank you for your contribution and wish you the very best.</p>
      ${SIGN}`,
  },
  service: {
    name: 'Standard Service Certificate',
    subject: 'Service Certificate — {{employee.name}}',
    body: `${REF}${WHOM}
      <p>This is to certify that <strong>{{employee.name}}</strong> (Employee ID <strong>{{employee.code}}</strong>) is
      presently working with <strong>{{company.name}}</strong> as <strong>{{employment.designation}}</strong> in the
      <strong>{{employment.department}}</strong> department at <strong>{{employment.workLocation}}</strong>, and has been
      in continuous service since <strong>{{employment.doj}}</strong>.</p>
      <p>This certificate is issued at the request of the employee for record purposes.</p>
      ${SIGN}`,
  },
  resignation_acceptance: {
    name: 'Standard Resignation Acceptance',
    subject: 'Acceptance of Resignation — {{employee.name}}',
    body: `${REF}
      <p>Dear {{employee.name}},</p>
      <p>We acknowledge receipt of your resignation letter and confirm that the management has accepted your resignation
      from the post of <strong>{{employment.designation}}</strong>, <strong>{{employment.department}}</strong> department
      (Employee ID <strong>{{employee.code}}</strong>).</p>
      <p>You are requested to ensure proper handover of your responsibilities and company property before your last
      working day. Your full &amp; final settlement and relieving documents will be processed thereafter.</p>
      <p>We thank you for your services and wish you success in your future endeavours.</p>
      ${SIGN}`,
  },
  fnf: {
    name: 'Standard Full & Final Settlement',
    subject: 'Full & Final Settlement — {{employee.name}}',
    body: `${REF}
      <p>Dear {{employee.name}},</p>
      <p>This is with reference to the cessation of your employment with <strong>{{company.name}}</strong>. The summary
      of your full &amp; final settlement is given below (Employee ID <strong>{{employee.code}}</strong>, Designation
      <strong>{{employment.designation}}</strong>).</p>
      <table style="width:100%;border-collapse:collapse;margin:8px 0 14px;font-size:13px;">
        <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;font-weight:700;">Particulars</td><td style="border:1px solid #cbd5e1;padding:6px 10px;text-align:right;font-weight:700;">Amount</td></tr>
        <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;">Salary &amp; arrears payable</td><td style="border:1px solid #cbd5e1;padding:6px 10px;text-align:right;">__________</td></tr>
        <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;">Leave encashment</td><td style="border:1px solid #cbd5e1;padding:6px 10px;text-align:right;">__________</td></tr>
        <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;">Gratuity (if applicable)</td><td style="border:1px solid #cbd5e1;padding:6px 10px;text-align:right;">__________</td></tr>
        <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;">Less: Recoveries / notice pay</td><td style="border:1px solid #cbd5e1;padding:6px 10px;text-align:right;">__________</td></tr>
        <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;font-weight:700;">Net Settlement</td><td style="border:1px solid #cbd5e1;padding:6px 10px;text-align:right;font-weight:700;">__________</td></tr>
      </table>
      <p>The net amount will be credited to your registered bank account within the stipulated timeline. Kindly treat
      this as the final settlement of all your dues.</p>
      ${SIGN}`,
  },
  exit_interview: {
    name: 'Standard Exit Interview Letter',
    subject: 'Exit Interview — {{employee.name}}',
    body: `${REF}
      <p>Dear {{employee.name}},</p>
      <p>As you prepare to move on from <strong>{{company.name}}</strong>, we would value your feedback through a brief
      exit interview. Your candid responses will help us improve the workplace for our colleagues.</p>
      <p>You are requested to make yourself available for the exit interview before your last working day. Please reach
      out to the HR department to schedule a convenient time.</p>
      <p>We thank you for your association and wish you the best in your future endeavours.</p>
      ${SIGN}`,
  },
  show_cause: {
    name: 'Standard Show-Cause Notice',
    subject: 'Show-Cause Notice — {{employee.name}}',
    body: `${REF}${addressee}
      <p>It has been observed that you have remained absent from duty without prior intimation or sanctioned leave for a
      continuous period, despite your reporting obligations. Your unauthorised absence amounts to misconduct under the
      standing orders of the company.</p>
      <p>You are hereby called upon to explain, in writing, within <strong>three (3) days</strong> of receipt of this
      notice, the reasons for your absence and why disciplinary action should not be initiated against you. Failure to
      respond will constrain the management to proceed ex-parte.</p>
      ${SIGN}`,
  },
  termination: {
    name: 'Standard Termination Letter',
    subject: 'Termination of Services — {{employee.name}}',
    body: `${REF}${addressee}
      <p>Despite earlier communication(s) and a show-cause notice, you have failed to report to duty or offer any
      satisfactory explanation for your continued unauthorised absence. Your conduct is treated as voluntary abandonment
      of service / gross misconduct.</p>
      <p>In view of the above, the management hereby terminates your services with <strong>{{company.name}}</strong> with
      effect from the date of this letter. You are advised to collect your dues, if any, after completing the necessary
      formalities.</p>
      ${SIGN}`,
  },
  retirement_notice: {
    name: 'Standard Retirement Notice',
    subject: 'Notice of Superannuation — {{employee.name}}',
    body: `${REF}
      <p>Dear {{employee.name}},</p>
      <p>This is to formally notify you that, in accordance with the service rules of <strong>{{company.name}}</strong>,
      you will retire from the services of the company on attaining the age of superannuation. You currently serve as
      <strong>{{employment.designation}}</strong>, <strong>{{employment.department}}</strong> department (Employee ID
      <strong>{{employee.code}}</strong>), having joined on <strong>{{employment.doj}}</strong>.</p>
      <p>The HR department will assist you with the retirement formalities, gratuity, provident fund and other terminal
      benefits. We place on record our sincere appreciation for your long and dedicated service.</p>
      ${SIGN}`,
  },
  condolence: {
    name: 'Standard Condolence Letter',
    subject: 'With Deepest Condolences',
    body: `${REF}
      <p>Dear Family of {{employee.name}},</p>
      <p>It is with profound grief that we learnt of the sad and untimely demise of <strong>{{employee.name}}</strong>,
      who served as <strong>{{employment.designation}}</strong> in the <strong>{{employment.department}}</strong>
      department of <strong>{{company.name}}</strong>.</p>
      <p>On behalf of the management and the entire team, we extend our heartfelt condolences to the bereaved family. The
      contribution and goodwill of the departed will always be remembered. Please be assured of our support during this
      difficult time.</p>
      <p>May the departed soul rest in peace.</p>
      ${SIGN}`,
  },
  leave_application: {
    name: 'Standard Leave Application',
    subject: 'Leave Application — {{employee.name}}',
    useLetterhead: false,
    body: `${REF}
      <p>To,<br/>The Manager,<br/>{{employment.department}} Department,<br/>{{company.name}}</p>
      <p>Respected Sir/Madam,</p>
      <p>I, <strong>{{employee.name}}</strong> (Employee ID <strong>{{employee.code}}</strong>), working as
      <strong>{{employment.designation}}</strong>, request you to kindly grant me leave for the period from
      __________ to __________ on account of __________.</p>
      <p>I will ensure that my responsibilities are handed over before proceeding on leave. Kindly grant me leave for the
      said period.</p>
      <p>Thanking you,<br/>Yours faithfully,<br/><strong>{{employee.name}}</strong></p>`,
  },
  loan_application: {
    name: 'Standard Loan / Advance Application',
    subject: 'Loan / Advance Application — {{employee.name}}',
    useLetterhead: false,
    body: `${REF}
      <p>To,<br/>The HR / Accounts Department,<br/>{{company.name}}</p>
      <p>Respected Sir/Madam,</p>
      <p>I, <strong>{{employee.name}}</strong> (Employee ID <strong>{{employee.code}}</strong>), working as
      <strong>{{employment.designation}}</strong> in the <strong>{{employment.department}}</strong> department, request a
      loan/advance of ₹__________ to meet __________.</p>
      <p>I undertake to repay the amount in __________ monthly instalments through deduction from my salary. I request
      you to kindly consider and approve my application.</p>
      <p>Thanking you,<br/>Yours faithfully,<br/><strong>{{employee.name}}</strong></p>`,
  },
  deduction: {
    name: 'Standard Deduction Intimation',
    subject: 'Salary Deduction Intimation — {{employee.name}}',
    body: `${REF}
      <p>Dear {{employee.name}},</p>
      <p>This is to inform you that a deduction will be effected from your salary as detailed below. You are
      <strong>{{employment.designation}}</strong>, <strong>{{employment.department}}</strong> department (Employee ID
      <strong>{{employee.code}}</strong>).</p>
      <table style="width:100%;border-collapse:collapse;margin:8px 0 14px;font-size:13px;">
        <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;">Reason for deduction</td><td style="border:1px solid #cbd5e1;padding:6px 10px;">__________</td></tr>
        <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;">Amount</td><td style="border:1px solid #cbd5e1;padding:6px 10px;">₹__________</td></tr>
        <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;">Effective month</td><td style="border:1px solid #cbd5e1;padding:6px 10px;">__________</td></tr>
      </table>
      <p>If you have any clarification regarding this deduction, please contact the HR department within three days of
      receipt of this intimation.</p>
      ${SIGN}`,
  },
  disciplinary: {
    name: 'Standard Disciplinary Action Letter',
    subject: 'Disciplinary Action — {{employee.name}}',
    body: `${REF}${addressee}
      <p>This has reference to the incident/conduct on your part observed on __________, which is in violation of the
      company's code of conduct and standing orders.</p>
      <p>After careful consideration of the facts and your explanation, the management has decided to impose the
      following disciplinary action: __________.</p>
      <p>You are advised to maintain proper conduct and discipline henceforth. Any recurrence will invite stricter
      action.</p>
      ${SIGN}`,
  },
  memo: {
    name: 'Standard Memorandum',
    subject: 'Memorandum — {{employee.name}}',
    body: `<table style="width:100%;border-collapse:collapse;margin:0 0 16px;font-size:13px;">
        <tr><td style="padding:3px 0;width:90px;"><strong>To</strong></td><td style="padding:3px 0;">{{employee.name}} ({{employee.code}}), {{employment.designation}}</td></tr>
        <tr><td style="padding:3px 0;"><strong>From</strong></td><td style="padding:3px 0;">HR Department, {{company.name}}</td></tr>
        <tr><td style="padding:3px 0;"><strong>Date</strong></td><td style="padding:3px 0;">{{date.today}}</td></tr>
        <tr><td style="padding:3px 0;"><strong>Ref</strong></td><td style="padding:3px 0;">{{letter.refNo}}</td></tr>
      </table>
      <p>This memorandum is issued to bring to your attention the following: __________.</p>
      <p>You are requested to take note and act accordingly. Please acknowledge receipt of this memorandum.</p>
      ${SIGN}`,
  },
  late_warning: {
    name: 'Standard Late-Coming Warning',
    subject: 'Warning — Habitual Late Coming — {{employee.name}}',
    body: `${REF}${addressee}
      <p>It has been observed from the attendance records that you have been reporting to duty late on several occasions,
      in violation of the working-hours discipline of the company.</p>
      <p>You are hereby warned to report to duty on time henceforth. Failure to improve will be viewed seriously and may
      invite disciplinary action, including deduction of wages for late attendance.</p>
      ${SIGN}`,
  },
  lop_absence: {
    name: 'Standard Unauthorised Absence / LOP',
    subject: 'Unauthorised Absence / Loss of Pay — {{employee.name}}',
    body: `${REF}${addressee}
      <p>Our records indicate that you remained absent from duty without prior sanction of leave during the period
      __________ to __________. The said absence is being treated as unauthorised and the corresponding days will be
      marked as Loss of Pay (LOP).</p>
      <p>You are advised to regularise your attendance and apply for leave in advance as per company policy. Repeated
      unauthorised absence will attract disciplinary action.</p>
      ${SIGN}`,
  },
};
