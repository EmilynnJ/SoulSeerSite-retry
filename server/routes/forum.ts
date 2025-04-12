import express, { Request, Response, NextFunction } from 'express';
import * as mongodb from '../mongodb';
import { log } from '../server-only';
import slugify from 'slugify';

const router = express.Router();

// Authentication middleware
const authenticate = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Admin-only middleware
const adminOnly = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Helper function to generate unique slugs
async function generateUniqueSlug(title: string, model: any, existingId?: string): Promise<string> {
  let slug = slugify(title, { lower: true, strict: true });
  let isUnique = false;
  let counter = 1;

  while (!isUnique) {
    const query = existingId 
      ? { slug, _id: { $ne: existingId } }
      : { slug };
    
    const existing = await model.findOne(query);
    
    if (!existing) {
      isUnique = true;
    } else {
      slug = `${slugify(title, { lower: true, strict: true })}-${counter}`;
      counter++;
    }
  }

  return slug;
}

/**
 * Get all forum categories
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories = await mongodb.ForumCategory.find({ isActive: true })
      .sort({ order: 1 })
      .lean();
    
    return res.status(200).json(categories);
  } catch (error: any) {
    log(`Error fetching forum categories: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to fetch forum categories', details: error.message });
  }
});

/**
 * Get a specific category by slug with recent threads
 */
router.get('/categories/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const category = await mongodb.ForumCategory.findOne({ slug }).lean();
    
    if (!category) {
      return res.status(404).json({ error: 'Forum category not found' });
    }
    
    // Get threads for this category, sorted by last activity
    const threads = await mongodb.ForumThread.find({ categoryId: category._id })
      .sort({ isStickied: -1, lastPostAt: -1 })
      .limit(20)
      .lean();
    
    // Get user information for thread creators and last posters
    const userIds = new Set<string>();
    
    threads.forEach(thread => {
      userIds.add(thread.userId.toString());
      if (thread.lastPostUserId) {
        userIds.add(thread.lastPostUserId.toString());
      }
    });
    
    const users = await mongodb.User.find({ _id: { $in: Array.from(userIds) } })
      .select('_id username profileImage fullName')
      .lean();
    
    const usersMap = users.reduce((map, user) => {
      map[user._id.toString()] = user;
      return map;
    }, {} as Record<string, any>);
    
    const threadsWithUsers = threads.map(thread => ({
      ...thread,
      author: usersMap[thread.userId.toString()],
      lastPoster: thread.lastPostUserId ? usersMap[thread.lastPostUserId.toString()] : null
    }));
    
    return res.status(200).json({
      category,
      threads: threadsWithUsers
    });
  } catch (error: any) {
    log(`Error fetching forum category: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to fetch forum category', details: error.message });
  }
});

/**
 * Create a new category (admin only)
 */
router.post('/categories', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    const { name, description, icon, order } = req.body;
    
    if (!name || !description) {
      return res.status(400).json({ error: 'Name and description are required' });
    }
    
    const slug = await generateUniqueSlug(name, mongodb.ForumCategory);
    
    const category = await mongodb.ForumCategory.create({
      name,
      description,
      slug,
      icon,
      order: order || 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    return res.status(201).json(category);
  } catch (error: any) {
    log(`Error creating forum category: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to create forum category', details: error.message });
  }
});

/**
 * Update a category (admin only)
 */
router.put('/categories/:id', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, icon, order, isActive } = req.body;
    
    const category = await mongodb.ForumCategory.findById(id);
    
    if (!category) {
      return res.status(404).json({ error: 'Forum category not found' });
    }
    
    // Only regenerate slug if name changed
    let slug = category.slug;
    if (name && name !== category.name) {
      slug = await generateUniqueSlug(name, mongodb.ForumCategory, id);
    }
    
    const updatedCategory = await mongodb.ForumCategory.findByIdAndUpdate(
      id,
      {
        name: name || category.name,
        description: description || category.description,
        slug,
        icon: icon !== undefined ? icon : category.icon,
        order: order !== undefined ? order : category.order,
        isActive: isActive !== undefined ? isActive : category.isActive,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    return res.status(200).json(updatedCategory);
  } catch (error: any) {
    log(`Error updating forum category: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to update forum category', details: error.message });
  }
});

/**
 * Delete a category (admin only)
 */
router.delete('/categories/:id', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if there are threads in this category
    const threadCount = await mongodb.ForumThread.countDocuments({ categoryId: id });
    
    if (threadCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete category with existing threads', 
        threadCount 
      });
    }
    
    const category = await mongodb.ForumCategory.findByIdAndDelete(id);
    
    if (!category) {
      return res.status(404).json({ error: 'Forum category not found' });
    }
    
    return res.status(200).json({ success: true, message: 'Category deleted successfully' });
  } catch (error: any) {
    log(`Error deleting forum category: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to delete forum category', details: error.message });
  }
});

