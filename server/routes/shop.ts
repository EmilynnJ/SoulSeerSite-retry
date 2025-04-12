import { Request, Response, Router } from 'express';
import { log } from '../server-only';
import { shopStripeService } from '../services/shop-stripe-service';
import Stripe from 'stripe';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { storage } from '../storage';

const router = Router();

// Middleware to verify the user is authenticated
const authenticate = (req: Request, res: Response, next: Function) => {
  if (!req.user) {
    return res.status(401).json({ error: 'You must be logged in' });
  }
  next();
};

// Middleware to verify the user is an admin
const adminOnly = (req: Request, res: Response, next: Function) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Configure multer for file uploads
const multerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(process.cwd(), 'public', 'uploads', 'products');
    
    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: multerStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WEBP are allowed.') as any);
    }
  }
});

/**
 * Get all products
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const products = await storage.getProducts();
    
    return res.status(200).json(products);
  } catch (error: any) {
    log(`Error fetching products: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to fetch products', details: error.message });
  }
});

/**
 * Get featured products
 */
router.get('/featured', async (req: Request, res: Response) => {
  try {
    const featuredProducts = await storage.getFeaturedProducts();
    
    return res.status(200).json(featuredProducts);
  } catch (error: any) {
    log(`Error fetching featured products: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to fetch featured products', details: error.message });
  }
});

/**
 * Get a product by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const productId = parseInt(id, 10);
    
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID format' });
    }
    
    const product = await storage.getProduct(productId);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    return res.status(200).json(product);
  } catch (error: any) {
    log(`Error fetching product: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to fetch product', details: error.message });
  }
});

/**
 * Create a new product (admin only)
 */
router.post('/', authenticate, adminOnly, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const { name, description, price, category, inventory, featured } = req.body;
    
    // Validate required fields
    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }
    
    // Create relative path for the image if uploaded
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/products/${req.file.filename}`;
    }
    
    // Calculate inventory value
    const inventoryValue = inventory ? parseInt(inventory, 10) : 0;
    const priceValue = parseFloat(price);
    
    if (isNaN(priceValue)) {
      return res.status(400).json({ error: 'Price must be a valid number' });
    }
    
    // Create the product using PostgreSQL storage
    const product = await storage.createProduct({
      name,
      description: description || '',
      price: Math.round(priceValue * 100), // Convert to cents for storage
      category: category || 'Miscellaneous',
      inventory: inventoryValue,
      imageUrl,
      isFeatured: featured === 'true',
      stripeProductId: null,
      stripePriceId: null,
      sellerId: req.user?.id || null,
    });
    
    // Sync with Stripe
    try {
      await shopStripeService.syncProductWithStripe(product.id);
    } catch (stripeError: any) {
      log(`Warning: Could not sync product with Stripe: ${stripeError.message}`, 'warning');
      // Continue anyway, we'll try again later
    }
    
    return res.status(201).json(product);
  } catch (error: any) {
    log(`Error creating product: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to create product', details: error.message });
  }
});

/**
 * Update a product (admin only)
 */
router.put('/:id', authenticate, adminOnly, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const productId = parseInt(id, 10);
    
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID format' });
    }
    
    const { name, description, price, category, inventory, featured } = req.body;
    
    // Get existing product
    const existingProduct = await storage.getProduct(productId);
    
    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Prepare update object
    const updates: Partial<any> = {};
    
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (price !== undefined) {
      const priceValue = parseFloat(price);
      if (!isNaN(priceValue)) {
        updates.price = Math.round(priceValue * 100); // Convert to cents
      }
    }
    if (category) updates.category = category;
    if (inventory !== undefined) {
      updates.inventory = inventory ? parseInt(inventory, 10) : 0;
    }
    if (featured !== undefined) updates.isFeatured = featured === 'true';
    
    // Create relative path for the image if uploaded
    if (req.file) {
      updates.imageUrl = `/uploads/products/${req.file.filename}`;
    }
    
    // Update the product
    const updatedProduct = await storage.updateProduct(productId, updates);
    
    if (!updatedProduct) {
      return res.status(500).json({ error: 'Failed to update product' });
    }
    
    // Sync with Stripe
    try {
      await shopStripeService.syncProductWithStripe(updatedProduct.id);
    } catch (stripeError: any) {
      log(`Warning: Could not sync product with Stripe: ${stripeError.message}`, 'warning');
      // Continue anyway, we'll try again later
    }
    
    return res.status(200).json(updatedProduct);
  } catch (error: any) {
    log(`Error updating product: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to update product', details: error.message });
  }
});

/**
 * Delete a product (admin only)
 */
router.delete('/:id', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Find the product first
    const product = await mongodb.Product.findById(id);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Archive in Stripe if it exists there
    if (product.stripeProductId) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
          apiVersion: '2023-10-16',
        });
        
        await stripe.products.update(product.stripeProductId, {
          active: false,
        });
      } catch (stripeError: any) {
        log(`Warning: Could not archive product in Stripe: ${stripeError.message}`, 'warning');
        // Continue anyway
      }
    }
    
    // Delete from MongoDB
    await mongodb.Product.findByIdAndDelete(id);
    
    return res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error: any) {
    log(`Error deleting product: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to delete product', details: error.message });
  }
});

