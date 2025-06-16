import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { 
  ShoppingBag, 
  Star,
  ArrowRight,
  Package,
  Gem,
  Book,
  Flame
} from "lucide-react";

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  stock: number;
  featured: boolean;
}

export function ShopSection() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeaturedProducts();
  }, []);

  const fetchFeaturedProducts = async () => {
    try {
      const response = await fetch('/api/products/featured');
      if (response.ok) {
        const products = await response.json();
        setFeaturedProducts(products.slice(0, 4)); // Show only first 4
      }
    } catch (error) {
      console.error('Failed to fetch featured products:', error);
      // Show mock data for demo
      setFeaturedProducts([
        {
          id: 1,
          name: "Amethyst Crystal Set",
          description: "Enhance your spiritual practice with this beautiful amethyst crystal collection.",
          price: 4999,
          imageUrl: "https://images.unsplash.com/photo-1518051870910-a46e30fd9db9?w=400",
          category: "crystals",
          stock: 10,
          featured: true
        },
        {
          id: 2,
          name: "Mystical Tarot Deck",
          description: "Professional tarot deck with guidebook for divination and self-discovery.",
          price: 2999,
          imageUrl: "https://images.unsplash.com/photo-1594736797933-d0d7e2d3fccf?w=400",
          category: "tarot",
          stock: 25,
          featured: true
        },
        {
          id: 3,
          name: "Sage Cleansing Bundle",
          description: "Premium white sage bundle for spiritual cleansing and energy clearing.",
          price: 1999,
          imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400",
          category: "candles",
          stock: 15,
          featured: true
        },
        {
          id: 4,
          name: "Moon Phase Journal",
          description: "Track your spiritual journey with this beautiful lunar-themed journal.",
          price: 3499,
          imageUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400",
          category: "books",
          stock: 20,
          featured: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'crystals':
        return <Gem className="h-4 w-4" />;
      case 'tarot':
        return <Star className="h-4 w-4" />;
      case 'books':
        return <Book className="h-4 w-4" />;
      case 'candles':
        return <Flame className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <section className="py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-alex text-pink-500 mb-4">
            Spiritual Marketplace
          </h2>
          <div className="animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-gray-800/50 rounded-lg h-64"></div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16">
      <div className="text-center mb-12">
        <div className="flex items-center justify-center mb-4">
          <ShoppingBag className="text-purple-400 h-6 w-6 mr-2" />
          <h2 className="text-4xl font-alex text-pink-500">
            Spiritual Marketplace
          </h2>
          <ShoppingBag className="text-purple-400 h-6 w-6 ml-2" />
        </div>
        <p className="font-playfair text-gray-300 text-lg max-w-2xl mx-auto">
          Discover sacred tools, crystals, and spiritual guides to enhance your journey
        </p>
      </div>

      {featuredProducts.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-playfair text-gray-300 mb-2">
            Coming Soon
          </h3>
          <p className="text-gray-400 mb-6">
            Our spiritual marketplace is being prepared with love and intention
          </p>
          <Link href="/shop">
            <Button className="bg-pink-600 hover:bg-pink-700">
              Explore Shop
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {featuredProducts.map((product) => (
              <Card key={product.id} className="bg-gray-900/80 border-pink-500/20 hover:border-pink-500/40 transition-all duration-300 group overflow-hidden">
                <div className="relative">
                  <div className="aspect-square bg-gradient-to-br from-purple-900/30 to-pink-900/30 relative overflow-hidden">
                    <img 
                      src={product.imageUrl} 
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    
                    {/* Featured badge */}
                    {product.featured && (
                      <div className="absolute top-2 left-2">
                        <Badge className="bg-yellow-600 text-yellow-100">
                          <Star className="h-3 w-3 mr-1 fill-current" />
                          Featured
                        </Badge>
                      </div>
                    )}

                    {/* Stock indicator */}
                    <div className="absolute top-2 right-2">
                      {product.stock > 0 ? (
                        <Badge variant="outline" className="bg-green-900/80 border-green-500 text-green-400">
                          In Stock
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-900/80 border-red-500 text-red-400">
                          Sold Out
                        </Badge>
                      )}
                    </div>

                    {/* Category overlay */}
                    <div className="absolute bottom-2 left-2">
                      <Badge variant="outline" className="bg-black/70 border-purple-500/30 text-purple-200">
                        {getCategoryIcon(product.category)}
                        <span className="ml-1 capitalize">{product.category}</span>
                      </Badge>
                    </div>
                  </div>
                </div>

                <CardContent className="p-4 space-y-3">
                  <div>
                    <h3 className="font-playfair text-white font-medium group-hover:text-pink-400 transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-gray-300 text-sm line-clamp-2 mt-1">
                      {product.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-xl font-bold text-pink-400">
                      {formatPrice(product.price)}
                    </div>
                    <div className="text-sm text-gray-400">
                      {product.stock} left
                    </div>
                  </div>

                  <Link href={`/shop/product/${product.id}`}>
                    <Button 
                      size="sm" 
                      className="w-full bg-purple-600 hover:bg-purple-700 group-hover:shadow-lg transition-all"
                      disabled={product.stock === 0}
                    >
                      {product.stock > 0 ? (
                        <>
                          Add to Cart
                          <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </>
                      ) : (
                        'Out of Stock'
                      )}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* View All Button */}
          <div className="text-center">
            <Link href="/shop">
              <Button variant="outline" size="lg" className="border-purple-500 text-purple-500 hover:bg-purple-500 hover:text-white">
                <ShoppingBag className="mr-2 h-5 w-5" />
                Explore Full Marketplace
              </Button>
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
