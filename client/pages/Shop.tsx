import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

export default function Shop() {
  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      return res.ok ? await res.json() : [];
    },
  });

  return (
    <div className="min-h-screen bg-celestial py-12 px-4 flex flex-col items-center">
      <h1 className="font-heading text-4xl text-pink mb-8">Shop</h1>
      {isLoading ? (
        <div className="text-gold">Loading products...</div>
      ) : !products || products.length === 0 ? (
        <div className="text-gold">No products available.</div>
      ) : (
        <div className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {products.map((product: any) => (
            <Link
              key={product.id}
              to={`/shop/${product.id}`}
              className="bg-black bg-opacity-70 rounded-xl shadow-lg p-4 flex flex-col items-center hover:shadow-glow transition"
            >
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-32 h-32 object-cover rounded-lg border-2 border-gold mb-3"
              />
              <div className="font-heading text-xl text-white text-center mb-1">{product.name}</div>
              <div className="text-gold font-body text-lg font-bold mb-2">${(product.price / 100).toFixed(2)}</div>
              <div className="text-white font-body text-sm text-center">{product.description}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}