import React from 'react';
import { PRODUCT_NAME } from '../lib/product';

/**
 * Minimal legal pages (staging placeholder — owner to supply final text).
 * Rendered for /terms and /privacy before the app shell mounts.
 */

const shell = 'min-h-screen bg-stone-50 text-stone-900 px-6 py-12';
const card = 'max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-stone-200 p-8';

export function TermsPage(): React.JSX.Element {
  return (
    <div className={shell}>
      <div className={card}>
        <h1 className="text-2xl font-bold mb-1">Terms of Service</h1>
        <p className="text-sm text-stone-500 mb-6">{PRODUCT_NAME} — placeholder text, to be replaced by the owner.</p>
        <div className="space-y-4 text-sm leading-6 text-stone-700">
          <p>These terms govern your use of {PRODUCT_NAME}, a construction project management service operated for contractors in Kenya.</p>
          <p><strong>Accounts.</strong> You are responsible for the accuracy of information in your workspace and for keeping your credentials confidential. Company administrators control member access.</p>
          <p><strong>Data.</strong> You retain ownership of the data you enter. You grant us the right to process it to provide the service, including hosting, backups and support.</p>
          <p><strong>Payments.</strong> Subscription and usage charges are billed as described at sign-up. Statutory deductions (WHT, VAT) are applied where applicable under Kenyan law.</p>
          <p><strong>Acceptable use.</strong> You must not misuse the service, attempt to access other tenants' data, or use the platform for unlawful purposes.</p>
          <p><strong>Availability.</strong> We aim for high availability but do not guarantee uninterrupted service. Planned maintenance will be notified where practicable.</p>
          <p><strong>Liability.</strong> To the extent permitted by Kenyan law, our liability is limited to the fees you paid in the preceding twelve months.</p>
          <p><strong>Governing law.</strong> These terms are governed by the laws of Kenya.</p>
        </div>
        <p className="mt-8 text-xs text-stone-400">Last updated: placeholder — owner to confirm.</p>
      </div>
    </div>
  );
}

export function PrivacyPage(): React.JSX.Element {
  return (
    <div className={shell}>
      <div className={card}>
        <h1 className="text-2xl font-bold mb-1">Privacy Policy</h1>
        <p className="text-sm text-stone-500 mb-6">{PRODUCT_NAME} — placeholder text, to be replaced by the owner.</p>
        <div className="space-y-4 text-sm leading-6 text-stone-700">
          <p>We collect the information needed to run your construction workspace: account details (name, email, phone), project and site data, documents and photos you upload, and audit records of actions taken in the system.</p>
          <p><strong>How we use it.</strong> Your data is used to provide the service — dashboards, portals for clients and suppliers, reports, and notifications. We do not sell personal data.</p>
          <p><strong>Hosting.</strong> Data is hosted on cloud infrastructure. Some processing may occur outside Kenya; we apply appropriate safeguards under the Data Protection Act, 2019.</p>
          <p><strong>Sharing.</strong> Data is shared only with parties you invite (clients, consultants, suppliers, subcontractors) through scoped portal links, and with processors needed to run the service (hosting, email/SMS delivery where configured).</p>
          <p><strong>Retention &amp; export.</strong> Company administrators can export their company data at any time from the team settings. Deletion requests are handled per our retention policy.</p>
          <p><strong>Your rights.</strong> Under the Data Protection Act, 2019 you may request access to, correction of, or deletion of your personal data by contacting us.</p>
        </div>
        <p className="mt-8 text-xs text-stone-400">Last updated: placeholder — owner to confirm.</p>
      </div>
    </div>
  );
}
