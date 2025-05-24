import PublicHeader from "@/components/PublicHeader"
import PublicFooter from "@/components/PublicFooter"

const sections = [
  { id: "overview", label: "What is the DPA?" },
  { id: "principles", label: "Key Principles" },
  { id: "rights", label: "Your Rights under the DPA" },
  { id: "compliance", label: "Our Commitment" },
  { id: "contact", label: "Contact Us" },
]

const DPA = () => (
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
            <h1 className="text-4xl font-extrabold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-400">Philippine Data Privacy Act (DPA)</h1>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <span className="text-muted-foreground text-base">Effective Date: May 25, 2025</span>
              <span className="text-xs text-muted-foreground">Last updated: May 25, 2025</span>
            </div>
            <p className="text-lg text-foreground/90 mb-2">The Philippine Data Privacy Act of 2012 (DPA, RA 10173) is the country's main law for protecting personal data. It is the Philippine equivalent of the GDPR. This page explains your rights and our responsibilities under the DPA.</p>
          </div>
          <hr className="border-border/30" />
          <section id="overview">
            <h2 className="text-2xl font-bold mb-2 text-primary">1. What is the DPA?</h2>
            <p className="text-base">The DPA (Republic Act No. 10173) is a law that protects the privacy of individuals and regulates the collection, use, and storage of personal data in the Philippines.</p>
          </section>
          <hr className="border-border/30" />
          <section id="principles">
            <h2 className="text-2xl font-bold mb-2 text-primary">2. Key Principles</h2>
            <ul className="list-disc ml-6 space-y-2 text-base">
              <li><strong>Transparency:</strong> You have the right to know how your data is collected and used.</li>
              <li><strong>Legitimate Purpose:</strong> Data is collected for specified, legitimate purposes only.</li>
              <li><strong>Proportionality:</strong> Only data necessary for the stated purpose is collected and processed.</li>
            </ul>
          </section>
          <hr className="border-border/30" />
          <section id="rights">
            <h2 className="text-2xl font-bold mb-2 text-primary">3. Your Rights under the DPA</h2>
            <ul className="list-disc ml-6 space-y-2 text-base">
              <li>Right to be informed</li>
              <li>Right to object</li>
              <li>Right to access</li>
              <li>Right to correct</li>
              <li>Right to erasure or blocking</li>
              <li>Right to damages</li>
              <li>Right to data portability</li>
            </ul>
          </section>
          <hr className="border-border/30" />
          <section id="compliance">
            <h2 className="text-2xl font-bold mb-2 text-primary">4. Our Commitment</h2>
            <p className="text-base">RetailSense is committed to full compliance with the DPA. We implement security measures and privacy practices to protect your data and respect your rights.</p>
          </section>
          <hr className="border-border/30" />
          <section id="contact">
            <h2 className="text-2xl font-bold mb-2 text-primary">5. Contact Us</h2>
            <p className="text-base">For questions or concerns about the DPA or your data rights, please visit our <a href="/contact" className="text-cyan-500 underline font-semibold">Contact</a> page. All our team's contact information is listed there.</p>
          </section>
        </div>
      </div>
    </section>
    <PublicFooter />
  </div>
)

export default DPA 