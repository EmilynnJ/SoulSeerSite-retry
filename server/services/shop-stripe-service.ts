import Stripe from 'stripe';
import { log } from '../server-only';
import { db } from '../db';
import { products } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { storage } from '../storage';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any, // Using as any to bypass type checking for now
});

export class ShopStripeService {
  /**
   * Synchronize a PostgreSQL product with Stripe
   * 
   * This creates or updates a product in Stripe based on the PostgreSQL product data
   */
  async syncProductWithStripe(productId: number): Promise<void> {
    try {
      // Get product details from PostgreSQL
      const product = await storage.getProduct(productId);
      
      if (!product) {
        throw new Error(`Product not found with ID: ${productId}`);
      }
      
      // Format the price in cents for Stripe (price is already stored in cents in PostgreSQL)
      const priceInCents = Math.round(product.price);
      
      let stripeProduct: Stripe.Product;
      let stripePrice: Stripe.Price;
      
      // Check if the product already exists in Stripe
      if (product.stripeProductId) {
        // Update existing product
        stripeProduct = await stripe.products.update(product.stripeProductId, {
          name: product.name,
          description: product.description || '',
          active: true,
          images: product.imageUrl ? [product.imageUrl] : undefined,
          metadata: {
            postgresId: product.id.toString(),
            category: product.category || 'Miscellaneous',
          },
        });
        
        // Check if we need to create a new price for the product
        if (product.stripePriceId) {
          // Stripe doesn't allow updating prices, we check and create a new one if needed
          const existingPrice = await stripe.prices.retrieve(product.stripePriceId);
          
          if (existingPrice.unit_amount !== priceInCents) {
            // Price has changed, create a new price
            stripePrice = await stripe.prices.create({
              product: stripeProduct.id,
              unit_amount: priceInCents,
              currency: 'usd',
              active: true,
            });
            
            // Update the product with the new price ID
            await storage.updateProduct(product.id, {
              stripePriceId: stripePrice.id
            });
          }
        } else {
          // No price associated, create one
          stripePrice = await stripe.prices.create({
            product: stripeProduct.id,
            unit_amount: priceInCents,
            currency: 'usd',
            active: true,
          });
          
          // Update the product with the new price ID
          await storage.updateProduct(product.id, {
            stripePriceId: stripePrice.id
          });
        }
      } else {
        // Create new product in Stripe
        stripeProduct = await stripe.products.create({
          name: product.name,
          description: product.description || '',
          active: true,
          images: product.imageUrl ? [product.imageUrl] : undefined,
          metadata: {
            postgresId: product.id.toString(),
            category: product.category || 'Miscellaneous',
          },
        });
        
        // Create a price for the product
        stripePrice = await stripe.prices.create({
          product: stripeProduct.id,
          unit_amount: priceInCents,
          currency: 'usd',
          active: true,
        });
        
        // Update the PostgreSQL product with Stripe IDs
        await storage.updateProduct(product.id, {
          stripeProductId: stripeProduct.id,
          stripePriceId: stripePrice.id
        });
      }
      
      log(`Successfully synchronized product ${product.name} with Stripe`, 'shop-stripe');
    } catch (error: any) {
      log(`Error synchronizing product with Stripe: ${error.message}`, 'shop-stripe-error');
      throw error;
    }
  }
  
  /**
   * Synchronize all PostgreSQL products with Stripe
   * 
   * This creates or updates all products in Stripe based on the PostgreSQL data
   */
  async syncAllProductsWithStripe(): Promise<void> {
    try {
      // Get all products from PostgreSQL
      const productList = await storage.getProducts();
      
      if (productList.length === 0) {
        log('No products found to synchronize with Stripe', 'shop-stripe');
        return;
      }
      
      // Sync each product
      for (const product of productList) {
        await this.syncProductWithStripe(product.id);
      }
      
      log(`Successfully synchronized ${productList.length} products with Stripe`, 'shop-stripe');
    } catch (error: any) {
      log(`Error synchronizing all products with Stripe: ${error.message}`, 'shop-stripe-error');
      throw error;
    }
  }
  
