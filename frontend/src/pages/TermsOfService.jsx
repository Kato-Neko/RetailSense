import PublicHeader from "@/components/PublicHeader"
import PublicFooter from "@/components/PublicFooter"

const sections = [
  { id: "acceptance", label: "Acceptance of Terms" },
  { id: "use", label: "Use of Service" },
  { id: "user", label: "User Responsibilities" },
  { id: "intellectual", label: "Intellectual Property" },
  { id: "termination", label: "Termination" },
  { id: "disclaimer", label: "Disclaimer & Limitation of Liability" },
  { id: "changes", label: "Changes to Terms" },
  { id: "contact", label: "Contact Us" },
]

const TermsOfService = () => (
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
            <h1 className="text-4xl font-extrabold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-400">Terms of Service</h1>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <span className="text-muted-foreground text-base">Effective Date: May 25, 2025</span>
              <span className="text-xs text-muted-foreground">Last updated: May 25, 2025</span>
            </div>
            <p className="text-lg text-foreground/90 mb-2">By using RetailSense, you agree to these Terms of Service. Please read them carefully. If you do not agree, do not use our platform.</p>
          </div>
          <hr className="border-border/30" />
          <section id="acceptance">
            <h2 className="text-2xl font-bold mb-2 text-primary">1. Acceptance of Terms</h2>
            <p className="text-base">By accessing or using RetailSense, you agree to be bound by these Terms of Service and our Privacy Policy.</p>
          </section>
          <hr className="border-border/30" />
          <section id="use">
            <h2 className="text-2xl font-bold mb-2 text-primary">2. Use of Service</h2>
            <p className="text-base">You may use RetailSense only for lawful purposes and in accordance with these Terms. You agree not to misuse the platform or attempt to access it in unauthorized ways.</p>
          </section>
          <hr className="border-border/30" />
          <section id="user">
            <h2 className="text-2xl font-bold mb-2 text-primary">3. User Responsibilities</h2>
            <ul className="list-disc ml-6 space-y-2 text-base">
              <li>You are responsible for maintaining the confidentiality of your account and password.</li>
              <li>You agree to provide accurate and complete information.</li>
              <li>You are responsible for all activities that occur under your account.</li>
            </ul>
          </section>
          <hr className="border-border/30" />
          <section id="intellectual">
            <h2 className="text-2xl font-bold mb-2 text-primary">4. Intellectual Property</h2>
            <p className="text-base">All content, trademarks, and data on RetailSense are the property of their respective owners. You may not copy, modify, or distribute any part of the platform without permission.</p>
          </section>
          <hr className="border-border/30" />
          <section id="termination">
            <h2 className="text-2xl font-bold mb-2 text-primary">5. Termination</h2>
            <p className="text-base">We may suspend or terminate your access to RetailSense at any time, for any reason, without notice.</p>
          </section>
          <hr className="border-border/30" />
          <section id="disclaimer">
            <h2 className="text-2xl font-bold mb-2 text-primary">6. Disclaimer & Limitation of Liability</h2>
            <p className="text-base">RetailSense is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the platform.</p>
          </section>
          <hr className="border-border/30" />
          <section id="changes">
            <h2 className="text-2xl font-bold mb-2 text-primary">7. Changes to Terms</h2>
            <p className="text-base">We may update these Terms of Service from time to time. We will notify you of significant changes via email or through the platform.</p>
          </section>
          <hr className="border-border/30" />
          <section id="contact">
            <h2 className="text-2xl font-bold mb-2 text-primary">8. Contact Us</h2>
            <p className="text-base">For questions or concerns about these Terms of Service, please visit our <a href="/contact" className="text-cyan-500 underline font-semibold">Contact</a> page. All our team's contact information is listed there.</p>
          </section>
        </div>
      </div>
    </section>
    <PublicFooter />
  </div>
)

export default TermsOfService 