import { KolosLogo } from "@/app/components/svg"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export const metadata = {
  title: "Terms of Service - Kolos",
  description: "Kolos Terms of Service - Read our terms and conditions for using the Kolos platform.",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#faf1dc]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 hover:opacity-70 transition-opacity">
              <ArrowLeft className="w-5 h-5 text-[#0a3d3d]" />
              <span className="text-[#0a3d3d] font-medium">Back to Home</span>
            </Link>
            <Link href="/">
              <img
                src="https://storage.mlcdn.com/account_image/1108377/l1IcJ0rEULJH2abWtkQaEOpl3jJqZRVMyJloBUMd.jpg"
                alt="Kolos Logo"
                className="h-10 w-auto"
              />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="bg-white rounded-lg shadow-sm p-6 sm:p-8 md:p-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#0a3d3d] mb-2" style={{ fontFamily: 'var(--font-marcellus), serif' }}>
            Terms of Service
          </h1>
          <p className="text-gray-600 mb-8 text-sm sm:text-base">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <div className="prose prose-lg max-w-none" style={{ fontFamily: 'var(--font-montserrat), sans-serif' }}>
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[#0a3d3d] mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                By accessing or using the Kolos platform ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you may not access the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[#0a3d3d] mb-4">2. Description of Service</h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                Kolos is a B2B signals and networking platform that provides:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
                <li>Personalized business signals and recommendations</li>
                <li>Industry event information and travel plan suggestions</li>
                <li>Networking and connection facilitation services</li>
                <li>Business intelligence and market insights</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[#0a3d3d] mb-4">3. User Accounts</h2>
              <h3 className="text-xl font-semibold text-[#0a3d3d] mb-3 mt-6">3.1 Account Registration</h3>
              <p className="text-gray-700 mb-4 leading-relaxed">
                To use certain features of the Service, you must register for an account. You agree to:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
                <li>Provide accurate, current, and complete information</li>
                <li>Maintain and update your information to keep it accurate</li>
                <li>Maintain the security of your account credentials</li>
                <li>Accept responsibility for all activities under your account</li>
              </ul>

              <h3 className="text-xl font-semibold text-[#0a3d3d] mb-3 mt-6">3.2 Account Security</h3>
              <p className="text-gray-700 mb-4 leading-relaxed">
                You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[#0a3d3d] mb-4">4. Acceptable Use</h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                You agree not to:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
                <li>Use the Service for any illegal purpose or in violation of any laws</li>
                <li>Transmit any harmful code, viruses, or malicious software</li>
                <li>Attempt to gain unauthorized access to the Service or related systems</li>
                <li>Interfere with or disrupt the Service or servers connected to the Service</li>
                <li>Use automated systems to access the Service without permission</li>
                <li>Impersonate any person or entity or misrepresent your affiliation</li>
                <li>Collect or harvest information about other users without their consent</li>
                <li>Use the Service to send spam or unsolicited communications</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[#0a3d3d] mb-4">5. User Content</h2>
              <h3 className="text-xl font-semibold text-[#0a3d3d] mb-3 mt-6">5.1 Content Ownership</h3>
              <p className="text-gray-700 mb-4 leading-relaxed">
                You retain ownership of any content you submit to the Service. By submitting content, you grant us a license to use, modify, and display such content to provide and improve our services.
              </p>

              <h3 className="text-xl font-semibold text-[#0a3d3d] mb-3 mt-6">5.2 Content Responsibility</h3>
              <p className="text-gray-700 mb-4 leading-relaxed">
                You are solely responsible for the content you submit. You represent and warrant that your content does not violate any third-party rights or applicable laws.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[#0a3d3d] mb-4">6. Intellectual Property</h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                The Service and its original content, features, and functionality are owned by Kolos and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[#0a3d3d] mb-4">7. Service Availability</h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                We strive to provide reliable service but do not guarantee that the Service will be available at all times. We reserve the right to modify, suspend, or discontinue the Service at any time without notice.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[#0a3d3d] mb-4">8. Disclaimers</h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DISCLAIM ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[#0a3d3d] mb-4">9. Limitation of Liability</h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, KOLOS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[#0a3d3d] mb-4">10. Indemnification</h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                You agree to indemnify and hold harmless Kolos, its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses arising out of your use of the Service or violation of these Terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[#0a3d3d] mb-4">11. Termination</h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                We may terminate or suspend your account and access to the Service immediately, without prior notice, for any reason, including breach of these Terms. Upon termination, your right to use the Service will cease immediately.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[#0a3d3d] mb-4">12. Governing Law</h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of [Your Jurisdiction], without regard to its conflict of law provisions.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[#0a3d3d] mb-4">13. Changes to Terms</h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                We reserve the right to modify these Terms at any time. We will notify users of any material changes by posting the new Terms on this page and updating the "Last updated" date. Your continued use of the Service after such changes constitutes acceptance of the new Terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[#0a3d3d] mb-4">14. Contact Information</h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                If you have any questions about these Terms of Service, please contact us at:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-700">
                  <strong>Email:</strong> legal@kolos.network<br />
                  <strong>Website:</strong> <a href="https://kolos.network" target="_blank" rel="noopener noreferrer" className="text-[#0a3d3d] hover:underline">kolos.network</a>
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-600">
            <p>© {new Date().getFullYear()} Kolos. All rights reserved.</p>
            <div className="flex gap-4">
              <Link href="/privacy" className="hover:text-[#0a3d3d] transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-[#0a3d3d] transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

