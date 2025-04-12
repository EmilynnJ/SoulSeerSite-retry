import Stripe from 'stripe';
import * as mongodb from '../mongodb';
import { log } from '../server-only';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any, // Using as any to bypass type checking for now
});

export class ShopStripeService {
  /**
   * Synchronize a MongoDB product with Stripe
   * 
   * This creates or updates a product in Stripe based on the MongoDB product data
   */
  async syncProductWithStripe(productId: string): Promise<void> {
    try {
      // Get product details from MongoDB
      const product = await mongodb.Product.findById(productId);
      
      if (!product) {
        throw new Error(`Product not found with ID: ${productId}`);
      }
      
      // Format the price in cents for Stripe
      const priceInCents = Math.round(product.price * 100);
      
      let stripeProduct: Stripe.Product;
      let stripePrice: Stripe.Price;
      
      // Check if the product already exists in Stripe
      if (product.stripeProductId) {
        // Update existing product
        stripeProduct = await stripe.products.update(product.stripeProductId, {
          name: product.name,
          description: product.description,
          active: true,
          images: product.imageUrl ? [product.imageUrl] : undefined,
          metadata: {
            mongoDbId: product._id.toString(),
            category: product.category,
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
            product.stripePriceId = stripePrice.id;
            await product.save();
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
          product.stripePriceId = stripePrice.id;
          await product.save();
        }
      } else {
        // Create new product in Stripe
        stripeProduct = await stripe.products.create({
          name: product.name,
          description: product.description,
          active: true,
          images: product.imageUrl ? [product.imageUrl] : undefined,
          metadata: {
            mongoDbId: product._id.toString(),
            category: product.category,
          },
        });
        
        // Create a price for the product
        stripePrice = await stripe.prices.create({
          product: stripeProduct.id,
          unit_amount: priceInCents,
          currency: 'usd',
          active: true,
        });
        
        // Update the MongoDB product with Stripe IDs
        product.stripeProductId = stripeProduct.id;
        product.stripePriceId = stripePrice.id;
        await product.save();
      }
      
      log(`Successfully synchronized product ${product.name} with Stripe`, 'shop-stripe');
    } catch (error: any) {
      log(`Error synchronizing product with Stripe: ${error.message}`, 'shop-stripe-error');
      throw error;
    }
  }
  
  /**
   * Synchronize all MongoDB products with Stripe
   * 
   * This creates or updates all products in Stripe based on the MongoDB data
   */
  async syncAllProductsWithStripe(): Promise<void> {
    try {
      // Get all products from MongoDB
      const products = await mongodb.Product.find();
      
      if (products.length === 0) {
        log('No products found to synchronize with Stripe', 'shop-stripe');
        return;
      }
      
      // Sync each product
      for (const product of products) {
        await this.syncProductWithStripe(product._id.toString());
      }
      
      log(`Successfully synchronized ${products.length} products with Stripe`, 'shop-stripe');
    } catch (error: any) {
      log(`Error synchronizing all products with Stripe: ${error.message}`, 'shop-stripe-error');
      throw error;
    }
  }
  
  /**
   * Import products from Stripe to MongoDB
   * 
   * This retrieves all products from Stripe and creates or updates them in MongoDB
   */
  async importProductsFromStripe(): Promise<void> {
    try {
      log('Starting import of products from Stripe to MongoDB', 'shop-stripe');
      
      // Retrieve all active products from Stripe
      const stripeProducts = await stripe.products.list({ active: true });
      
      if (stripeProducts.data.length === 0) {
        log('No active products found in Stripe', 'shop-stripe');
        return;
      }
      
      log(`Found ${stripeProducts.data.length} active products in Stripe`, 'shop-stripe');
      
      // Wait a short delay to ensure MongoDB connection is fully established
      await new Promise(resolve => setTimeout(resolve, 1000));
      
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
          const priceAmount = stripePrice.unit_amount ? stripePrice.unit_amount / 100 : 0;
          
          // Use findOneAndUpdate with explicit timeout for atomic operation instead of findOne + save
          try {
            // First check if product exists to avoid timeout with findOneAndUpdate
            const existingProduct = await mongodb.Product.findOne(
              { stripeProductId: stripeProduct.id }
            ).maxTimeMS(5000);
            
            if (existingProduct) {
              // Update existing product with fields
              existingProduct.name = stripeProduct.name;
              existingProduct.description = stripeProduct.description || '';
              existingProduct.price = priceAmount;
              existingProduct.imageUrl = stripeProduct.images && stripeProduct.images.length > 0 ? stripeProduct.images[0] : null;
              existingProduct.stripePriceId = stripePrice.id;
              existingProduct.category = stripeProduct.metadata?.category || 'Miscellaneous';
              existingProduct.updatedAt = new Date();
              
              // Save changes
              await existingProduct.save();
              log(`Updated existing MongoDB product ${existingProduct._id} from Stripe product ${stripeProduct.id}`, 'shop-stripe');
            } else {
              // Product doesn't exist, create a new one
              const newProduct = await mongodb.Product.create({
                name: stripeProduct.name,
                description: stripeProduct.description || '',
                price: priceAmount,
                imageUrl: stripeProduct.images && stripeProduct.images.length > 0 ? stripeProduct.images[0] : null,
                stripeProductId: stripeProduct.id,
                stripePriceId: stripePrice.id,
                category: stripeProduct.metadata?.category || 'Miscellaneous',
                featured: false,
                inventory: 999, // Default inventory
                createdAt: new Date(),
                updatedAt: new Date()
              });
              
              log(`Created new MongoDB product ${newProduct._id} from Stripe product ${stripeProduct.id}`, 'shop-stripe');
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
      
      log('Completed import of products from Stripe to MongoDB', 'shop-stripe');
    } catch (error: any) {
      log(`Error importing products from Stripe: ${error.message}`, 'shop-stripe-error');
      // Instead of throwing the error, we just log it to prevent the whole sync from failing
      // This ensures the application can still start up with partial sync
    }
  }
  
  /**
   * Create a checkout session for a product
   * 
   * @param productId MongoDB product ID
   * @param userId User ID making the purchase
   * @param quantity Quantity to purchase
   * @param successUrl Success URL for redirect after checkout
   * @param cancelUrl Cancel URL for redirect if checkout is canceled
   */
  async createCheckoutSession(
    productId: string,
    userId: string,
    quantity: number = 1,
    successUrl: string,
    cancelUrl: string
  ): Promise<string> {
    try {
      // Get product details from MongoDB
      const product = await mongodb.Product.findById(productId);
      
      if (!product) {
        throw new Error(`Product not found with ID: ${productId}`);
      }
      
      if (!product.stripePriceId) {
        // Product not yet synchronized with Stripe, do it now
        await this.syncProductWithStripe(productId);
        
        // Reload the product to get the updated Stripe IDs
        const updatedProduct = await mongodb.Product.findById(productId);
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
        client_reference_id: userId,
        metadata: {
          productId: productId,
          userId: userId,
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
      
      // Create an order in MongoDB
      const order = await mongodb.Order.create({
        userId: userId,
        productId: productId,
        status: 'completed',
        totalAmount: session.amount_total ? session.amount_total / 100 : 0,
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent as string,
        items: [{
          productId: productId,
          quantity: 1,
          price: session.amount_total ? session.amount_total / 100 : 0,
        }],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      // Update product inventory if needed
      const product = await mongodb.Product.findById(productId);
      if (product && typeof product.inventory === 'number') {
        product.inventory = Math.max(0, product.inventory - 1);
        await product.save();
      }
      
      log(`Successfully processed checkout for order: ${order._id}`, 'shop-stripe');
    } catch (error: any) {
      log(`Error processing checkout completion: ${error.message}`, 'shop-stripe-error');
      throw error;
    }
  }
}

// Create a singleton instance
export const shopStripeService = new ShopStripeService();