import PublicHeader from "@/components/PublicHeader"
import PublicFooter from "@/components/PublicFooter"

const sections = [
  { id: "what", label: "What Are Cookies?" },
  { id: "how", label: "How We Use Cookies" },
  { id: "types", label: "Types of Cookies We Use" },
  { id: "manage", label: "Managing Cookies" },
  { id: "changes", label: "Changes to This Policy" },
  { id: "contact", label: "Contact Us" },
]

const CookiePolicy = () => (
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
            <h1 className="text-4xl font-extrabold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-400">Cookie Policy</h1>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <span className="text-muted-foreground text-base">Effective Date: May 25, 2025</span>
              <span className="text-xs text-muted-foreground">Last updated: May 25, 2025</span>
            </div>
            <p className="text-lg text-foreground/90 mb-2">This Cookie Policy explains how RetailSense uses cookies and similar technologies to recognize you when you visit our platform. It explains what these technologies are and why we use them.</p>
          </div>
          <hr className="border-border/30" />
          <section id="what">
            <h2 className="text-2xl font-bold mb-2 text-primary">1. What Are Cookies?</h2>
            <p className="text-base">Cookies are small data files placed on your device when you visit a website. They are widely used to make websites work, or work more efficiently, as well as to provide reporting information.</p>
          </section>
          <hr className="border-border/30" />
          <section id="how">
            <h2 className="text-2xl font-bold mb-2 text-primary">2. How We Use Cookies</h2>
            <p className="text-base">We use cookies to enhance your experience, analyze usage, and improve our services. Some cookies are essential for the operation of our platform.</p>
          </section>
          <hr className="border-border/30" />
          <section id="types">
            <h2 className="text-2xl font-bold mb-2 text-primary">3. Types of Cookies We Use</h2>
            <ul className="list-disc ml-6 space-y-2 text-base">
              <li><strong>Essential Cookies:</strong> Necessary for the platform to function properly.</li>
              <li><strong>Analytics Cookies:</strong> Help us understand how users interact with RetailSense.</li>
              <li><strong>Preference Cookies:</strong> Remember your preferences and settings.</li>
            </ul>
          </section>
          <hr className="border-border/30" />
          <section id="manage">
            <h2 className="text-2xl font-bold mb-2 text-primary">4. Managing Cookies</h2>
            <p className="text-base">You can control and manage cookies through your browser settings. Please note that disabling cookies may affect your experience on RetailSense.</p>
          </section>
          <hr className="border-border/30" />
          <section id="changes">
            <h2 className="text-2xl font-bold mb-2 text-primary">5. Changes to This Policy</h2>
            <p className="text-base">We may update this Cookie Policy from time to time. We will notify you of significant changes via email or through the platform.</p>
          </section>
          <hr className="border-border/30" />
          <section id="contact">
            <h2 className="text-2xl font-bold mb-2 text-primary">6. Contact Us</h2>
            <p className="text-base">For questions or concerns about this Cookie Policy, please visit our <a href="/contact" className="text-cyan-500 underline font-semibold">Contact</a> page. All our team's contact information is listed there.</p>
          </section>
        </div>
      </div>
    </section>
    <PublicFooter />
  </div>
)

export default CookiePolicy 