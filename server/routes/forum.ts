import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import slugify from 'slugify';
import { ForumCategory, ForumThread, ForumPost, User } from '../mongodb';

const router = express.Router();

// Authentication middleware
const authenticate = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'You must be logged in to perform this action' });
  }
  next();
};

// Admin-only middleware
const adminOnly = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Helper function to generate a unique slug
async function generateUniqueSlug(title: string, model: any, existingId?: string): Promise<string> {
  let slug = slugify(title, {
    lower: true,
    strict: true,
    trim: true
  });
  
  // Check if this slug already exists
  let isUnique = false;
  let counter = 0;
  let uniqueSlug = slug;
  
  while (!isUnique) {
    // If we're updating a document, exclude the current document from the check
    const query = existingId 
      ? { slug: uniqueSlug, _id: { $ne: existingId } }
      : { slug: uniqueSlug };
    
    const exists = await model.findOne(query);
    
    if (!exists) {
      isUnique = true;
    } else {
      counter++;
      uniqueSlug = `${slug}-${counter}`;
    }
  }
  
  return uniqueSlug;
}

/**
 * Get all forum categories
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories = await ForumCategory.find()
      .sort({ order: 1, name: 1 })
      .lean();
    
    // Count threads in each category
    const categoriesWithCounts = await Promise.all(categories.map(async (category: any) => {
      const threadCount = await ForumThread.countDocuments({ categoryId: category._id });
      
      return {
        id: category._id ? category._id.toString() : '',
        name: category.name || '',
        slug: category.slug || '',
        description: category.description || '',
        order: category.order || 0,
        threadCount
      };
    }));
    
    res.json(categoriesWithCounts);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
});

/**
 * Get a specific category by slug with recent threads
 */
router.get('/categories/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const category = await ForumCategory.findOne({ slug }).lean();
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    // Get threads in this category
    const threads = await ForumThread.find({ categoryId: category._id })
      .sort({ isPinned: -1, lastActivity: -1 })
      .limit(20)
      .lean();
    
    // Enhance threads with user info and post counts
    const threadsWithDetails = await Promise.all(threads.map(async (thread) => {
      // Get author info
      const author = await User.findById(thread.userId).lean();
      
      // Get last poster info if different from author
      let lastPoster = null;
      if (thread.lastPostUserId && thread.lastPostUserId.toString() !== thread.userId.toString()) {
        lastPoster = await User.findById(thread.lastPostUserId).lean();
      }
      
      // Count posts in thread
      const postCount = await ForumPost.countDocuments({ threadId: thread._id });
      
      return {
        id: thread._id.toString(),
        title: thread.title,
        slug: thread.slug,
        createdAt: thread.createdAt,
        lastActivity: thread.lastActivity,
        isPinned: thread.isPinned,
        isLocked: thread.isLocked,
        views: thread.views,
        author: author ? {
          id: author._id.toString(),
          username: author.username,
          profileImage: author.profileImage
        } : null,
        lastPoster: lastPoster ? {
          id: lastPoster._id.toString(),
          username: lastPoster.username,
          profileImage: lastPoster.profileImage
        } : null,
        postCount
      };
    }));
    
    res.json({
      id: category._id.toString(),
      name: category.name,
      slug: category.slug,
      description: category.description,
      threads: threadsWithDetails
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ message: 'Failed to fetch category' });
  }
});

/**
 * Create a new category (admin only)
 */
router.post('/categories', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    const { name, description, order } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Category name is required' });
    }
    
    // Generate a unique slug
    const slug = await generateUniqueSlug(name, ForumCategory);
    
    const category = new ForumCategory({
      name,
      slug,
      description: description || '',
      order: order || 0,
      createdAt: new Date()
    });
    
    await category.save();
    
    res.status(201).json({
      id: category._id.toString(),
      name: category.name,
      slug: category.slug,
      description: category.description,
      order: category.order
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ message: 'Failed to create category' });
  }
});

/**
 * Update a category (admin only)
 */
router.put('/categories/:id', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, order } = req.body;
    
    const category = await ForumCategory.findById(id);
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    // Generate a new slug only if name changed
    if (name && name !== category.name) {
      category.slug = await generateUniqueSlug(name, ForumCategory, id);
      category.name = name;
    }
    
    if (description !== undefined) {
      category.description = description;
    }
    
    if (order !== undefined) {
      category.order = order;
    }
    
    await category.save();
    
    res.json({
      id: category._id.toString(),
      name: category.name,
      slug: category.slug,
      description: category.description,
      order: category.order
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ message: 'Failed to update category' });
  }
});

/**
 * Delete a category (admin only)
 */
