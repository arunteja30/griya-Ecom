import React from 'react';
import { Link } from 'react-router-dom';

export default function Privacy() {
  const lastUpdated = "January 1, 2026";

  const sections = [
    {
      title: "Information We Collect",
      content: [
        "Account information: Name, email address, phone number, and business details when you register as a merchant.",
        "Transaction data: Information about your sales, orders, payment processing, and customer interactions.",
        "Product information: Details about the products you list, including descriptions, images, and pricing.",
        "Usage data: How you interact with our platform, including pages visited, features used, and time spent.",
        "Device information: Browser type, operating system, IP address, and device identifiers."
      ]
    },
    {
      title: "How We Use Your Information",
      content: [
        "Provide and maintain the merchant platform and services.",
        "Process transactions and facilitate order management.",
        "Generate analytics and insights about your store performance.",
        "Communicate with you about your account, orders, and platform updates.",
        "Provide customer support and respond to your inquiries.",
        "Improve our platform features and user experience.",
        "Comply with legal obligations and prevent fraudulent activities."
      ]
    },
    {
      title: "Information Sharing",
      content: [
        "We do not sell, trade, or rent your personal information to third parties.",
        "Customer information: Order details are shared with customers for delivery purposes.",
        "Service providers: We may share data with trusted partners who help us provide services (payment processors, hosting providers).",
        "Legal requirements: We may disclose information when required by law or to protect our rights.",
        "Business transfers: In case of merger or acquisition, your data may be transferred to the new entity."
      ]
    },
    {
      title: "Data Security",
      content: [
        "We implement industry-standard security measures to protect your data.",
        "All data transmission is encrypted using SSL/TLS protocols.",
        "Payment information is processed through PCI-compliant payment processors.",
        "Regular security audits and monitoring are conducted.",
        "Access to your data is restricted to authorized personnel only.",
        "We maintain backup systems to prevent data loss."
      ]
    },
    {
      title: "Your Rights",
      content: [
        "Access: You can request a copy of the personal data we hold about you.",
        "Correction: You can update or correct your account information at any time.",
        "Deletion: You can request deletion of your account and associated data.",
        "Portability: You can request your data in a machine-readable format.",
        "Opt-out: You can unsubscribe from marketing communications.",
        "Object: You can object to certain types of data processing."
      ]
    },
    {
      title: "Data Retention",
      content: [
        "Account data is retained for as long as your merchant account is active.",
        "Transaction records are kept for 7 years for accounting and tax purposes.",
        "Analytics data may be retained in aggregated, anonymized form for business intelligence.",
        "After account deletion, some data may be retained for legal compliance.",
        "You can request specific data deletion by contacting our support team."
      ]
    },
    {
      title: "Cookies and Tracking",
      content: [
        "We use cookies to enhance your experience and maintain your login session.",
        "Analytics cookies help us understand platform usage and improve features.",
        "You can control cookie settings through your browser preferences.",
        "Third-party services may use their own cookies (payment processors, analytics).",
        "We do not use cookies for advertising or cross-site tracking."
      ]
    },
    {
      title: "Third-Party Services",
      content: [
        "Payment processing is handled by secure third-party providers.",
        "Cloud hosting services may process your data in different geographic locations.",
        "Integration partners may access specific data as needed for their services.",
        "All third-party providers are required to maintain appropriate security standards.",
        "We regularly review our third-party relationships for compliance."
      ]
    }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Privacy Policy</h1>
          <p className="text-gray-600 mt-1">Last updated: {lastUpdated}</p>
        </div>
        <Link
          to="/settings"
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Settings
        </Link>
      </div>

      {/* Introduction */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Introduction</h2>
        <div className="prose text-gray-600">
          <p className="mb-4">
            At Griya Ecom, we are committed to protecting your privacy and ensuring the security of your personal information. 
            This Privacy Policy explains how we collect, use, share, and protect information about you when you use our 
            merchant platform and services.
          </p>
          <p className="mb-4">
            By using our platform, you agree to the collection and use of information in accordance with this policy. 
            We may update this policy from time to time, and we will notify you of any material changes.
          </p>
        </div>
      </div>

      {/* Policy Sections */}
      <div className="space-y-6">
        {sections.map((section, index) => (
          <div key={index} className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{section.title}</h2>
            <ul className="space-y-2">
              {section.content.map((item, itemIndex) => (
                <li key={itemIndex} className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-primary-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-600">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Contact Information */}
      <div className="bg-primary-50 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Questions about Privacy?</h3>
            <p className="text-gray-600 mb-4">
              If you have any questions about this Privacy Policy or how we handle your data, please contact us:
            </p>
            <div className="space-y-1 text-sm">
              <p className="text-gray-700">Email: privacy@griya-ecom.com</p>
              <p className="text-gray-700">Phone: +1 (555) 123-4567</p>
              <p className="text-gray-700">Address: 123 Business Ave, Suite 100, City, State 12345</p>
            </div>
            <div className="mt-4 space-x-3">
              <Link
                to="/support"
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
              >
                Contact Support
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
