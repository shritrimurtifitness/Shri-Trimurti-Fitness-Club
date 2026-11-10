import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield, CheckCircle, Mail, Phone, MapPin } from "lucide-react";

export default function PrivacyPolicy() {
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
          <Shield className="w-8 h-8 text-emerald-400" />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Privacy Policy & Data Protection
          </h1>
        </div>

        <p className="text-slate-400 text-sm mb-8">
          Last Updated: November 2026 | Effective Date: Immediately
        </p>

        <div className="space-y-6 text-slate-300 leading-relaxed text-sm sm:text-base">
          <section>
            <h2 className="text-lg sm:text-xl font-semibold text-white mb-2">1. Introduction</h2>
            <p>
              Welcome to <strong>Shri Trimurti Sports Arena</strong> ("we", "our", or "us"). We operate
              the sports turf booking platform at{" "}
              <a href="https://shritrimurtifitnessclub.in" className="text-emerald-400 underline">
                shritrimurtifitnessclub.in
              </a>{" "}
              and our automated WhatsApp Business bot. We respect your privacy and are committed to
              protecting the personal information you share with us.
            </p>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-semibold text-white mb-2">2. Information We Collect</h2>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
              <li><strong>Contact Information:</strong> Full name, phone number, and email address provided during slot booking or tournament registrations.</li>
              <li><strong>WhatsApp Interaction Data:</strong> Messages, slot inquiries, and booking confirmations exchanged with our official WhatsApp Business bot.</li>
              <li><strong>Transaction Data:</strong> UPI reference IDs and payment receipt timestamps (we do not store your bank account or UPI PINs).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-semibold text-white mb-2">3. How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
              <li>To confirm your cricket and football turf slot bookings.</li>
              <li>To deliver instant digital WhatsApp booking passes and entry QR codes.</li>
              <li>To provide customer support and real-time slot availability inquiries.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-semibold text-white mb-2">4. WhatsApp Cloud API & Third-Party Services</h2>
            <p>
              We utilize Meta's WhatsApp Cloud API to communicate with customers who reach out to us.
              We do not sell, rent, or trade your personal information to third parties. Data is processed
              securely in accordance with Meta's developer policies.
            </p>
          </section>

          <section id="data-deletion" className="p-5 rounded-xl bg-slate-800/60 border border-slate-700">
            <h2 className="text-lg sm:text-xl font-semibold text-emerald-400 mb-2 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" /> 5. User Data Deletion Instructions
            </h2>
            <p className="mb-2">
              In accordance with Meta Platform and GDPR policies, you have the right to request deletion
              of all your personal information and WhatsApp conversation logs from our databases at any time.
            </p>
            <p className="mb-2"><strong>How to request data deletion:</strong></p>
            <ol className="list-decimal pl-5 space-y-1 text-slate-300">
              <li>Send an email to <a href="mailto:shritrimurtifitness@gmail.com" className="text-emerald-400 underline">shritrimurtifitness@gmail.com</a> with the subject line <em>"Data Deletion Request"</em>.</li>
              <li>Include your full name and registered phone number.</li>
              <li>Alternatively, message <strong>"DELETE MY DATA"</strong> directly to our WhatsApp bot.</li>
            </ol>
            <p className="mt-2 text-xs text-slate-400">
              Our administrative team will permanently purge your records from our databases within 48 hours of verification and confirm via email/WhatsApp.
            </p>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-semibold text-white mb-2">6. Contact Information</h2>
            <p className="mb-2">If you have any questions regarding this Privacy Policy or your data, please contact us:</p>
            <div className="space-y-1 text-slate-400 text-sm">
              <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-emerald-400" /> Kudire Factory, Sangrul Fata, Koparde, Maharashtra 416204</div>
              <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-emerald-400" /> +91 7083738373</div>
              <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-emerald-400" /> shritrimurtifitness@gmail.com</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
