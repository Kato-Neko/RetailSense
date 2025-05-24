"use client"

import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel"
import { useEffect, useState } from "react"
import PublicHeader from "@/components/PublicHeader"
import { motion } from "framer-motion"
import { Rocket, Lightbulb, Sparkles } from "lucide-react"
import PublicFooter from "@/components/PublicFooter"

const AboutPage = () => {
  const navigate = useNavigate()
  const [api, setApi] = useState()

  const teamMembers = [
    {
      name: "Nick Carter Lacanglacang",
      role: "Full Stack Developer & Team Lead",
      bio: "Lead developer and architect behind RetailSense, specializing in full-stack development and system architecture. Drives the technical vision and implementation of our retail analytics platform, ensuring robust and scalable solutions.",
      email: "nickcarter.lacanglacang@cit.edu",
      image: "/team/nick.jpg",
      fallbackImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Nick",
      neonColor: "from-red-600 to-orange-500"
    },
    {
      name: "Louie James Carbungco",
      role: "UI/UX Designer & Frontend Developer",
      bio: "Creative designer behind RetailSense's visual identity, responsible for the app's logo, color schemes, and overall user experience design. Specializes in creating intuitive and visually appealing interfaces.",
      email: "louiejames.carbungco@cit.edu",
      image: "/team/louie.jpg",
      fallbackImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Louie",
      neonColor: "from-orange-600 to-yellow-500"
    },
    {
      name: "Jierelle Jane Ravanes",
      role: "AI Research & Quality Assurance",
      bio: "Key contributor to RetailSense's AI implementation, specializing in computer vision research and testing. Led the research and integration of YOLO and DeepSORT algorithms, while conducting extensive research to validate our approach. Plays a crucial role in quality assurance and bug fixing.",
      email: "jierellejane.ravanes@cit.edu",
      image: "/team/jierelle.jpg",
      fallbackImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jierelle",
      neonColor: "from-yellow-600 to-green-500"
    },
    {
      name: "Rigel Baltazar",
      role: "Project Leader & Initiator",
      bio: "Pioneered the RetailSense project, laying the foundational groundwork and initial architecture. His vision and early development efforts set the stage for what would become a comprehensive retail analytics platform.",
      email: "rigel.baltazar@cit.edu",
      image: "/team/rigel.jpg",
      fallbackImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rigel",
      neonColor: "from-green-600 to-blue-500"
    },
    {
      name: "Yoshinori Kyono Jr.",
      role: "Backend & Cloud Integration Specialist",
      bio: "Specialized in backend development and cloud infrastructure, with expertise in database management and API integration. Contributed to the planning and architecture of RetailSense's backend systems and cloud infrastructure.",
      email: "yoshinori.kyonojr@cit.edu",
      image: "/team/yoshinori.jpg",
      fallbackImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Yoshinori",
      neonColor: "from-blue-600 to-violet-500"
    }
  ]

  useEffect(() => {
    if (!api) return
    const interval = setInterval(() => {
      api.scrollNext()
    }, 15000)
    return () => clearInterval(interval)
  }, [api])

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted to-background dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <PublicHeader showBackButton onBackClick={() => navigate(-1)} />

      {/* Hero Section with Dynamic Background */}
      <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-cyan-400/20 to-primary/20 blur-3xl -z-10 animate-gradient" />
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h1 className="text-6xl sm:text-7xl font-bold text-foreground mb-8">
              About <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-400">RetailSense</span>
            </h1>
            <p className="text-muted-foreground text-xl max-w-3xl mx-auto leading-relaxed">
              RetailSense is a cutting-edge retail analytics platform developed by a team of passionate developers
              dedicated to transforming how retailers understand and optimize their physical spaces.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Mission & Values Section */}
      <section className="py-20">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Mission Card */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="bg-muted/50 dark:bg-slate-900/50 rounded-3xl p-12 backdrop-blur-sm border border-border/50 shadow-xl"
            >
              <h2 className="text-3xl font-bold text-foreground mb-6">Our Mission</h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                We're on a mission to revolutionize retail analytics by combining advanced AI technology with
                intuitive user interfaces. Our goal is to help retailers make data-driven decisions that
                enhance customer experience and drive business growth.
              </p>
            </motion.div>

            {/* Values Cards */}
            <div className="space-y-6">
              {[
                {
                  title: "Innovation",
                  description: "Constantly pushing boundaries to deliver cutting-edge solutions.",
                  icon: <Rocket className="w-8 h-8 text-blue-500" strokeWidth={2.5} />
                },
                {
                  title: "User-Centric",
                  description: "Putting our users' needs at the heart of everything we build.",
                  icon: <Lightbulb className="w-8 h-8 text-purple-500" strokeWidth={2.5} />
                },
                {
                  title: "Excellence",
                  description: "Committed to delivering the highest quality in every aspect of our work.",
                  icon: <Sparkles className="w-8 h-8 text-green-500" strokeWidth={2.5} />
                }
              ].map((value, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.2 }}
                  viewport={{ once: true }}
                  className="bg-muted/50 dark:bg-slate-900/50 rounded-2xl p-8 backdrop-blur-sm border border-border/50 shadow-xl hover:shadow-2xl transition-all duration-300"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">{value.icon}</div>
                    <div>
                      <h3 className="text-xl font-semibold text-foreground mb-2">{value.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">{value.description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Institution Section */}
      <section className="py-20">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="bg-muted/50 dark:bg-slate-900/50 rounded-3xl p-12 backdrop-blur-sm border border-border/50 shadow-xl"
          >
            <h2 className="text-3xl font-bold text-foreground mb-8">Our Institution</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div>
                <h3 className="text-2xl font-semibold text-foreground mb-6">Cebu Institute of Technology - University</h3>
                <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                  Founded in 1946, CIT-U is one of the oldest and most prestigious technical institutions in Cebu City, Philippines. 
                  Known for its excellence in engineering, technology, and computer science education, the university has been 
                  producing industry-ready professionals for over 75 years.
                </p>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Our team is proud to be part of CIT-U's legacy of innovation and technical excellence. The university's 
                  strong emphasis on practical learning and industry collaboration has been instrumental in shaping our 
                  approach to developing RetailSense.
                </p>
              </div>
              <div className="space-y-6">
                {[
                  {
                    title: "Technical Excellence",
                    description: "CIT-U is renowned for its rigorous technical curriculum and state-of-the-art facilities, providing students with hands-on experience in cutting-edge technologies."
                  },
                  {
                    title: "Industry Connections",
                    description: "The university maintains strong ties with industry partners, ensuring that students are exposed to real-world challenges and current industry practices."
                  },
                  {
                    title: "Innovation Hub",
                    description: "CIT-U fosters a culture of innovation and entrepreneurship, encouraging students to develop solutions that address real-world problems."
                  }
                ].map((feature, index) => (
                  <motion.div 
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.2 }}
                    viewport={{ once: true }}
                    className="bg-background/50 rounded-xl p-6 hover:shadow-lg transition-shadow duration-300"
                  >
                    <h4 className="text-xl font-semibold text-foreground mb-3">{feature.title}</h4>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-400 mb-12 text-center">
              Meet Our Team
            </h2>
            <div className="px-4 sm:px-12">
              <Carousel
                opts={{
                  align: "center",
                  loop: true,
                }}
                setApi={setApi}
                className="w-full"
              >
                <CarouselContent>
                  {teamMembers.map((member, index) => (
                    <CarouselItem key={index} className="basis-full">
                      <Card className={`backdrop-blur-sm transition-all duration-300 h-[600px] overflow-hidden group relative bg-transparent border-none`}>
                        <div className={`absolute inset-0 bg-gradient-to-br ${member.neonColor} opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur-xl`}></div>
                        <div className={`absolute inset-0 bg-gradient-to-br ${member.neonColor} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                        <div className={`absolute inset-0 bg-gradient-to-br ${member.neonColor} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>
                        <CardContent className="p-12 relative flex flex-col h-full items-center justify-center bg-transparent">
                          <div className="flex flex-col items-center text-center max-w-3xl mx-auto flex-1 w-full justify-center">
                            <div className="mb-8">
                              <div className={`w-40 h-40 rounded-full border-4 border-gradient-to-br ${member.neonColor} p-1 relative group-hover:scale-105 transition-transform duration-300`}>
                                <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${member.neonColor} opacity-20 blur-xl -z-10`} />
                                <img
                                  src={member.image}
                                  alt={member.name}
                                  className="w-full h-full rounded-full object-cover"
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = member.fallbackImage;
                                  }}
                                />
                              </div>
                            </div>
                            <div className="space-y-4 flex-1 w-full flex flex-col justify-start items-center">
                              <h3 className={`text-4xl font-bold bg-gradient-to-r ${member.neonColor} text-transparent bg-clip-text`}>
                                {member.name}
                              </h3>
                              <p className="text-foreground font-medium text-2xl">
                                {member.role}
                              </p>
                              <div className="space-y-2">
                                <p className="text-foreground/80 text-sm">
                                  Cebu Institute of Technology - University
                                </p>
                                <p className="text-foreground/80 text-sm">
                                  {member.email}
                                </p>
                              </div>
                              <div className="w-24 h-1 bg-gradient-to-r from-primary/20 to-cyan-400/20 rounded-full mx-auto my-6" />
                              <p className="text-foreground text-lg leading-relaxed font-medium max-w-2xl text-center">
                                {member.bio}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="md:flex -left-16" />
                <CarouselNext className="md:flex -right-16" />
              </Carousel>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default AboutPage