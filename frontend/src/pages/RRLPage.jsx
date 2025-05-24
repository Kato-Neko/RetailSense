import { motion, AnimatePresence } from "framer-motion"
import PublicHeader from "@/components/PublicHeader"
import PublicFooter from "@/components/PublicFooter"
import { useNavigate } from "react-router-dom"
import { useState } from "react"
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react"

const RRLPage = () => {
  const navigate = useNavigate()
  const [expandedCategory, setExpandedCategory] = useState(null)

  const studies = [
    {
      id: 1,
      title: "Advanced Customer Behavior Tracking and Heatmap Analysis with YOLOv5 and DeepSORT in Retail Environment",
      authors: "Shili, M., Jayasingh, S., & Hammedi, S.",
      year: 2024,
      link: "https://doi.org/10.3390/electronics13234730",
      summary: "A comprehensive study that combines YOLOv5 for object detection and DeepSORT for tracking to analyze customer behavior in retail environments. The research demonstrates how this technology can accurately track customer movements, generate heatmaps, and provide valuable insights for store layout optimization. The system achieved high accuracy in customer tracking and successfully identified patterns in customer movement and dwell time.",
      tags: ["AI & Computer Vision", "Retail Analytics & Heatmaps", "Customer Behavior & Psychology"]
    },
    {
      id: 2,
      title: "Object Detection and Tracking using Yolov8 and DeepSORT",
      authors: "Rays, S.",
      year: 2025,
      link: "https://medium.com/@serurays/object-detection-and-tracking-using-yolov8-and-deepsort-47046fc914e9",
      summary: "A detailed technical guide on implementing the latest YOLOv8 model with DeepSORT for real-time object detection and tracking. The article covers the architecture of both systems, their integration, and practical implementation steps. It includes performance comparisons with previous versions and discusses optimization techniques for retail applications, making it particularly relevant for implementing tracking systems in store environments.",
      tags: ["AI & Computer Vision"]
    },
    {
      id: 3,
      title: "Parking Analytics Framework using Deep Learning",
      authors: "Benjdira, B., Koubaa, A., Boulila, W., & Ammar, A.",
      year: 2022,
      link: "https://doi.org/10.48550/arXiv.2203.07792",
      summary: "An innovative framework that applies deep learning techniques to analyze parking space utilization and traffic patterns. The research presents a novel approach to space management that can be adapted for retail environments. It includes methods for real-time monitoring, predictive analytics, and optimization strategies that could be valuable for retail space management and customer flow analysis.",
      tags: ["AI & Computer Vision", "Retail Analytics & Heatmaps"]
    },
    {
      id: 4,
      title: "The importance of attention heatmaps in digital and physical spaces",
      authors: "Dragonfly AI",
      year: 2025,
      link: "https://dragonflyai.co/resources/blog/the-importance-of-attention-heatmaps-in-digital-and-physical-spaces",
      summary: "An in-depth analysis of how attention heatmaps can revolutionize both digital and physical retail spaces. The article explores how these visualizations can identify high-traffic areas, optimize product placement, and improve customer engagement. It includes case studies demonstrating how retailers have used heatmap data to increase sales and enhance customer experience through strategic layout modifications.",
      tags: ["Retail Analytics & Heatmaps", "Customer Behavior & Psychology"]
    },
    {
      id: 5,
      title: "The Anatomy of a Performance-Enhancing Planogram",
      authors: "Pohl, C., et al.",
      year: 2020,
      link: "https://www.dotactiv.com/hubfs/The%20Anatomy%20of%20a%20Performance-Enhancing%20Planogram%20Ebook.pdf",
      summary: "A comprehensive technical report that breaks down the essential components of effective planogram design. The study provides detailed insights into space allocation, product placement strategies, and visual merchandising techniques. It includes data-driven approaches to optimize shelf space, improve product visibility, and increase sales through strategic product arrangement and category management.",
      tags: ["Retail Analytics & Heatmaps", "Retail Strategy & Success"]
    },
    {
      id: 6,
      title: "How Ikea mastered the Gruen effect",
      authors: "Waters, C.",
      year: 2018,
      link: "https://www.vox.com/2018/10/17/17989684/ikea-gruen-effect-unplanned-purchases",
      summary: "A fascinating analysis of how IKEA has perfected the Gruen effect to influence customer behavior and increase unplanned purchases. The article examines IKEA's store layout strategies, including their one-way path design, strategic product placement, and psychological triggers that encourage exploration and impulse buying. It provides valuable insights into how store design can be used to guide customer behavior and increase sales.",
      tags: ["Customer Behavior & Psychology", "Retail Strategy & Success"]
    },
    {
      id: 7,
      title: "The psychology behind retail product placement",
      authors: "C. & P. S. Uk",
      year: 2020,
      link: "https://www.dotactiv.com/blog/retail-product-placement",
      summary: "A detailed exploration of the psychological principles that influence effective retail product placement. The study examines how factors like eye-level positioning, color psychology, and spatial arrangement affect customer decision-making. It includes practical strategies for using these principles to create more engaging and effective product displays that drive sales and improve customer experience.",
      tags: ["Customer Behavior & Psychology", "Retail Analytics & Heatmaps"]
    },
    {
      id: 8,
      title: "The sales effect of in-store product displays: The special case of total product relocation",
      authors: "Weimar, D., Deutscher, C., & Decker, R.",
      year: 2020,
      link: "https://doi.org/10.24052/JBRMR/V15IS01/ART-13",
      summary: "A rigorous study examining the impact of product relocation on sales performance in retail environments. The research analyzes different types of product displays and their effectiveness, with particular focus on complete category relocations. It provides empirical evidence on how strategic product movement can influence customer behavior and increase sales, including specific metrics and success factors for different types of relocations.",
      tags: ["Customer Behavior & Psychology", "Retail Analytics & Heatmaps"]
    },
    {
      id: 9,
      title: "BRAND PLACEMENT AND CONSUMER CHOICE: AN IN‐STORE EXPERIMENT",
      authors: "Sigurdsson, V., Saevarsson, H., & Foxall, G.",
      year: 2009,
      link: "https://doi.org/10.1901/jaba.2009.42-741",
      summary: "A groundbreaking experimental study that investigates how brand placement affects consumer choice in retail settings. The research uses controlled experiments to measure the impact of different placement strategies on product selection. It provides valuable insights into consumer psychology and decision-making processes, with specific findings on how strategic brand placement can influence purchase decisions and brand perception.",
      tags: ["Customer Behavior & Psychology", "Retail Analytics & Heatmaps"]
    },
    {
      id: 10,
      title: "The secret of Zara's success: A culture of customer co-creation",
      authors: "Martinroll",
      year: 2021,
      link: "https://martinroll.com/resources/articles/strategy/the-secret-of-zaras-success-a-culture-of-customer-co-creation/",
      summary: "An in-depth analysis of Zara's revolutionary retail strategy that combines customer co-creation with rapid response to market trends. The article examines how Zara's unique approach to product development, supply chain management, and customer feedback has created a sustainable competitive advantage. It includes detailed insights into their business model, operational strategies, and how they maintain customer engagement through continuous innovation and adaptation.",
      tags: ["Retail Strategy & Success"]
    }
  ];

  const categories = [
    {
      title: "AI & Computer Vision",
      description: "Research on artificial intelligence, computer vision, and tracking technologies in retail environments.",
      count: `${studies.filter(s => s.tags.includes("AI & Computer Vision")).length} studies`
    },
    {
      title: "Retail Analytics & Heatmaps",
      description: "Studies on retail analytics, planograms, and heatmap applications in retail spaces.",
      count: `${studies.filter(s => s.tags.includes("Retail Analytics & Heatmaps")).length} studies`
    },
    {
      title: "Customer Behavior & Psychology",
      description: "Research on customer behavior, psychology, and the impact of store layout on shopping patterns.",
      count: `${studies.filter(s => s.tags.includes("Customer Behavior & Psychology")).length} studies`
    },
    {
      title: "Retail Strategy & Success",
      description: "Analysis of successful retail strategies and business models in the industry.",
      count: `${studies.filter(s => s.tags.includes("Retail Strategy & Success")).length} studies`
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted to-background dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <PublicHeader showBackButton onBackClick={() => navigate(-1)} />

      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-background overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400 dark:bg-blue-600 rounded-full opacity-20 blur-3xl"></div>
          <div className="absolute top-40 -left-20 w-60 h-60 bg-cyan-400 dark:bg-cyan-600 rounded-full opacity-20 blur-3xl"></div>
        </div>

        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-400 leading-tight mb-8">
              Related Literature Review
            </h1>
            <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
              A comprehensive review of existing research and studies related to retail analytics, 
              foot traffic analysis, and AI implementation in retail spaces.
            </p>
          </motion.div>
        </div>
      </section>

      {/* RRL Content Section */}
      <section className="py-20">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-8">
            {categories.map((category, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <div 
                  className="bg-muted/50 dark:bg-slate-900/50 rounded-xl p-6 backdrop-blur-sm border border-border/50 hover:border-primary/50 transition-all duration-300 cursor-pointer"
                  onClick={() => setExpandedCategory(expandedCategory === category.title ? null : category.title)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-xl font-semibold text-foreground">{category.title}</h3>
                      <p className="text-muted-foreground mt-1">{category.description}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">{category.count}</span>
                      {expandedCategory === category.title ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedCategory === category.title && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-6 space-y-6 pt-6 border-t border-border/50">
                          {studies.filter(study => study.tags.includes(category.title)).map((study, studyIndex) => (
                            <motion.div
                              key={study.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.3, delay: studyIndex * 0.1 }}
                              className="bg-background/50 dark:bg-slate-800/50 rounded-lg p-4"
                            >
                              <div className="flex justify-between items-start gap-4">
                                <div className="flex-1">
                                  <a 
                                    href={study.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:text-primary/80 font-medium inline-flex items-center gap-1"
                                  >
                                    {study.title}
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {study.authors} ({study.year})
                                  </p>
                                  <p className="text-sm text-muted-foreground mt-2">
                                    {study.summary}
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Download Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="mt-16 text-center"
          >
            <a 
              href="/AI Foot traffic - RRL.xlsx"
              download
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
            >
              Download Full RRL Document
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </a>
          </motion.div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}

export default RRLPage 