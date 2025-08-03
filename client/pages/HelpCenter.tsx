import React from "react";

export default function HelpCenter() {
  return (
    <div className="min-h-screen bg-celestial flex flex-col items-center pt-16 pb-8 px-4">
      <div className="max-w-2xl w-full bg-black bg-opacity-70 rounded-2xl shadow-xl p-8 text-white animate-fade-in">
        <h1 className="font-heading text-3xl text-pink mb-6">Help Center</h1>
        <h2 className="font-body text-xl text-gold mb-4">Frequently Asked Questions</h2>
        <div className="space-y-4">
          <div>
            <div className="font-bold text-white">How do I book a reading?</div>
            <div className="text-white">Simply browse online readers and click "Book a Reading" to select your preferred type and time.</div>
          </div>
          <div>
            <div className="font-bold text-white">How do I add funds to my account?</div>
            <div className="text-white">Go to your dashboard, choose "Add Funds", and complete the secure payment via Stripe.</div>
          </div>
          <div>
            <div className="font-bold text-white">How are readers paid?</div>
            <div className="text-white">Readers receive payouts via Stripe Connect, with 70% of session and gift revenue paid out daily if balance exceeds $15.</div>
          </div>
          <div>
            <div className="font-bold text-white">What if I lose connection during a session?</div>
            <div className="text-white">Sessions are protected by a grace period: you can reconnect and continue without losing your minutes or payment.</div>
          </div>
          <div>
            <div className="font-bold text-white">How do I contact support?</div>
            <div className="text-white">Email <span className="text-pink">support@soulseer.app</span> or use the in-app support form for assistance.</div>
          </div>
        </div>
      </div>
    </div>
  );
}