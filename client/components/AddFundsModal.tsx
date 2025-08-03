import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import apiInstance from "../src/lib/api";
import toast from "react-hot-toast";
import { queryClient } from "../src/lib/queryClient";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY!);

function AddFundsForm({
  clientSecret,
  onSuccess,
  onClose,
}: {
  clientSecret: string;
  onSuccess: () => void;
  onClose: () => void;
}) {
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
      toast.success("Funds added!");
      queryClient.invalidateQueries(["balance"]);
      onSuccess();
      onClose();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <div className="flex justify-between gap-3">
        <button
          type="button"
          onClick={onClose}
          className="bg-gray-600 text-white px-5 py-2 rounded-full"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="bg-pink text-white px-8 py-2 rounded-full font-bold shadow-glow hover:bg-gold hover:text-black transition"
          disabled={loading}
        >
          {loading ? "Processing..." : "Add Funds"}
        </button>
      </div>
    </form>
  );
}

export default function AddFundsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(1000);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const { mutate: createIntent, isLoading } = useMutation({
    mutationFn: async (amt: number) => {
      const { data } = await apiInstance.post("/api/user/add-funds", {
        amount: amt,
      });
      return data.clientSecret;
    },
    onSuccess: (secret) => {
      setClientSecret(secret);
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to start payment"
      );
    },
  });

  function handlePreset(amt: number) {
    setAmount(amt);
    createIntent(amt);
  }

  function handleCustom(e: React.FormEvent) {
    e.preventDefault();
    if (amount < 500) {
      toast.error("Minimum $5");
      return;
    }
    createIntent(amount);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
      <div className="bg-celestial rounded-xl shadow-xl p-8 max-w-sm w-full">
        <h2 className="font-heading text-2xl text-pink mb-4">Add Funds</h2>
        {!clientSecret ? (
          <>
            <div className="flex gap-2 mb-4">
              {[500, 1000, 2000].map((amt) => (
                <button
                  key={amt}
                  className="bg-gold text-black px-4 py-2 rounded-full font-bold"
                  onClick={() => handlePreset(amt)}
                >
                  ${amt / 100}
                </button>
              ))}
            </div>
            <form onSubmit={handleCustom} className="flex gap-3 mb-2">
              <input
                type="number"
                value={amount}
                min={500}
                step={100}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="px-4 py-2 rounded-full border border-gold bg-black text-white font-body w-32"
                placeholder="Amount ($)"
              />
              <button
                type="submit"
                className="bg-pink text-white px-5 py-2 rounded-full font-bold shadow-glow hover:bg-gold hover:text-black transition"
                disabled={isLoading}
              >
                Add
              </button>
            </form>
            <div className="text-white text-xs">
              Minimum $5. Funds are instantly credited after payment.
            </div>
          </>
        ) : (
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
            <AddFundsForm clientSecret={clientSecret} onSuccess={onClose} onClose={onClose} />
          </Elements>
        )}
      </div>
    </div>
  );
}