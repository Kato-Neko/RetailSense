import PublicHeader from "@/components/PublicHeader"
import PublicFooter from "@/components/PublicFooter"
import { motion } from "framer-motion"
import { Lock } from "lucide-react"
import { useRef, useEffect, useState } from "react"

const teamMembers = [
  {
    name: "Nick Carter Lacanglacang",
    role: "Full Stack Developer & Team Lead",
    email: "nickcarter.lacanglacang@cit.edu",
    privateEmail: "ng112403@gmail.com",
    phone: "09931672343",
    avatar: "/team/nick.jpg",
    fallback: "https://api.dicebear.com/7.x/avataaars/svg?seed=Nick",
    neonColor: "from-red-600 to-orange-500",
    borderColor: "border-red-600"
  },
  {
    name: "Louie James Carbungco",
    role: "UI/UX Designer & Frontend Developer",
    email: "louiejames.carbungco@cit.edu",
    avatar: "/team/louie.jpg",
    fallback: "https://api.dicebear.com/7.x/avataaars/svg?seed=Louie",
    neonColor: "from-orange-600 to-yellow-500",
    borderColor: "border-orange-600"
  },
  {
    name: "Jierelle Jane Ravanes",
    role: "AI Research & Quality Assurance",
    email: "jierellejane.ravanes@cit.edu",
    avatar: "/team/jierelle.jpg",
    fallback: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jierelle",
    neonColor: "from-yellow-600 to-green-500",
    borderColor: "border-yellow-500"
  },
  {
    name: "Rigel Baltazar",
    role: "Project Leader & Initiator",
    email: "rigel.baltazar@cit.edu",
    avatar: "/team/rigel.jpg",
    fallback: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rigel",
    neonColor: "from-green-600 to-blue-500",
    borderColor: "border-green-600"
  },
  {
    name: "Yoshinori Kyono",
    role: "Backend & Cloud Integration Specialist",
    email: "yoshinori.kyono@cit.edu",
    avatar: "/team/yoshinori.jpg",
    fallback: "https://api.dicebear.com/7.x/avataaars/svg?seed=Yoshinori",
    neonColor: "from-blue-600 to-violet-500",
    borderColor: "border-blue-600"
  }
]

// Helper to animate name letter by letter
function AnimatedName({ name, gradientClass, lit }) {
  return (
    <span className="relative inline-block">
      <motion.span
        initial={{ opacity: 1 }}
        animate={{ opacity: lit ? 0 : 1 }}
        transition={{ duration: 0.5 }}
        className="absolute inset-0 text-foreground"
        style={{ left: 0, top: 0, width: '100%' }}
      >
        {name}
      </motion.span>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: lit ? 1 : 0 }}
        transition={{ duration: 0.5 }}
        className={`relative transition-all duration-500 text-transparent bg-clip-text ${gradientClass}`}
      >
        {name}
      </motion.span>
    </span>
  );
}

const ContactPage = () => {
  const [litStates, setLitStates] = useState(Array(teamMembers.length).fill(false));
  useEffect(() => {
    let timeouts = [];
    function runAnimation() {
      setLitStates(Array(teamMembers.length).fill(false));
      teamMembers.forEach((_, idx) => {
        timeouts.push(setTimeout(() => {
          setLitStates(lit => {
            const arr = [...lit];
            arr[idx] = true;
            return arr;
          });
        }, 400 + idx * 350));
        timeouts.push(setTimeout(() => {
          setLitStates(lit => {
            const arr = [...lit];
            arr[idx] = false;
            return arr;
          });
        }, 400 + idx * 350 + 700)); // 700ms lit duration
      });
    }
    runAnimation();
    const interval = setInterval(runAnimation, 15000);
    return () => {
      timeouts.forEach(clearTimeout);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted to-background dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col">
      <PublicHeader showBackButton />
      {/* Hero Section */}
      <section className="relative py-24 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-background overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-400 dark:bg-blue-600 rounded-full opacity-20 blur-3xl animate-pulse"></div>
          <div className="absolute top-40 -left-20 w-72 h-72 bg-cyan-400 dark:bg-cyan-600 rounded-full opacity-20 blur-3xl animate-pulse"></div>
        </div>
        <div className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-400 leading-tight mb-8 drop-shadow-lg"
          >
            Contact <span className="inline-block">Our Team</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="text-muted-foreground text-xl max-w-2xl mx-auto mb-12"
          >
            Have questions, feedback, or want to collaborate? Reach out to any of our team members below—we'd love to hear from you!
          </motion.p>
        </div>
      </section>
      {/* Team Section */}
      <section className="py-12">
        <div className="w-full px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-400 mb-10"
          >
            Meet the Team
          </motion.h2>
          <div className="flex flex-col md:flex-row gap-10 w-full items-stretch">
            {teamMembers.map((member, idx) => {
              const hasPrivate = member.name === "Nick Carter Lacanglacang";
              const borderGradient = member.neonColor || "from-primary to-cyan-400";
              const lit = litStates[idx];
              return (
                <div key={member.email} className="relative flex-1 h-full flex flex-col">
                  {/* Card content with solid background and no border */}
                  <div className="relative z-10 bg-muted/80 dark:bg-slate-900/60 rounded-2xl flex flex-col items-center text-center group overflow-hidden h-[400px] w-full p-8" style={{ minHeight: '400px', maxWidth: '100%' }}>
                    <div className={`mb-4 flex justify-center`}>
                      <div className={`w-20 h-20 rounded-full border-4 border-gradient-to-br ${borderGradient} p-1 relative group-hover:scale-105 transition-transform duration-300 bg-background`}>
                        <img
                          src={member.avatar}
                          alt={member.name}
                          className="w-full h-full rounded-full object-cover"
                          onError={e => { e.target.onerror = null; e.target.src = member.fallback; }}
                        />
                      </div>
                    </div>
                    {/* Name section */}
                    <div className="flex items-center justify-center w-full h-12 min-h-[48px]">
                      <h3 className="text-2xl font-bold mb-0 w-full flex items-center justify-center">
                        <AnimatedName name={member.name} gradientClass={`bg-gradient-to-r ${borderGradient}`} lit={lit} />
                      </h3>
                    </div>
                    {/* Title section */}
                    <div className="flex items-center justify-center w-full h-12 min-h-[48px] mt-5">
                      <p className="text-lg font-bold text-foreground mb-0 w-full flex items-center justify-center">
                        {member.role}
                      </p>
                    </div>
                    {/* Contact section */}
                    <div className="flex flex-col items-center justify-center w-full h-20 min-h-[64px] mt-auto">
                      <a
                        href={`mailto:${member.email}`}
                        className="text-primary hover:underline break-all text-base"
                      >
                        {member.email}
                      </a>
                      {hasPrivate && (
                        <>
                          <a
                            href={`mailto:${member.privateEmail}`}
                            className="text-primary hover:underline break-all text-base mb-1"
                          >
                            {member.privateEmail}
                          </a>
                          <div className="text-muted-foreground text-base">{member.phone}</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <PublicFooter />
    </div>
  )
}

export default ContactPage 