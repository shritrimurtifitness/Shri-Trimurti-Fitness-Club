import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText, MapPin, Phone, Mail } from "lucide-react";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-2xl backdrop-blur-md">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-medium text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
          <FileText className="w-8 h-8 text-emerald-400" />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Terms of Service
          </h1>
        </div>

        <p className="text-slate-400 text-sm mb-8">
          Last Updated: November 2026 | Effective Date: Immediately
        </p>

        <div className="space-y-6 text-slate-300 leading-relaxed text-sm sm:text-base">
          <section>
            <h2 className="text-lg sm:text-xl font-semibold text-white mb-2">1. Acceptance of Terms</h2>
            <p>
              By accessing, browsing, or booking turf slots at <strong>Shri Trimurti Sports Arena</strong> through
              our website or WhatsApp bot, you agree to comply with and be bound by these Terms of Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-semibold text-white mb-2">2. Turf Bookings & Payment</h2>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
              <li>Bookings are confirmed upon successful UPI payment verification and slot allocation.</li>
              <li>Players are requested to arrive at least 10 minutes prior to their reserved time slot.</li>
              <li>Only approved sports footwear (non-metal turf shoes) is allowed on the artificial turf.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-semibold text-white mb-2">3. WhatsApp Automated Communications</h2>
            <p>
              By opting into WhatsApp updates or inquiring with our automated bot, you consent to receive
              transactional messages, digital tickets, and slot status notifications related to your activity.
            </p>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-semibold text-white mb-2">4. Arena Rules & Code of Conduct</h2>
            <p>
              Smoking, alcohol, and hazardous materials are strictly prohibited within arena premises.
              Management reserves the right to deny entry or cancel bookings without refund in case of misconduct.
            </p>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-semibold text-white mb-2">5. Contact Us</h2>
            <div className="space-y-1 text-slate-400 text-sm">
              <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-emerald-400" /> Kudire Factory, Sangrul Fata, Koparde, Maharashtra 416204</div>
              <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-emerald-400" /> +91 9595153006</div>
              <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-emerald-400" /> shritrimurtifitness@gmail.com</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