  /**
   * Import products from Stripe to PostgreSQL
   * 
   * This retrieves all products from Stripe and creates or updates them in the database
   */
  async importProductsFromStripe(): Promise<void> {
    try {
      log('Starting import of products from Stripe to PostgreSQL', 'shop-stripe');
      
      // Retrieve all active products from Stripe
      const stripeProducts = await stripe.products.list({ active: true });
      
      if (stripeProducts.data.length === 0) {
        log('No active products found in Stripe', 'shop-stripe');
        return;
      }
      
      log(`Found ${stripeProducts.data.length} active products in Stripe`, 'shop-stripe');
      
      // Process each Stripe product
      for (const stripeProduct of stripeProducts.data) {
        try {
          // Get product prices (we'll use the first active price)
          const prices = await stripe.prices.list({
            product: stripeProduct.id,
            active: true
          });
          
          if (prices.data.length === 0) {
            log(`No active prices found for Stripe product ${stripeProduct.id}`, 'shop-stripe');
            continue;
          }
          
          const stripePrice = prices.data[0];
          const priceAmount = stripePrice.unit_amount ? stripePrice.unit_amount : 0;
          
          try {
            // Check if product exists by stripeProductId
            const existingProducts = await db.select().from(products)
              .where(eq(products.stripeProductId, stripeProduct.id));
            
            const existingProduct = existingProducts.length > 0 ? existingProducts[0] : null;
            
            if (existingProduct) {
              // Update existing product
              await db.update(products)
                .set({
                  name: stripeProduct.name,
                  description: stripeProduct.description || '',
                  price: priceAmount,
                  imageUrl: stripeProduct.images && stripeProduct.images.length > 0 ? stripeProduct.images[0] : undefined,
                  stripePriceId: stripePrice.id,
                  category: stripeProduct.metadata?.category || 'Miscellaneous',
                  updatedAt: new Date()
                })
                .where(eq(products.id, existingProduct.id));
              
              log(`Updated existing PostgreSQL product ${existingProduct.id} from Stripe product ${stripeProduct.id}`, 'shop-stripe');
            } else {
              // Create new product
              const [newProduct] = await db.insert(products)
                .values({
                  name: stripeProduct.name,
                  description: stripeProduct.description || '',
                  price: priceAmount,
                  imageUrl: stripeProduct.images && stripeProduct.images.length > 0 ? stripeProduct.images[0] : undefined,
                  stripeProductId: stripeProduct.id,
                  stripePriceId: stripePrice.id,
                  category: stripeProduct.metadata?.category || 'Miscellaneous',
                  isFeatured: false,
                  inventory: 999 // Default inventory
                })
                .returning();
              
              log(`Created new PostgreSQL product ${newProduct.id} from Stripe product ${stripeProduct.id}`, 'shop-stripe');
            }
          } catch (dbError: any) {
            log(`Database operation failed for Stripe product ${stripeProduct.id}: ${dbError.message}`, 'shop-stripe-error');
            // Skip to next product if database operation fails
            continue;
          }
        } catch (productError: any) {
          log(`Error processing Stripe product ${stripeProduct.id}: ${productError.message}`, 'shop-stripe-error');
          // Continue with next product
        }
      }
      
      log('Completed import of products from Stripe to PostgreSQL', 'shop-stripe');
    } catch (error: any) {
      log(`Error importing products from Stripe: ${error.message}`, 'shop-stripe-error');
      // Instead of throwing the error, we just log it to prevent the whole sync from failing
      // This ensures the application can still start up with partial sync
    }
  }
  
  /**
   * Create a checkout session for a product
   * 
   * @param productId PostgreSQL product ID
   * @param userId User ID making the purchase
   * @param quantity Quantity to purchase
   * @param successUrl Success URL for redirect after checkout
   * @param cancelUrl Cancel URL for redirect if checkout is canceled
   */
  async createCheckoutSession(
    productId: number,
    userId: number,
    quantity: number = 1,
    successUrl: string,
    cancelUrl: string
  ): Promise<string> {
    try {
      // Get product details from PostgreSQL
      const product = await storage.getProduct(productId);
      
      if (!product) {
        throw new Error(`Product not found with ID: ${productId}`);
      }
      
      if (!product.stripePriceId) {
        // Product not yet synchronized with Stripe, do it now
        await this.syncProductWithStripe(productId);
        
        // Reload the product to get the updated Stripe IDs
        const updatedProduct = await storage.getProduct(productId);
        if (!updatedProduct || !updatedProduct.stripePriceId) {
          throw new Error('Failed to synchronize product with Stripe');
        }
        
        product.stripePriceId = updatedProduct.stripePriceId;
      }
      
      // Create a checkout session
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price: product.stripePriceId,
            quantity: quantity,
          },
        ],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: userId.toString(),
        metadata: {
          productId: productId.toString(),
          userId: userId.toString(),
        },
      });
      
      // Return the session URL
      if (!session.url) {
        throw new Error('Failed to create Stripe checkout session URL');
      }
      
      return session.url;
    } catch (error: any) {
      log(`Error creating checkout session: ${error.message}`, 'shop-stripe-error');
      throw error;
    }
  }
  
  /**
   * Process a Stripe webhook event for checkout completion
   * 
   * @param event Stripe webhook event
   */
  async processCheckoutCompleted(event: Stripe.Event): Promise<void> {
    try {
      const session = event.data.object as Stripe.Checkout.Session;
      
      if (!session.metadata?.productId || !session.metadata?.userId) {
        log('Missing metadata in checkout session', 'shop-stripe-error');
        return;
      }
      
      const { productId, userId } = session.metadata;
      
      // Convert string IDs to numbers
      const productIdNum = parseInt(productId, 10);
      const userIdNum = parseInt(userId, 10);
      
      // Get the total amount in cents and convert to the format needed for our database
      const totalAmount = session.amount_total ? session.amount_total : 0;
      
      // Create an order in PostgreSQL
      const order = await storage.createOrder({
        userId: userIdNum,
        status: 'completed',
        totalAmount: totalAmount,
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent as string
        // createdAt and updatedAt will be set automatically by the database
      });
      
      // Create order item for the product
      await storage.createOrderItem({
        orderId: order.id,
        productId: productIdNum,
        quantity: 1,
        price: totalAmount
        // The product details will be joined when retrieving the order
      });
      
      // Update product inventory if needed
      const product = await storage.getProduct(productIdNum);
      if (product && typeof product.inventory === 'number') {
        const newInventory = Math.max(0, product.inventory - 1);
        await storage.updateProduct(product.id, {
          inventory: newInventory
        });
      }
      
      log(`Successfully processed checkout for order: ${order.id}`, 'shop-stripe');
    } catch (error: any) {
      log(`Error processing checkout completion: ${error.message}`, 'shop-stripe-error');
      throw error;
    }
  }
}

// Create a singleton instance
export const shopStripeService = new ShopStripeService();