import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useCart } from "../cart/CartContext";
import toast from "react-hot-toast";

export default function ProductPage() {
  const { id } = useParams();
  const { add } = useCart();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const res = await fetch(`/api/products/${id}`);
      return res.ok ? await res.json() : null;
    },
    enabled: !!id,
  });

  if (isLoading)
    return (
      <div className="min-h-screen bg-celestial flex items-center justify-center">
        <div className="text-gold">Loading...</div>
      </div>
    );
  if (!product)
    return (
      <div className="min-h-screen bg-celestial flex items-center justify-center">
        <div className="text-gold">Product not found.</div>
      </div>
    );

  return (
    <div className="min-h-screen bg-celestial flex flex-col items-center pt-10 px-2">
      <div className="bg-black bg-opacity-90 rounded-2xl shadow-xl p-8 max-w-xl w-full flex flex-col md:flex-row gap-10">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-48 h-48 object-cover rounded-lg border-2 border-gold"
        />
        <div className="flex-1 flex flex-col">
          <h1 className="font-heading text-3xl text-pink mb-3">{product.name}</h1>
          <div className="text-gold font-body text-xl font-bold mb-2">
            ${(product.price / 100).toFixed(2)}
          </div>
          <div className="text-white font-body mb-4">{product.description}</div>
          <div className="flex items-center gap-2 mb-4">
            <label className="text-white font-body mr-2">Qty:</label>
            <input
              type="number"
              className="w-20 px-3 py-2 rounded-lg border border-gold bg-black text-white"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
            />
          </div>
          <button
            className="bg-pink text-white px-8 py-3 rounded-full font-bold shadow-glow hover:bg-gold hover:text-black transition"
            onClick={() => {
              add({ productId: product.id, qty });
              toast.success("Added to cart!");
              navigate("/shop");
            }}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}