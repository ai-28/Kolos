import { KolosLogo } from "@/app/components/svg"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export const metadata = {
  title: "Privacy Policy - Kolos",
  description: "Kolos Privacy Policy - Learn how we collect, use, and protect your personal information.",
}

export default function PrivacyPage() {
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
            Privacy Policy
          </h1>
          <p className="text-gray-600 mb-8 text-sm sm:text-base">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <div className="prose prose-lg max-w-none" style={{ fontFamily: 'var(--font-montserrat), sans-serif' }}>
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[#0a3d3d] mb-4">1. Introduction</h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                Welcome to Kolos ("we," "our," or "us"). We are committed to protecting your privacy and ensuring you have a positive experience on our platform. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our B2B signals and networking platform.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[#0a3d3d] mb-4">2. Information We Collect</h2>
              <h3 className="text-xl font-semibold text-[#0a3d3d] mb-3 mt-6">2.1 Information You Provide</h3>
              <p className="text-gray-700 mb-4 leading-relaxed">
                We collect information that you provide directly to us, including:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
                <li>Name, email address, and contact information</li>
                <li>Company information and business profile details</li>
                <li>Professional goals, industry focus, and partner preferences</li>
                <li>Travel plans and preferences</li>
                <li>Communication preferences and feedback</li>
              </ul>

              <h3 className="text-xl font-semibold text-[#0a3d3d] mb-3 mt-6">2.2 Automatically Collected Information</h3>
              <p className="text-gray-700 mb-4 leading-relaxed">
                When you use our platform, we automatically collect certain information, including:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
                <li>Usage data and interaction patterns</li>
                <li>Device information and browser type</li>
                <li>IP address and location data</li>
                <li>Cookies and similar tracking technologies</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[#0a3d3d] mb-4">3. How We Use Your Information</h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                We use the information we collect to:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
                <li>Provide, maintain, and improve our services</li>
                <li>Generate personalized business signals and recommendations</li>
                <li>Facilitate networking and connection opportunities</li>
                <li>Send you relevant industry events and travel plan information</li>
                <li>Communicate with you about your account and our services</li>
                <li>Detect, prevent, and address technical issues and security threats</li>
                <li>Comply with legal obligations and enforce our terms</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[#0a3d3d] mb-4">4. Information Sharing and Disclosure</h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                We do not sell your personal information. We may share your information in the following circumstances:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
                <li><strong>Service Providers:</strong> With third-party service providers who perform services on our behalf</li>
                <li><strong>Business Transfers:</strong> In connection with any merger, sale, or acquisition</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights and safety</li>
                <li><strong>With Your Consent:</strong> When you explicitly authorize us to share your information</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[#0a3d3d] mb-4">5. Data Security</h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet or electronic storage is 100% secure.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[#0a3d3d] mb-4">6. Your Rights and Choices</h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                Depending on your location, you may have certain rights regarding your personal information, including:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
                <li>The right to access and receive a copy of your personal information</li>
                <li>The right to rectify inaccurate or incomplete information</li>
                <li>The right to request deletion of your personal information</li>
                <li>The right to object to or restrict processing of your information</li>
                <li>The right to data portability</li>
                <li>The right to withdraw consent where processing is based on consent</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[#0a3d3d] mb-4">7. Cookies and Tracking Technologies</h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                We use cookies and similar tracking technologies to track activity on our platform and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[#0a3d3d] mb-4">8. Third-Party Services</h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                Our platform may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to read their privacy policies.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[#0a3d3d] mb-4">9. Children's Privacy</h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                Our services are not intended for individuals under the age of 18. We do not knowingly collect personal information from children.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[#0a3d3d] mb-4">10. Changes to This Privacy Policy</h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[#0a3d3d] mb-4">11. Contact Us</h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                If you have any questions about this Privacy Policy or our privacy practices, please contact us at:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-700">
                  <strong>Email:</strong> privacy@kolos.network<br />
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