router.delete('/categories/:id', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const category = await ForumCategory.findById(id);
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    // Check if there are threads in this category
    const threadCount = await ForumThread.countDocuments({ categoryId: id });
    
    if (threadCount > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete category with existing threads. Move or delete the threads first.',
        threadCount
      });
    }
    
    await category.deleteOne();
    
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Failed to delete category' });
  }
});

/**
 * Get a specific thread with its posts
 */
router.get('/threads/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const thread = await ForumThread.findOne({ slug }).lean();
    
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }
    
    // Increment view count
    await ForumThread.updateOne(
      { _id: thread._id },
      { $inc: { views: 1 } }
    );
    
    // Get the category
    const category = await ForumCategory.findById(thread.categoryId).lean();
    
    // Get the author
    const author = await User.findById(thread.userId).lean();
    
    // Get posts in this thread
    const posts = await ForumPost.find({ threadId: thread._id })
      .sort({ createdAt: 1 })
      .lean();
    
    // Get info for all post authors in one batch
    const userIds = new Set(posts.map(post => post.userId.toString()));
    userIds.add(thread.userId.toString());
    
    const users = await User.find({ _id: { $in: Array.from(userIds) } }).lean();
    const userMap = new Map(users.map(user => [user._id.toString(), user]));
    
    // Enhance posts with author info
    const enhancedPosts = posts.map(post => {
      const user = userMap.get(post.userId.toString());
      
      return {
        id: post._id.toString(),
        content: post.content,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        author: user ? {
          id: user._id.toString(),
          username: user.username,
          profileImage: user.profileImage,
          role: user.role
        } : null,
        likes: post.likes || 0,
        isEdited: post.createdAt.getTime() !== post.updatedAt.getTime()
      };
    });
    
    res.json({
      id: thread._id.toString(),
      title: thread.title,
      slug: thread.slug,
      createdAt: thread.createdAt,
      lastActivity: thread.lastActivity,
      isPinned: thread.isPinned,
      isLocked: thread.isLocked,
      views: thread.views + 1, // Include the view we just added
      category: category ? {
        id: category._id.toString(),
        name: category.name,
        slug: category.slug
      } : null,
      author: author ? {
        id: author._id.toString(),
        username: author.username,
        profileImage: author.profileImage,
        role: author.role
      } : null,
      posts: enhancedPosts
    });
  } catch (error) {
    console.error('Error fetching thread:', error);
    res.status(500).json({ message: 'Failed to fetch thread' });
  }
});

/**
 * Create a new thread
 */
router.post('/threads', authenticate, async (req: Request, res: Response) => {
  try {
    const { categoryId, title, content } = req.body;
    
    if (!categoryId || !title || !content) {
      return res.status(400).json({ message: 'Category, title and content are required' });
    }
    
    // Validate category exists
    const category = await ForumCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    // Generate a unique slug
    const slug = await generateUniqueSlug(title, ForumThread);
    
    // Create the thread
    const now = new Date();
    const thread = new ForumThread({
      categoryId,
      userId: req.user.id,
      title,
      slug,
      isPinned: false,
      isLocked: false,
      views: 0,
      createdAt: now,
      lastActivity: now,
      lastPostUserId: req.user.id
    });
    
    await thread.save();
    
    // Create the first post in the thread
    const post = new ForumPost({
      threadId: thread._id,
      userId: req.user.id,
      content,
      createdAt: now,
      updatedAt: now,
      likes: 0
    });
    
    await post.save();
    
    // Get the user for response
    const user = await User.findById(req.user.id).lean();
    
    res.status(201).json({
      thread: {
        id: thread._id.toString(),
        title: thread.title,
        slug: thread.slug,
        createdAt: thread.createdAt,
        category: {
          id: category._id.toString(),
          name: category.name,
          slug: category.slug
        },
        author: {
          id: user._id.toString(),
          username: user.username,
          profileImage: user.profileImage
        }
      },
      post: {
        id: post._id.toString(),
        content: post.content,
        createdAt: post.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating thread:', error);
    res.status(500).json({ message: 'Failed to create thread' });
  }
});

/**
 * Update a thread (author or admin)
 */
router.put('/threads/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, isPinned, isLocked, categoryId } = req.body;
    
    const thread = await ForumThread.findById(id);
    
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }
    
    // Check authorization (author or admin)
    if (thread.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this thread' });
    }
    
    // Update fields
    if (title && title !== thread.title) {
      thread.title = title;
      thread.slug = await generateUniqueSlug(title, ForumThread, id);
    }
    
    // Only admins can pin, lock, or move threads
    if (req.user.role === 'admin') {
      if (isPinned !== undefined) {
        thread.isPinned = isPinned;
      }
      
      if (isLocked !== undefined) {
        thread.isLocked = isLocked;
      }
      
      if (categoryId) {
        // Verify category exists
        const categoryExists = await ForumCategory.exists({ _id: categoryId });
        if (!categoryExists) {
          return res.status(404).json({ message: 'Target category not found' });
        }
        thread.categoryId = categoryId;
      }
    }
    
    await thread.save();
    
    res.json({
      id: thread._id.toString(),
      title: thread.title,
      slug: thread.slug,
      isPinned: thread.isPinned,
      isLocked: thread.isLocked,
      categoryId: thread.categoryId.toString()
    });
  } catch (error) {
    console.error('Error updating thread:', error);
    res.status(500).json({ message: 'Failed to update thread' });
  }
});