/**
 * Get a specific thread with its posts
 */
router.get('/threads/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.perPage as string) || 20;
    
    const thread = await mongodb.ForumThread.findOne({ slug }).lean();
    
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }
    
    // Increment view count
    await mongodb.ForumThread.updateOne(
      { _id: thread._id },
      { $inc: { viewCount: 1 } }
    );
    
    // Get the category for this thread
    const category = await mongodb.ForumCategory.findById(thread.categoryId).lean();
    
    // Get posts for this thread with pagination
    const totalPosts = await mongodb.ForumPost.countDocuments({ threadId: thread._id });
    const totalPages = Math.ceil(totalPosts / perPage);
    
    const posts = await mongodb.ForumPost.find({ threadId: thread._id })
      .sort({ createdAt: 1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .lean();
    
    // Get all user IDs mentioned in the thread and posts
    const userIds = new Set<string>();
    userIds.add(thread.userId.toString());
    
    if (thread.lastPostUserId) {
      userIds.add(thread.lastPostUserId.toString());
    }
    
    posts.forEach(post => {
      userIds.add(post.userId.toString());
    });
    
    // Fetch user information
    const users = await mongodb.User.find({ _id: { $in: Array.from(userIds) } })
      .select('_id username profileImage fullName role createdAt')
      .lean();
    
    const usersMap = users.reduce((map, user) => {
      map[user._id.toString()] = user;
      return map;
    }, {} as Record<string, any>);
    
    // Attach user information to each post
    const postsWithUsers = posts.map(post => ({
      ...post,
      user: usersMap[post.userId.toString()]
    }));
    
    return res.status(200).json({
      thread: {
        ...thread,
        author: usersMap[thread.userId.toString()]
      },
      category,
      posts: postsWithUsers,
      pagination: {
        page,
        perPage,
        totalPosts,
        totalPages
      }
    });
  } catch (error: any) {
    log(`Error fetching thread: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to fetch thread', details: error.message });
  }
});

/**
 * Create a new thread
 */
router.post('/threads', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { title, content, categoryId, tags } = req.body;
    
    if (!title || !content || !categoryId) {
      return res.status(400).json({ error: 'Title, content and categoryId are required' });
    }
    
    // Verify category exists
    const category = await mongodb.ForumCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({ error: 'Forum category not found' });
    }
    
    const slug = await generateUniqueSlug(title, mongodb.ForumThread);
    
    const thread = await mongodb.ForumThread.create({
      title,
      slug,
      content, // The first post's content is also stored with the thread for SEO/preview
      userId: req.user.id,
      categoryId,
      isStickied: false,
      isLocked: false,
      viewCount: 0,
      lastPostAt: new Date(),
      lastPostUserId: req.user.id,
      tags: tags || [],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Also create the initial post in this thread
    const post = await mongodb.ForumPost.create({
      threadId: thread._id,
      userId: req.user.id,
      content,
      isEdited: false,
      likes: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    return res.status(201).json({ thread, post });
  } catch (error: any) {
    log(`Error creating thread: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to create thread', details: error.message });
  }
});

/**
 * Update a thread (author or admin)
 */
router.put('/threads/:id', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { id } = req.params;
    const { title, content, tags, isStickied, isLocked } = req.body;
    
    const thread = await mongodb.ForumThread.findById(id);
    
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }
    
    // Check permission - only thread author or admin can update
    const isAuthor = thread.userId.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to update this thread' });
    }
    
    // Regular users can only update title, content and tags
    // Admins can additionally update isStickied and isLocked
    const updates: any = { updatedAt: new Date() };
    
    if (title && (isAuthor || isAdmin)) {
      updates.title = title;
      
      // Update slug if title changed
      if (title !== thread.title) {
        updates.slug = await generateUniqueSlug(title, mongodb.ForumThread, id);
      }
    }
    
    if (content && (isAuthor || isAdmin)) {
      updates.content = content;
      
      // Also update the first post's content
      const firstPost = await mongodb.ForumPost.findOne({ threadId: id }).sort({ createdAt: 1 });
      if (firstPost) {
        await mongodb.ForumPost.updateOne(
          { _id: firstPost._id },
          { 
            content,
            isEdited: true,
            editedAt: new Date(),
            updatedAt: new Date()
          }
        );
      }
    }
    
    if (tags && (isAuthor || isAdmin)) {
      updates.tags = tags;
    }
    
    // Admin-only updates
    if (isAdmin) {
      if (isStickied !== undefined) updates.isStickied = isStickied;
      if (isLocked !== undefined) updates.isLocked = isLocked;
    }
    
    const updatedThread = await mongodb.ForumThread.findByIdAndUpdate(
      id,
      updates,
      { new: true }
    );
    
    return res.status(200).json(updatedThread);
  } catch (error: any) {
    log(`Error updating thread: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to update thread', details: error.message });
  }
});

/**
 * Delete a thread (author or admin)
 */
router.delete('/threads/:id', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { id } = req.params;
    
    const thread = await mongodb.ForumThread.findById(id);
    
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }
    
    // Check permission - only thread author or admin can delete
    const isAuthor = thread.userId.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to delete this thread' });
    }
    
    // Delete all posts in this thread
    await mongodb.ForumPost.deleteMany({ threadId: id });
    
    // Delete the thread
    await mongodb.ForumThread.findByIdAndDelete(id);
    
    return res.status(200).json({ success: true, message: 'Thread and all associated posts deleted successfully' });
  } catch (error: any) {
    log(`Error deleting thread: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to delete thread', details: error.message });
  }
});

