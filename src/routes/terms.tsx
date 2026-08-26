import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service | CareConnect Kenya" },
      {
        name: "description",
        content:
          "Terms governing use of CareConnect Kenya by licensed health facilities: accounts, clinical responsibility, payments and data obligations.",
      },
      { property: "og:title", content: "Terms of Service | CareConnect Kenya" },
      {
        property: "og:description",
        content: "The agreement between CareConnect Kenya and the health facilities using the platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <Link to="/auth" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: 21 August 2026</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="mb-2 text-lg font-semibold">1. Acceptance</h2>
          <p>
            By creating an account or using CareConnect Kenya ("the Platform"), you agree to these Terms on behalf of
            yourself and the health facility you represent. If you do not agree, do not use the Platform.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">2. Eligibility</h2>
          <p>
            The Platform is intended for health facilities, pharmacies and practitioners licensed to operate in Kenya,
            and for their authorised staff. You are responsible for ensuring that the practitioners using it hold valid
            registration with the relevant regulator (KMPDC, PPB, NCK and others as applicable).
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">3. Accounts and access</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Accounts are personal. Do not share credentials; each staff member gets their own login and role.</li>
            <li>Facility owners and admins are responsible for granting and promptly revoking staff access.</li>
            <li>You must report suspected unauthorised access immediately.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">4. Clinical responsibility</h2>
          <p>
            The Platform is a record-keeping and decision-support tool. It does not practise medicine. Drug-interaction
            checks, prescription-anomaly detection, credit scoring, reorder forecasts and outbreak signals are
            <strong> advisory only</strong>, may be incomplete or wrong, and must be reviewed by a qualified
            practitioner. All clinical decisions, diagnoses and prescriptions remain the sole responsibility of the
            treating practitioner and the facility.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">5. Your data obligations</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Obtain and record patient consent before entering their data.</li>
            <li>Enter accurate data and keep records up to date.</li>
            <li>Access patient records only where clinically or administratively necessary — all access is audited.</li>
            <li>Comply with the Kenya Data Protection Act, 2019 and applicable health-records regulations.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">6. Acceptable use</h2>
          <p>
            Do not use the Platform to issue false prescriptions, misrepresent claims to the Social Health Authority,
            dispense controlled substances unlawfully, scrape or export data you are not entitled to, probe or bypass
            security controls, or overload the service.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">7. Payments and claims</h2>
          <p>
            Mobile-money and card transactions are processed by third-party providers under their own terms. The
            Platform records transactions but does not hold funds. SHA claim data you submit is your representation;
            you are responsible for its accuracy.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">8. Availability</h2>
          <p>
            We aim for high availability and provide offline capture for intermittent connectivity, but the Platform is
            provided without guarantee of uninterrupted service. Maintain a clinically safe fallback process for
            outages.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">9. Intellectual property</h2>
          <p>
            The Platform, its software and branding remain our property. Your facility retains ownership of its
            patient and business records, and may request an export at any time.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">10. Suspension and termination</h2>
          <p>
            We may suspend access for non-payment, suspected fraud, patient-safety risk or serious breach of these
            Terms. On termination, you may export your records; afterwards data is deleted or archived in line with the
            Privacy Policy and applicable retention law.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">11. Liability</h2>
          <p>
            To the extent permitted by law, we are not liable for clinical outcomes, lost profits, or indirect losses.
            Nothing in these Terms limits liability that cannot lawfully be limited.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">12. Governing law</h2>
          <p>
            These Terms are governed by the laws of Kenya, with the courts of Kenya having jurisdiction. Questions:
            <span className="font-medium"> legal@careconnect.co.ke</span>.
          </p>
        </section>

        <p className="text-muted-foreground">
          See also our{" "}
          <Link to="/privacy" className="font-medium text-primary underline-offset-4 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