/**
 * Delete a thread (author or admin)
 */
router.delete('/threads/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const thread = await ForumThread.findById(id);
    
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }
    
    // Check authorization (author or admin)
    if (thread.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this thread' });
    }
    
    // Delete the thread and all its posts
    await Promise.all([
      thread.deleteOne(),
      ForumPost.deleteMany({ threadId: id })
    ]);
    
    res.json({ message: 'Thread and its posts deleted successfully' });
  } catch (error) {
    console.error('Error deleting thread:', error);
    res.status(500).json({ message: 'Failed to delete thread' });
  }
});

/**
 * Add a post (reply) to a thread
 */
router.post('/posts', authenticate, async (req: Request, res: Response) => {
  try {
    const { threadId, content } = req.body;
    
    if (!threadId || !content) {
      return res.status(400).json({ message: 'Thread ID and content are required' });
    }
    
    // Validate thread exists and is not locked
    const thread = await ForumThread.findById(threadId);
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }
    
    if (thread.isLocked && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Thread is locked' });
    }
    
    // Create the post
    const now = new Date();
    const post = new ForumPost({
      threadId,
      userId: req.user.id,
      content,
      createdAt: now,
      updatedAt: now,
      likes: 0
    });
    
    await post.save();
    
    // Update the thread's last activity and last poster
    thread.lastActivity = now;
    thread.lastPostUserId = req.user.id;
    await thread.save();
    
    // Get the user for response
    const user = await User.findById(req.user.id).lean();
    
    res.status(201).json({
      id: post._id.toString(),
      content: post.content,
      createdAt: post.createdAt,
      author: {
        id: user._id.toString(),
        username: user.username,
        profileImage: user.profileImage,
        role: user.role
      },
      likes: 0,
      isEdited: false
    });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ message: 'Failed to create post' });
  }
});

/**
 * Update a post (author or admin)
 */
router.put('/posts/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ message: 'Content is required' });
    }
    
    const post = await ForumPost.findById(id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Check authorization (author or admin)
    if (post.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this post' });
    }
    
    // Check if the thread is locked
    const thread = await ForumThread.findById(post.threadId);
    if (thread && thread.isLocked && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Thread is locked' });
    }
    
    // Update the post
    post.content = content;
    post.updatedAt = new Date();
    
    await post.save();
    
    res.json({
      id: post._id.toString(),
      content: post.content,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      isEdited: post.createdAt.getTime() !== post.updatedAt.getTime()
    });
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ message: 'Failed to update post' });
  }
});

/**
 * Delete a post (author or admin)
 */
router.delete('/posts/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const post = await ForumPost.findById(id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Check authorization (author or admin)
    if (post.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }
    
    // Check if this is the only post in the thread
    const postCount = await ForumPost.countDocuments({ threadId: post.threadId });
    
    if (postCount === 1) {
      return res.status(400).json({ 
        message: 'Cannot delete the only post in a thread. Delete the thread instead.' 
      });
    }
    
    // Check if the thread is locked
    const thread = await ForumThread.findById(post.threadId);
    if (thread && thread.isLocked && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Thread is locked' });
    }
    
    // Delete the post
    await post.deleteOne();
    
    // If this was the most recent post, update the thread's last activity
    if (thread && thread.lastPostUserId.toString() === post.userId.toString()) {
      // Find the new most recent post
      const lastPost = await ForumPost.findOne({ threadId: thread._id })
        .sort({ createdAt: -1 });
      
      if (lastPost) {
        thread.lastActivity = lastPost.createdAt;
        thread.lastPostUserId = lastPost.userId;
        await thread.save();
      }
    }
    
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ message: 'Failed to delete post' });
  }
});

/**
 * Like or unlike a post
 */
router.post('/posts/:id/like', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const post = await ForumPost.findById(id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Increment likes (in a real app, you'd track who liked what)
    post.likes = (post.likes || 0) + 1;
    await post.save();
    
    res.json({
      id: post._id.toString(),
      likes: post.likes
    });
  } catch (error) {
    console.error('Error liking post:', error);
    res.status(500).json({ message: 'Failed to like post' });
  }
});

