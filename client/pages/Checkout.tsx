import React, { useState, useEffect } from "react";
import { useCart } from "../cart/CartContext";
import { useNavigate } from "react-router-dom";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY!);

function CheckoutForm({ clientSecret, amount, onSuccess }: { clientSecret: string; amount: number; onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {},
      redirect: "if_required",
    });
    setLoading(false);
    if (error) {
      toast.error(error.message || "Payment failed");
    } else {
      onSuccess();
      toast.success("Order placed!");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <button
        type="submit"
        className="w-full bg-pink text-white px-8 py-2 rounded-full font-bold shadow-glow hover:bg-gold hover:text-black transition"
        disabled={loading}
      >
        {loading ? "Processing..." : `Pay $${(amount / 100).toFixed(2)}`}
      </button>
    </form>
  );
}

export default function Checkout() {
  const { items, clear } = useCart();
  const navigate = useNavigate();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    if (!items.length) {
      navigate("/shop");
    }
    async function prepare() {
      // fetch product prices
      const ids = items.map(i => i.productId).join(",");
      const res = await fetch(`/api/products?ids=${ids}`);
      const products = res.ok ? await res.json() : [];
      const subtotal = items.reduce((sum, i) => {
        const p = products.find((p: any) => p.id === i.productId);
        return sum + ((p?.price || 0) * i.qty);
      }, 0);
      setAmount(subtotal);
      // get payment intent
      const resp = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: subtotal }),
        credentials: "include",
      });
      const data = await resp.json();
      setClientSecret(data.clientSecret);
    }
    prepare();
  }, [items, navigate]);

  function handlePaymentSuccess() {
    fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ items }),
    });
    clear();
    navigate("/dashboard/orders?success=1");
  }

  if (!clientSecret) {
    return (
      <div className="min-h-screen bg-celestial flex items-center justify-center">
        <div className="text-gold">Loading checkout...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-celestial flex flex-col items-center pt-10 px-2">
      <div className="bg-black bg-opacity-90 rounded-2xl shadow-xl p-8 max-w-xl w-full">
        <h1 className="font-heading text-2xl text-pink mb-4">Checkout</h1>
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: "night",
              variables: { colorPrimary: "#FF69B4" },
            },
          }}
        >
          <CheckoutForm clientSecret={clientSecret} amount={amount} onSuccess={handlePaymentSuccess} />
        </Elements>
      </div>
    </div>
  );
}