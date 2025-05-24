import { useNavigate } from "react-router-dom"
import { useState } from "react"

const featuresList = [
  "AI-powered foot traffic & customer behavior analysis (YOLO/DeepSORT)",
  "Heatmap generation and visualization",
  "Retail analytics dashboard with charts and KPIs",
  "Downloadable reports (CSV, PDF, image)",
  "Interactive, categorized literature review (RRL)",
  "Team & About page with carousel and bios",
  "Modern, responsive UI with theme toggle",
  "User authentication and management",
  "Modular, maintainable codebase"
]

function FeaturesDropdown() {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        className="text-left w-full hover:underline focus:outline-none"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Features
        <span className="ml-1">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <ul className="absolute left-0 mt-2 w-72 bg-background border border-border rounded-lg shadow-lg z-10 p-4 space-y-2 text-sm">
          {featuresList.map((feature, i) => (
            <li key={i} className="text-muted-foreground list-disc ml-4">{feature}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

const PublicFooter = () => {
  const navigate = useNavigate()

  return (
    <footer className="border-t border-border bg-background py-12">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-8 w-8 bg-transparent rounded-full p-1">
                <img src="/rs_logo.svg" alt="RetailSense Logo" className="h-5 w-5 object-contain" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-primary to-cyan-400 text-transparent bg-clip-text">
                RetailSense
              </span>
            </div>
            <p className="text-muted-foreground text-sm">
              Advanced AI-powered retail analytics to optimize your store layout and increase sales.
            </p>
          </div>
          <div>
            <h4 className="text-foreground font-medium mb-4">Product</h4>
            <ul className="space-y-2">
              {[
                { name: "Features", onClick: () => navigate("/features") },
                { name: "Case Studies", onClick: () => navigate("/rrl") },
                { name: "Documentation", href: "https://cebuinstituteoftechnology-my.sharepoint.com/:f:/g/personal/nickcarter_lacanglacang_cit_edu/EkQBmBteBshCkoAE9jJ_lpgBrs2_zckNecwQ8jZPhyUeFA?e=VCopOg", external: true }
              ].map((item, index) => (
                <li key={index}>
                  {item.onClick ? (
                    <button
                      onClick={item.onClick}
                      className="text-muted-foreground hover:text-foreground text-sm"
                    >
                      {item.name}
                    </button>
                  ) : (
                    <a 
                      href={item.href} 
                      className="text-muted-foreground hover:text-foreground text-sm"
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noopener noreferrer" : undefined}
                    >
                      {item.name}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-foreground font-medium mb-4">Company</h4>
            <ul className="space-y-2">
              {[
                { name: "About", onClick: () => navigate("/about") },
                { name: "Contact", onClick: () => navigate("/contact") }
              ].map((item, index) => (
                <li key={index}>
                  <button
                    onClick={item.onClick}
                    className="text-muted-foreground hover:text-foreground text-sm"
                  >
                    {item.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-foreground font-medium mb-4">Legal</h4>
            <ul className="space-y-2">
              <li>
                <a href="/privacy-policy" className="text-muted-foreground hover:text-foreground text-sm">Privacy Policy</a>
              </li>
              <li>
                <a href="/terms" className="text-muted-foreground hover:text-foreground text-sm">Terms of Service</a>
              </li>
              <li>
                <a href="/cookie-policy" className="text-muted-foreground hover:text-foreground text-sm">Cookie Policy</a>
              </li>
              <li>
                <a href="/dpa" className="text-muted-foreground hover:text-foreground text-sm">DPA</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <div className="text-sm text-muted-foreground">© 2025 RetailSense. All rights reserved.</div>
          <div className="flex gap-4 mt-4 md:mt-0">
            <a 
              href="https://github.com/Kato-Neko/RetailSense.git" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default PublicFooter 