/**
 * Search threads
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { query, category } = req.query;
    
    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    // Build search conditions
    const conditions: any = {
      $or: [
        { title: { $regex: query, $options: 'i' } }
      ]
    };
    
    // Add category filter if provided
    if (category) {
      const categoryDoc = await ForumCategory.findOne({ slug: category });
      if (categoryDoc) {
        conditions.categoryId = categoryDoc._id;
      }
    }
    
    // Search for threads matching the conditions
    const threads = await ForumThread.find(conditions)
      .sort({ lastActivity: -1 })
      .limit(20)
      .lean();
    
    // Also search in post content
    const postContentQuery = { content: { $regex: query, $options: 'i' } };
    const posts = await ForumPost.find(postContentQuery)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    
    // Get unique thread IDs from the posts
    const threadIdsFromPosts = [...new Set(posts.map(post => post.threadId.toString()))];
    
    // Get those threads if they weren't already found
    const additionalThreads = await ForumThread.find({
      _id: { $in: threadIdsFromPosts },
      _id: { $nin: threads.map(t => t._id) }
    })
    .sort({ lastActivity: -1 })
    .limit(20)
    .lean();
    
    // Combine and get user info
    const allThreads = [...threads, ...additionalThreads];
    const userIds = allThreads.map(thread => thread.userId);
    const users = await User.find({ _id: { $in: userIds } }).lean();
    const userMap = new Map(users.map(user => [user._id.toString(), user]));
    
    // Get category info
    const categoryIds = allThreads.map(thread => thread.categoryId);
    const categories = await ForumCategory.find({ _id: { $in: categoryIds } }).lean();
    const categoryMap = new Map(categories.map(category => [category._id.toString(), category]));
    
    // Format the results
    const formattedThreads = allThreads.map(thread => {
      const user = userMap.get(thread.userId.toString());
      const category = categoryMap.get(thread.categoryId.toString());
      
      return {
        id: thread._id.toString(),
        title: thread.title,
        slug: thread.slug,
        createdAt: thread.createdAt,
        lastActivity: thread.lastActivity,
        views: thread.views,
        author: user ? {
          id: user._id.toString(),
          username: user.username,
          profileImage: user.profileImage
        } : null,
        category: category ? {
          id: category._id.toString(),
          name: category.name,
          slug: category.slug
        } : null
      };
    });
    
    res.json({
      query: query,
      category: category,
      results: formattedThreads,
      total: formattedThreads.length
    });
  } catch (error) {
    console.error('Error searching forum:', error);
    res.status(500).json({ message: 'Failed to search forum' });
  }
});

/**
 * Get recent activity across the forum
 */
router.get('/recent-activity', async (req: Request, res: Response) => {
  try {
    // Get recent threads
    const recentThreads = await ForumThread.find()
      .sort({ lastActivity: -1 })
      .limit(10)
      .lean();
    
    // Get user info
    const userIds = recentThreads.map(thread => thread.userId);
    userIds.push(...recentThreads.map(thread => thread.lastPostUserId));
    
    const uniqueUserIds = [...new Set(userIds.map(id => id.toString()))];
    const users = await User.find({ _id: { $in: uniqueUserIds } }).lean();
    const userMap = new Map(users.map(user => [user._id.toString(), user]));
    
    // Get category info
    const categoryIds = recentThreads.map(thread => thread.categoryId);
    const categories = await ForumCategory.find({ _id: { $in: categoryIds } }).lean();
    const categoryMap = new Map(categories.map(category => [category._id.toString(), category]));
    
    // Format the results
    const formattedActivity = recentThreads.map(thread => {
      const author = userMap.get(thread.userId.toString());
      const lastPoster = userMap.get(thread.lastPostUserId.toString());
      const category = categoryMap.get(thread.categoryId.toString());
      
      return {
        type: 'thread',
        id: thread._id.toString(),
        title: thread.title,
        slug: thread.slug,
        createdAt: thread.createdAt,
        lastActivity: thread.lastActivity,
        views: thread.views,
        author: author ? {
          id: author._id.toString(),
          username: author.username,
          profileImage: author.profileImage
        } : null,
        lastPoster: lastPoster ? {
          id: lastPoster._id.toString(),
          username: lastPoster.username,
          profileImage: lastPoster.profileImage
        } : null,
        category: category ? {
          id: category._id.toString(),
          name: category.name,
          slug: category.slug
        } : null
      };
    });
    
    res.json(formattedActivity);
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ message: 'Failed to fetch recent activity' });
  }
});

export default router;