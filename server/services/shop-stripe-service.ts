import Stripe from 'stripe';
import * as mongodb from '../mongodb';
import { log } from '../server-only';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
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