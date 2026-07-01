// Single source of truth for the Employee Documents Repository taxonomy.
//
// Two groups:
//   • employment — HR-managed, HR-signed (offer/appointment/onboarding/assets/salary revision).
//                  Only HR Manager and above may upload; employees may view/download.
//   • personal   — the employee's own records (ID/education/address/medical/other). HR Manager+
//                  may upload directly (auto-approved); the employee may upload via the portal,
//                  which requires a self eSign and HR approval.

export type DocGroup = 'employment' | 'personal';
export type ApprovalStatus = 'approved' | 'pending' | 'rejected';
export type UploadedVia = 'admin' | 'portal';

export interface DocTypeMeta {
  type: string;
  group: DocGroup;
  label: string;
}

export const EMPLOYMENT_TYPES: DocTypeMeta[] = [
  { type: 'offer_letter',          group: 'employment', label: 'Offer Letter' },
  { type: 'appointment_letter',    group: 'employment', label: 'Appointment Letter' },
  { type: 'onboarding_letter',     group: 'employment', label: 'Onboarding Letter' },
  { type: 'assets_charge_letter',  group: 'employment', label: 'Assets Charge Letter' },
  { type: 'salary_revision_letter',group: 'employment', label: 'Salary Revision Letter' },
];

export const PERSONAL_TYPES: DocTypeMeta[] = [
  { type: 'id_proof',              group: 'personal',   label: 'ID Proof' },
  { type: 'education_certificate', group: 'personal',   label: 'Education Certificate' },
  { type: 'address_proof',         group: 'personal',   label: 'Address Proof' },
  { type: 'medical_certificate',   group: 'personal',   label: 'Medical Certificate' },
  { type: 'other',                 group: 'personal',   label: 'Other Document' },
];

export const ALL_DOC_TYPES: DocTypeMeta[] = [...EMPLOYMENT_TYPES, ...PERSONAL_TYPES];

const BY_TYPE: Record<string, DocTypeMeta> = Object.fromEntries(ALL_DOC_TYPES.map((d) => [d.type, d]));

/** Metadata for a doc-type slug (falls back to a Title-Cased 'other'/personal). */
export function docTypeMeta(type: string | null | undefined): DocTypeMeta {
  const key = (type ?? '').trim();
  return BY_TYPE[key] ?? { type: key || 'other', group: 'personal', label: titleCase(key || 'other') };
}

/** The group a doc-type belongs to. */
export function groupOf(type: string | null | undefined): DocGroup {
  return docTypeMeta(type).group;
}

export function isEmployment(type: string | null | undefined): boolean {
  return groupOf(type) === 'employment';
}

export function typesForGroup(group: DocGroup): DocTypeMeta[] {
  return group === 'employment' ? EMPLOYMENT_TYPES : PERSONAL_TYPES;
}

export const GROUP_LABEL: Record<DocGroup, string> = {
  employment: 'Employment',
  personal: 'Personal Details',
};

/**
 * Who may upload a given group from the ADMIN app.
 *   • employment — HR Manager and above only.
 *   • personal   — HR Manager and above (auto-approved); employees upload via the portal instead.
 * (Role gating is also enforced by RLS; this drives the UI.)
 */
export function canAdminUpload(group: DocGroup, isDocAdmin: boolean): boolean {
  return isDocAdmin; // both groups are admin-uploadable only by HR Manager+ in the admin app
}

/** Employment docs are signed by HR; personal-portal docs are self-signed by the employee. */
export function requiresHrSignature(group: DocGroup): boolean {
  return group === 'employment';
}

function titleCase(s: string): string {
  return s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
