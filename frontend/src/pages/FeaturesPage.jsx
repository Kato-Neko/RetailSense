import { BarChart2, Map, Users, FileText, ShieldCheck, LayoutDashboard, SunMoon, UserCheck, Layers3 } from "lucide-react"
import PublicHeader from "@/components/PublicHeader"
import PublicFooter from "@/components/PublicFooter"
import { motion } from "framer-motion"

const features = [
  {
    icon: <Map className="h-8 w-8 text-blue-700 dark:text-cyan-300" />, 
    title: "AI-Powered Foot Traffic Analysis",
    description: "Detect and track customer movement using YOLO/DeepSORT, generating heatmaps to visualize high-traffic areas and optimize store layouts."
  },
  {
    icon: <BarChart2 className="h-8 w-8 text-blue-700 dark:text-cyan-300" />,
    title: "Retail Analytics Dashboard",
    description: "Interactive dashboard with charts, KPIs, and real-time/historical data for actionable insights."
  },
  {
    icon: <FileText className="h-8 w-8 text-blue-700 dark:text-cyan-300" />,
    title: "Downloadable Reports",
    description: "Export analytics and heatmaps as CSV, PDF, or image for easy sharing and documentation."
  },
  {
    icon: <LayoutDashboard className="h-8 w-8 text-blue-700 dark:text-cyan-300" />,
    title: "Interactive Literature Review (RRL)",
    description: "Explore categorized, expandable research summaries and download the full RRL document."
  },
  {
    icon: <Users className="h-8 w-8 text-blue-700 dark:text-cyan-300" />,
    title: "Team & About Page",
    description: "Meet the developers, view bios, and learn about the project's mission and institutional background."
  },
  {
    icon: <SunMoon className="h-8 w-8 text-blue-700 dark:text-cyan-300" />,
    title: "Modern, Responsive UI",
    description: "Beautiful, mobile-friendly design with theme toggle and smooth animations for a great user experience."
  },
  {
    icon: <UserCheck className="h-8 w-8 text-blue-700 dark:text-cyan-300" />,
    title: "User Authentication & Management",
    description: "Secure login, registration, and user management for personalized access and admin features."
  },
  {
    icon: <Layers3 className="h-8 w-8 text-blue-700 dark:text-cyan-300" />,
    title: "Modular, Maintainable Codebase",
    description: "Well-organized, scalable architecture for easy updates and future enhancements."
  },
  {
    icon: <ShieldCheck className="h-8 w-8 text-blue-700 dark:text-cyan-300" />,
    title: "Data Privacy & Security",
    description: "Robust security practices to protect user data and ensure compliance with privacy standards."
  }
]

const FeaturesPage = () => (
  <div className="min-h-screen bg-gradient-to-b from-background via-muted to-background dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col">
    <PublicHeader showBackButton />
    {/* Hero Section */}
    <section className="relative py-20 overflow-hidden">
      <div className="absolute inset-0 bg-background overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400 dark:bg-blue-600 rounded-full opacity-20 blur-3xl"></div>
        <div className="absolute top-40 -left-20 w-60 h-60 bg-cyan-400 dark:bg-cyan-600 rounded-full opacity-20 blur-3xl"></div>
      </div>
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-400 leading-tight mb-6"
        >
          Explore RetailSense Features
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="text-muted-foreground text-lg max-w-2xl mx-auto"
        >
          Discover the powerful tools and technologies that make RetailSense the ultimate platform for retail analytics and optimization.
        </motion.p>
      </div>
    </section>
    {/* Features Grid */}
    <section className="py-20 flex-1">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {features.map((feature, idx) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: idx * 0.08 }}
              viewport={{ once: true }}
            >
              <div className="bg-muted/80 dark:bg-slate-900/60 rounded-2xl p-8 border border-border shadow-xl hover:shadow-2xl transition-all duration-300 group h-full flex flex-col items-center text-center">
                <div className="rounded-full bg-gradient-to-br from-blue-200 to-cyan-300 dark:from-primary/50 dark:to-cyan-400/50 shadow-md w-16 h-16 flex items-center justify-center mb-6 group-hover:from-blue-300 group-hover:to-cyan-400 dark:group-hover:from-primary/40 dark:group-hover:to-cyan-400/40 transition-all duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-base">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
    <PublicFooter />
  </div>
)

export default FeaturesPage 