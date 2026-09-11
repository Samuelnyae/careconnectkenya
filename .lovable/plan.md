# Referrals and Admissions

## Scope
Add referrals and inpatient admissions as first-class patient workflows, using the existing patient record and role permissions.

## What will be built
- Referral records with direction, facility/service, urgency, clinical reason, status, appointment date, notes, and completion tracking.
- Admission records with admission date, type, ward, bed, attending clinician, diagnosis, status, discharge date, outcome, instructions, and notes.
- Patient-record tabs to create, review, update, complete, cancel, discharge, and reopen these records.
- Clear active-status badges and summaries so staff can quickly identify pending referrals and current admissions.
- Tenant-scoped database access, audit entries, timestamps, validation, and indexes matching existing security conventions.

## Technical details
- Add `patient_referrals` and `patient_admissions` through one database migration with grants, row-level security policies, foreign keys to public patient/visit records, validation constraints, and updated-at triggers.
- Add focused React panels for referral and admission workflows rather than overloading the generic clinical list.
- Extend patient domain constants and audit action types, then integrate both panels into the existing patient clinical tabs.
- Refresh generated database types after migration, then run patient tests and verify the preview build.

## Out of scope
- A full hospital-wide bed inventory or ward-capacity planner.
- External electronic referral exchange with another facility.
