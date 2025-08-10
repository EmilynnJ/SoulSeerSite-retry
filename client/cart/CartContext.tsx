import React, { createContext, useContext, useEffect, useState } from "react";

type CartItem = { productId: number; qty: number };
type CartProduct = CartItem & { name: string; price: number; imageUrl: string };

interface CartContextType {
  items: CartItem[];
  add: (item: CartItem) => void;
  remove: (productId: number) => void;
  update: (productId: number, qty: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextType>({
  items: [],
  add: () => {},
  remove: () => {},
  update: () => {},
  clear: () => {},
});

export function useCart() {
  return useContext(CartContext);
}

export default function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("cart") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(items));
  }, [items]);

  function add(item: CartItem) {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.productId === item.productId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx].qty += item.qty;
        return copy;
      }
      return [...prev, item];
    });
  }
  function remove(productId: number) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }
  function update(productId: number, qty: number) {
    setItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, qty } : i))
    );
  }
  function clear() {
    setItems([]);
  }

  return (
    <CartContext.Provider value={{ items, add, remove, update, clear }}>
      {children}
    </CartContext.Provider>
  );
}