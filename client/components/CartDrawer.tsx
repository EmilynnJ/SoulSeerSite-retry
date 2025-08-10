import React from "react";
import { useCart } from "../cart/CartContext";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

export default function CartDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { items, remove, update, clear } = useCart();
  const navigate = useNavigate();

  // Fetch product details for items
  const { data: products } = useQuery({
    queryKey: ["cartProducts", items],
    queryFn: async () => {
      if (items.length === 0) return [];
      const ids = items.map((i) => i.productId).join(",");
      const res = await fetch(`/api/products?ids=${ids}`);
      return res.ok ? await res.json() : [];
    },
    keepPreviousData: true,
  });

  const cartProducts =
    items
      .map((i) => ({
        ...i,
        ...products?.find((p: any) => p.id === i.productId),
      }))
      .filter((p) => !!p.name) || [];

  const subtotal = cartProducts.reduce(
    (sum, p) => sum + (p.price || 0) * (p.qty || 1),
    0
  );

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black bg-opacity-50">
      <div className="w-full max-w-md bg-celestial h-full shadow-2xl p-6 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-2xl text-pink">Cart</h2>
          <button
            className="text-gold text-xl font-bold"
            onClick={onClose}
            aria-label="Close cart"
          >
            ×
          </button>
        </div>
        {cartProducts.length === 0 ? (
          <div className="text-gold font-body mt-8">Your cart is empty.</div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {cartProducts.map((item) => (
              <div
                key={item.productId}
                className="flex gap-3 items-center border-b border-gray-700 py-3"
              >
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-16 h-16 object-cover rounded-lg border border-gold"
                />
                <div className="flex-1">
                  <div className="text-white font-bold">{item.name}</div>
                  <div className="text-pink">${((item.price || 0) / 100).toFixed(2)}</div>
                  <input
                    type="number"
                    value={item.qty}
                    min={1}
                    onChange={(e) =>
                      update(item.productId, parseInt(e.target.value) || 1)
                    }
                    className="w-16 px-2 py-1 mt-1 rounded bg-black text-white border border-gold"
                  />
                </div>
                <button
                  className="text-pink hover:text-gold font-bold text-lg"
                  onClick={() => remove(item.productId)}
                  aria-label="Remove item"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 text-white font-body">
          <div className="flex justify-between mb-2">
            <span className="font-bold">Subtotal</span>
            <span className="font-bold text-gold">${(subtotal / 100).toFixed(2)}</span>
          </div>
          <button
            className="w-full mt-2 bg-pink text-white px-6 py-3 rounded-full font-bold shadow-glow hover:bg-gold hover:text-black transition disabled:bg-gray-600"
            disabled={cartProducts.length === 0}
            onClick={() => {
              onClose();
              navigate("/shop/checkout");
            }}
          >
            Checkout
          </button>
          <button
            className="w-full mt-2 bg-gray-700 text-white px-6 py-2 rounded-full font-bold"
            onClick={clear}
            disabled={cartProducts.length === 0}
          >
            Clear Cart
          </button>
        </div>
      </div>
      <div className="flex-1" onClick={onClose} tabIndex={-1} />
    </div>
  );
}