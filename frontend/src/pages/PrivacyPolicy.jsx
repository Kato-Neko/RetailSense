import PublicHeader from "@/components/PublicHeader"
import PublicFooter from "@/components/PublicFooter"

const sections = [
  { id: "info", label: "Information We Collect" },
  { id: "use", label: "How We Use Your Information" },
  { id: "sharing", label: "Data Sharing & Disclosure" },
  { id: "security", label: "Data Security" },
  { id: "rights", label: "Your Rights" },
  { id: "retention", label: "Data Retention" },
  { id: "changes", label: "Changes to This Policy" },
  { id: "contact", label: "Contact Us" },
]

const PrivacyPolicy = () => (
  <div className="min-h-screen bg-gradient-to-b from-background via-muted to-background dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col">
    <PublicHeader />
    <section className="flex-1 flex items-center justify-center py-20 px-2">
      <div className="bg-background/90 dark:bg-slate-900/80 rounded-3xl shadow-2xl max-w-5xl w-full flex flex-col md:flex-row overflow-hidden border border-border/40">
        {/* Sidebar for quick links (desktop only) */}
        <nav className="hidden md:flex flex-col gap-2 min-w-[220px] bg-muted/30 dark:bg-slate-800/30 border-r border-border/30 py-10 px-6">
          <h2 className="text-lg font-semibold mb-4 text-foreground/80">On this page</h2>
          {sections.map(s => (
            <a key={s.id} href={`#${s.id}`} className="text-muted-foreground hover:text-primary transition-colors py-1 px-2 rounded-md text-sm font-medium">
              {s.label}
            </a>
          ))}
        </nav>
        {/* Main content */}
        <div className="flex-1 p-6 sm:p-10 flex flex-col gap-8">
          <div className="mb-2">
            <h1 className="text-4xl font-extrabold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-400">Privacy Policy</h1>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <span className="text-muted-foreground text-base">Effective Date: May 25, 2025</span>
              <span className="text-xs text-muted-foreground">Last updated: May 25, 2025</span>
            </div>
            <p className="text-lg text-foreground/90 mb-2">Welcome to RetailSense! We value your privacy and are committed to protecting your personal data in accordance with the Philippine Data Privacy Act (RA 10173). This policy explains how we handle your information when you use our platform.</p>
          </div>
          <hr className="border-border/30" />
          <section id="info">
            <h2 className="text-2xl font-bold mb-2 text-primary">1. Information We Collect</h2>
            <ul className="list-disc ml-6 space-y-2 text-base">
              <li><strong>Account Information:</strong> Name, email address, and other details you provide when you register or contact us.</li>
              <li><strong>Usage Data:</strong> Analytics about how you use RetailSense, such as pages visited, features used, and device/browser information.</li>
              <li><strong>Customer Data:</strong> Data you upload or process through our platform (e.g., video files, analytics results).</li>
              <li><strong>Cookies & Tracking:</strong> We use cookies and similar technologies to improve your experience and analyze usage.</li>
            </ul>
          </section>
          <hr className="border-border/30" />
          <section id="use">
            <h2 className="text-2xl font-bold mb-2 text-primary">2. How We Use Your Information</h2>
            <ul className="list-disc ml-6 space-y-2 text-base">
              <li>To provide, maintain, and improve RetailSense and its features.</li>
              <li>To communicate with you about your account, updates, or support requests.</li>
              <li>To analyze usage and improve our services.</li>
              <li>To comply with legal obligations under the DPA and other laws.</li>
            </ul>
          </section>
          <hr className="border-border/30" />
          <section id="sharing">
            <h2 className="text-2xl font-bold mb-2 text-primary">3. Data Sharing & Disclosure</h2>
            <ul className="list-disc ml-6 space-y-2 text-base">
              <li>We do <strong>not</strong> sell your personal data.</li>
              <li>We may share data with trusted service providers who help us operate RetailSense (e.g., cloud hosting, analytics), under strict confidentiality agreements.</li>
              <li>We may disclose information if required by law or to protect our rights and users.</li>
            </ul>
          </section>
          <hr className="border-border/30" />
          <section id="security">
            <h2 className="text-2xl font-bold mb-2 text-primary">4. Data Security</h2>
            <p className="text-base">We implement industry-standard security measures to protect your data from unauthorized access, alteration, or loss. However, no system is 100% secure—please use strong passwords and protect your account.</p>
          </section>
          <hr className="border-border/30" />
          <section id="rights">
            <h2 className="text-2xl font-bold mb-2 text-primary">5. Your Rights</h2>
            <ul className="list-disc ml-6 space-y-2 text-base">
              <li>You have the right to access, correct, or delete your personal data.</li>
              <li>You may withdraw consent or object to processing at any time, subject to legal and contractual restrictions.</li>
              <li>To exercise your rights, please visit our <a href="/contact" className="text-cyan-500 underline font-semibold">Contact</a> page to reach our team.</li>
            </ul>
          </section>
          <hr className="border-border/30" />
          <section id="retention">
            <h2 className="text-2xl font-bold mb-2 text-primary">6. Data Retention</h2>
            <p className="text-base">We retain your data only as long as necessary for the purposes stated above, or as required by law.</p>
          </section>
          <hr className="border-border/30" />
          <section id="changes">
            <h2 className="text-2xl font-bold mb-2 text-primary">7. Changes to This Policy</h2>
            <p className="text-base">We may update this Privacy Policy from time to time. We will notify you of significant changes via email or through the platform.</p>
          </section>
          <hr className="border-border/30" />
          <section id="contact">
            <h2 className="text-2xl font-bold mb-2 text-primary">8. Contact Us</h2>
            <p className="text-base">For questions or concerns about this Privacy Policy or our data practices, please visit our <a href="/contact" className="text-cyan-500 underline font-semibold">Contact</a> page. All our team's contact information is listed there.</p>
          </section>
        </div>
      </div>
    </section>
    <PublicFooter />
  </div>
)

export default PrivacyPolicy 