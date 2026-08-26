import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | CareConnect Kenya" },
      {
        name: "description",
        content:
          "How CareConnect Kenya collects, stores and protects patient health data under the Kenya Data Protection Act, 2019.",
      },
      { property: "og:title", content: "Privacy Policy | CareConnect Kenya" },
      {
        property: "og:description",
        content: "Patient data handling, consent, retention and your rights under the Kenya Data Protection Act, 2019.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <Link to="/auth" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: 21 August 2026</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="mb-2 text-lg font-semibold">1. Who we are</h2>
          <p>
            CareConnect Kenya ("the Platform") provides clinical, pharmacy and health-records software to licensed
            Kenyan health facilities. Each facility using the Platform is the <strong>data controller</strong> of its
            patients' records. CareConnect Kenya acts as a <strong>data processor</strong> on that facility's
            instructions, in line with the Kenya Data Protection Act, 2019 (DPA).
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">2. What we collect</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Patient data:</strong> name, date of birth, gender, contacts, county, national ID and SHA number, visit notes, diagnoses, prescriptions, lab results and chronic-care details.</li>
            <li><strong>Facility data:</strong> staff accounts, roles, inventory, sales, claims and accounting records.</li>
            <li><strong>Technical data:</strong> sign-in events, audit records of who accessed which record, and error diagnostics.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">3. Health data and consent</h2>
          <p>
            Health information is <em>sensitive personal data</em> under the DPA. Facilities must record the patient's
            consent before entering their record on the Platform, and the Platform stores the date and method of that
            consent. Patients may withdraw consent at any time by contacting their facility; the Platform then stops
            processing their data for reminders and analytics.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">4. How data is used</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Delivering care: records, prescriptions, lab results, appointments and telemedicine.</li>
            <li>Medication reminders and appointment notifications over SMS, WhatsApp or Telegram, using only the channels the patient chose.</li>
            <li>SHA claim preparation and facility bookkeeping.</li>
            <li>Aggregated, de-identified county-level disease trends for public-health insight. No individual patient is identifiable in these views.</li>
            <li>Safety and fraud checks on prescriptions.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">5. Access control and audit</h2>
          <p>
            Records are isolated per facility: staff of one facility cannot see another facility's patients. Access is
            further limited by role (owner, admin, doctor, pharmacist, cashier, staff, community health volunteer).
            Every access to and change of a patient record is written to an append-only audit trail that facility
            owners and administrators can review and that nobody can edit or erase.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">6. Storage, retention and transfers</h2>
          <p>
            Data is encrypted in transit and at rest and hosted in managed cloud infrastructure with automated backups
            and a documented disaster-recovery process. Facilities may set a retention date per patient record; unless
            a longer statutory period applies, records are retained while the patient relationship is active and then
            archived or deleted on the facility's instruction. Where processing occurs outside Kenya, it is done under
            contractual safeguards as required by the DPA.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">7. Third-party processors</h2>
          <p>
            We use vetted providers strictly to deliver features you enable: messaging (SMS/WhatsApp/Telegram),
            video consultation, mobile-money payment processing, and cloud hosting. They process data only as needed
            to provide that service.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">8. Your rights</h2>
          <p>
            You may request access to your record, correction of inaccurate data, deletion where the law permits,
            a copy of your data, or that you no longer receive automated reminders. Contact your health facility
            first, as they control the record. Complaints may be escalated to the Office of the Data Protection
            Commissioner (ODPC), Kenya.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">9. Breach notification</h2>
          <p>
            If a breach is likely to cause real risk to patients, we notify the affected facility without undue delay
            and support notification to the ODPC and to patients as required by law.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">10. Contact</h2>
          <p>
            Data protection queries: <span className="font-medium">privacy@careconnect.co.ke</span>. Facilities should
            also identify their own data protection contact to their patients.
          </p>
        </section>
      </div>
    </main>
  );
}