/**
 * Add a post (reply) to a thread
 */
router.post('/posts', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { threadId, content } = req.body;
    
    if (!threadId || !content) {
      return res.status(400).json({ error: 'ThreadId and content are required' });
    }
    
    // Verify thread exists and is not locked
    const thread = await mongodb.ForumThread.findById(threadId);
    
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }
    
    if (thread.isLocked) {
      return res.status(403).json({ error: 'This thread is locked and cannot receive new replies' });
    }
    
    const post = await mongodb.ForumPost.create({
      threadId,
      userId: req.user.id,
      content,
      isEdited: false,
      likes: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Update thread's lastPostAt and lastPostUserId
    await mongodb.ForumThread.updateOne(
      { _id: threadId },
      { 
        lastPostAt: new Date(),
        lastPostUserId: req.user.id
      }
    );
    
    // Get user info for the post
    const user = await mongodb.User.findById(req.user.id)
      .select('_id username profileImage fullName role')
      .lean();
    
    return res.status(201).json({
      ...post.toObject(),
      user
    });
  } catch (error: any) {
    log(`Error creating post: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to create post', details: error.message });
  }
});

/**
 * Update a post (author or admin)
 */
router.put('/posts/:id', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { id } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    const post = await mongodb.ForumPost.findById(id);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Check permission - only post author or admin can update
    const isAuthor = post.userId.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to update this post' });
    }
    
    const updatedPost = await mongodb.ForumPost.findByIdAndUpdate(
      id,
      {
        content,
        isEdited: true,
        editedAt: new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );
    
    // If this is the first post in the thread, update thread content too
    const thread = await mongodb.ForumThread.findById(post.threadId);
    const firstPost = await mongodb.ForumPost.findOne({ threadId: post.threadId }).sort({ createdAt: 1 });
    
    if (thread && firstPost && firstPost._id.toString() === id) {
      await mongodb.ForumThread.updateOne(
        { _id: post.threadId },
        { content }
      );
    }
    
    // Get user info for the post
    const user = await mongodb.User.findById(post.userId)
      .select('_id username profileImage fullName role')
      .lean();
    
    return res.status(200).json({
      ...updatedPost?.toObject(),
      user
    });
  } catch (error: any) {
    log(`Error updating post: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to update post', details: error.message });
  }
});

/**
 * Delete a post (author or admin)
 */