/**
 * Create a checkout session for a product
 */
router.post('/:id/checkout', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { quantity = 1 } = req.body;
    
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Generate URLs for success and cancel
    const successUrl = `${req.protocol}://${req.get('host')}/shop/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${req.protocol}://${req.get('host')}/shop/cancel`;
    
    // Create checkout session
    const sessionUrl = await shopStripeService.createCheckoutSession(
      id,
      req.user.id,
      quantity,
      successUrl,
      cancelUrl
    );
    
    return res.status(200).json({ url: sessionUrl });
  } catch (error: any) {
    log(`Error creating checkout session: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to create checkout session', details: error.message });
  }
});

/**
 * Sync all products with Stripe (admin only)
 * This pushes MongoDB products to Stripe
 */
router.post('/sync-with-stripe', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    await shopStripeService.syncAllProductsWithStripe();
    
    return res.status(200).json({ message: 'All products synchronized with Stripe successfully' });
  } catch (error: any) {
    log(`Error synchronizing products with Stripe: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to synchronize products with Stripe', details: error.message });
  }
});

/**
 * Import products from Stripe (admin only)
 * This pulls Stripe products into MongoDB
 */
router.post('/import-from-stripe', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    await shopStripeService.importProductsFromStripe();
    
    return res.status(200).json({ message: 'All products imported from Stripe successfully' });
  } catch (error: any) {
    log(`Error importing products from Stripe: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to import products from Stripe', details: error.message });
  }
});

/**
 * Handle Stripe webhook events
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16',
  });
  
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    return res.status(500).json({ error: 'Stripe webhook secret is not configured' });
  }
  
  const sig = req.headers['stripe-signature'];
  
  if (!sig) {
    return res.status(400).json({ error: 'No Stripe signature found in request' });
  }
  
  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig as string,
      webhookSecret
    );
    
    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        await shopStripeService.processCheckoutCompleted(event);
        break;
      default:
        log(`Unhandled Stripe webhook event: ${event.type}`, 'info');
    }
    
    return res.status(200).json({ received: true });
  } catch (error: any) {
    log(`Webhook error: ${error.message}`, 'error');
    return res.status(400).json({ error: `Webhook error: ${error.message}` });
  }
});

/**
 * Get orders by user
 */
router.get('/orders', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const orders = await mongodb.Order.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    
    // Populate product details
    const ordersWithProducts = await Promise.all(
      orders.map(async (order) => {
        const productIds = order.items.map(item => item.productId);
        const products = await mongodb.Product.find({ _id: { $in: productIds } }).lean();
        
        const itemsWithProducts = order.items.map(item => {
          const product = products.find(p => p._id.toString() === item.productId.toString());
          return {
            ...item,
            product,
          };
        });
        
        return {
          ...order,
          items: itemsWithProducts,
        };
      })
    );
    
    return res.status(200).json(ordersWithProducts);
  } catch (error: any) {
    log(`Error fetching orders: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to fetch orders', details: error.message });
  }
});

/**
 * Get all orders (admin only)
 */
router.get('/admin/orders', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    const orders = await mongodb.Order.find()
      .sort({ createdAt: -1 })
      .lean();
    
    // Populate user and product details
    const ordersWithDetails = await Promise.all(
      orders.map(async (order) => {
        const user = await mongodb.User.findById(order.userId).lean();
        
        const productIds = order.items.map(item => item.productId);
        const products = await mongodb.Product.find({ _id: { $in: productIds } }).lean();
        
        const itemsWithProducts = order.items.map(item => {
          const product = products.find(p => p._id.toString() === item.productId.toString());
          return {
            ...item,
            product,
          };
        });
        
        return {
          ...order,
          user,
          items: itemsWithProducts,
        };
      })
    );
    
    return res.status(200).json(ordersWithDetails);
  } catch (error: any) {
    log(`Error fetching admin orders: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to fetch admin orders', details: error.message });
  }
});

export default router;