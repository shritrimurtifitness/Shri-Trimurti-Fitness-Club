import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const faqs = [
  {
    question: "How do I book a box cricket or football slot?",
    answer:
      "Simply click 'Book Now', choose your preferred sport (Box Cricket or Football), select the date and time slot, and make an instant payment via UPI QR. Your slot is confirmed within seconds!",
  },
  {
    question: "What are the arena operational hours?",
    answer:
      "Shri Trimurti Sports Arena is open daily from 10:00 AM to 12:00 AM (midnight). High-powered LED floodlights ensure crystal-clear visibility for evening and late-night games.",
  },
  {
    question: "Are sports equipment (bats, balls, stumps) provided?",
    answer:
      "Yes! High-grade cricket bats, tennis balls, safety stumps, and footballs are provided on-site. You are also welcome to bring your personal gear.",
  },
  {
    question: "How does UPI payment verification work?",
    answer:
      "After scanning our verified UPI QR code, simply enter the 12-digit UTR / Transaction Reference number. Our automated verification confirms your booking instantly.",
  },
  {
    question: "Can we organize corporate tournaments or private championships?",
    answer:
      "Absolutely! We regularly host corporate matches, college tournaments, and private leagues. We can provide full match coordination, umpiring, and sound support. Contact us directly via WhatsApp for custom tournament packages.",
  },
  {
    question: "What is your rescheduling or rain policy?",
    answer:
      "If severe adverse weather interrupts play or you need to reschedule with reasonable advance notice, contact our arena desk on WhatsApp or phone, and we will happily adjust your session to an alternate available slot.",
  },
  {
    question: "Is vehicle parking available at the venue?",
    answer:
      "Yes, we have a spacious, dedicated on-site parking area for both two-wheelers and four-wheelers with easy access to the pitch.",
  },
];

export default function FAQSection() {
  return (
    <section id="faq" className="py-20 lg:py-28 relative bg-card/20">
      <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span className="inline-block px-3 py-1 mb-3 text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 rounded-full border border-primary/20">
            Got Questions?
          </span>
          <h2 className="font-heading text-3xl lg:text-4xl font-extrabold text-foreground mb-3">
            Frequently Asked <span className="text-gradient-turf">Questions</span>
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            Everything you need to know about booking, gear, and playing at Shri Trimurti Sports Arena.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm mb-10"
        >
          <Accordion type="single" collapsible className="w-full space-y-2">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-border">
                <AccordionTrigger className="text-left font-heading font-bold text-sm sm:text-base text-foreground hover:text-primary transition-colors py-4">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm leading-relaxed pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>

        {/* Still have questions banner */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-heading font-bold text-foreground text-sm sm:text-base">
                Have a different question?
              </h4>
              <p className="text-xs text-muted-foreground">
                Our arena team is just a message away on WhatsApp.
              </p>
            </div>
          </div>

          <a
            href="https://wa.me/917083738373?text=Hi%20Shri%20Trimurti%20Sports%20Arena,%20I%20have%20a%20question%20regarding%20booking."
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold gap-2">
              <MessageCircle className="w-4 h-4" /> Chat on WhatsApp
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}