router.delete('/posts/:id', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { id } = req.params;
    
    const post = await mongodb.ForumPost.findById(id);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Check permission - only post author or admin can delete
    const isAuthor = post.userId.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to delete this post' });
    }
    
    // Check if this is the only post in the thread
    const postCount = await mongodb.ForumPost.countDocuments({ threadId: post.threadId });
    
    if (postCount === 1) {
      // If this is the only post, delete the thread too
      await mongodb.ForumThread.deleteOne({ _id: post.threadId });
    } else {
      // Update thread's lastPostAt and lastPostUserId to the latest remaining post
      const latestPost = await mongodb.ForumPost.findOne({ threadId: post.threadId, _id: { $ne: id } })
        .sort({ createdAt: -1 });
        
      if (latestPost) {
        await mongodb.ForumThread.updateOne(
          { _id: post.threadId },
          { 
            lastPostAt: latestPost.createdAt,
            lastPostUserId: latestPost.userId
          }
        );
      }
    }
    
    // Delete the post
    await mongodb.ForumPost.deleteOne({ _id: id });
    
    return res.status(200).json({ 
      success: true, 
      message: postCount === 1 
        ? 'Post and associated thread deleted successfully' 
        : 'Post deleted successfully',
      threadDeleted: postCount === 1
    });
  } catch (error: any) {
    log(`Error deleting post: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to delete post', details: error.message });
  }
});

/**
 * Like or unlike a post
 */
router.post('/posts/:id/like', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { id } = req.params;
    
    const post = await mongodb.ForumPost.findById(id);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    const userId = req.user.id;
    const userIdObj = userId;
    
    // Check if user already liked this post
    const alreadyLiked = post.likes.some(id => id.toString() === userId);
    
    let updatedPost;
    
    if (alreadyLiked) {
      // Remove like
      updatedPost = await mongodb.ForumPost.findByIdAndUpdate(
        id,
        { $pull: { likes: userIdObj } },
        { new: true }
      );
    } else {
      // Add like
      updatedPost = await mongodb.ForumPost.findByIdAndUpdate(
        id,
        { $addToSet: { likes: userIdObj } },
        { new: true }
      );
    }
    
    return res.status(200).json({ 
      success: true,
      action: alreadyLiked ? 'unliked' : 'liked',
      likes: updatedPost?.likes.length || 0
    });
  } catch (error: any) {
    log(`Error liking/unliking post: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to process like action', details: error.message });
  }
});

/**
 * Search threads
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { query, category } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.perPage as string) || 20;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const searchFilter: any = {
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { content: { $regex: query, $options: 'i' } },
        { tags: { $in: [query] } }
      ]
    };
    
    // Add category filter if provided
    if (category) {
      searchFilter.categoryId = category;
    }
    
    // Count total results
    const totalThreads = await mongodb.ForumThread.countDocuments(searchFilter);
    const totalPages = Math.ceil(totalThreads / perPage);
    
    // Fetch threads
    const threads = await mongodb.ForumThread.find(searchFilter)
      .sort({ lastPostAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .lean();
    
    // Get category info for each thread
    const categoryIds = threads.map(thread => thread.categoryId);
    const categories = await mongodb.ForumCategory.find({ _id: { $in: categoryIds } }).lean();
    
    const categoriesMap = categories.reduce((map, category) => {
      map[category._id.toString()] = category;
      return map;
    }, {} as Record<string, any>);
    
    // Get user info for thread authors
    const userIds = threads.map(thread => thread.userId);
    const users = await mongodb.User.find({ _id: { $in: userIds } })
      .select('_id username profileImage fullName')
      .lean();
    
    const usersMap = users.reduce((map, user) => {
      map[user._id.toString()] = user;
      return map;
    }, {} as Record<string, any>);
    
    // Build result with thread, category, and author info
    const results = threads.map(thread => ({
      ...thread,
      category: categoriesMap[thread.categoryId.toString()],
      author: usersMap[thread.userId.toString()]
    }));
    
    return res.status(200).json({
      results,
      pagination: {
        page,
        perPage,
        totalThreads,
        totalPages
      }
    });
  } catch (error: any) {
    log(`Error searching threads: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to search threads', details: error.message });
  }
});

/**
 * Get recent activity across the forum
 */
router.get('/recent-activity', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    
    // Get most recently active threads
    const threads = await mongodb.ForumThread.find()
      .sort({ lastPostAt: -1 })
      .limit(limit)
      .lean();
    
    // Get category info
    const categoryIds = threads.map(thread => thread.categoryId);
    const categories = await mongodb.ForumCategory.find({ _id: { $in: categoryIds } }).lean();
    
    const categoriesMap = categories.reduce((map, category) => {
      map[category._id.toString()] = category;
      return map;
    }, {} as Record<string, any>);
    
    // Get user info
    const userIds = new Set<string>();
    
    threads.forEach(thread => {
      userIds.add(thread.userId.toString());
      if (thread.lastPostUserId) {
        userIds.add(thread.lastPostUserId.toString());
      }
    });
    
    const users = await mongodb.User.find({ _id: { $in: Array.from(userIds) } })
      .select('_id username profileImage fullName')
      .lean();
    
    const usersMap = users.reduce((map, user) => {
      map[user._id.toString()] = user;
      return map;
    }, {} as Record<string, any>);
    
    // Format response
    const formattedThreads = threads.map(thread => ({
      ...thread,
      category: categoriesMap[thread.categoryId.toString()],
      author: usersMap[thread.userId.toString()],
      lastPoster: thread.lastPostUserId ? usersMap[thread.lastPostUserId.toString()] : null
    }));
    
    return res.status(200).json(formattedThreads);
  } catch (error: any) {
    log(`Error fetching recent forum activity: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to fetch recent activity', details: error.message });
  }
});

export default router;