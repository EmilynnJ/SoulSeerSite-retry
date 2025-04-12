/**
 * Forum routes for PostgreSQL
 */

import express, { Request, Response, NextFunction } from 'express';
import { IStorage } from '../storage';
import slugify from 'slugify';

// Export a function that creates and configures the forum router
export function createForumRouter(storage: IStorage) {
  const router = express.Router();

  // Middleware to authenticate users
  const authenticate = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'You must be logged in to perform this action' });
    }
    next();
  };

  // Middleware for admin-only routes
  const adminOnly = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'This action requires admin privileges' });
    }
    next();
  };

  /**
   * Get all forum categories
   */
  router.get('/categories', async (req: Request, res: Response) => {
    try {
      const categories = await storage.getForumCategories();
      
      // Count threads in each category and format response
      const categoriesWithCounts = await Promise.all(categories.map(async (category) => {
        const threads = await storage.getForumThreadsByCategory(category.id);
        
        return {
          ...category,
          threadCount: threads.length
        };
      }));
      
      res.json(categoriesWithCounts);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ message: 'Failed to fetch categories' });
    }
  });

  /**
   * Get a specific category by ID with its threads
   */
  router.get('/categories/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid category ID' });
      }
      
      const category = await storage.getForumCategory(id);
      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }
      
      // Get threads in this category
      const threads = await storage.getForumThreadsByCategory(id);
      
      // Get users who created the threads
      const userIds = Array.from(new Set(threads.map(thread => thread.userId)));
      const users = await Promise.all(userIds.map(userId => storage.getUser(userId)));
      const userMap = new Map(users.filter(Boolean).map(user => [user!.id, user]));
      
      // Format threads with user info
      const threadsWithDetails = threads.map(thread => {
        const author = userMap.get(thread.userId);
        
        return {
          ...thread,
          author: author ? {
            id: author.id,
            username: author.username,
            profileImage: author.profileImage
          } : null
        };
      });
      
      res.json({
        ...category,
        threads: threadsWithDetails
      });
    } catch (error) {
      console.error('Error fetching category:', error);
      res.status(500).json({ message: 'Failed to fetch category' });
    }
  });

  /**
   * Create a new forum category (admin only)
   */
  router.post('/categories', adminOnly, async (req: Request, res: Response) => {
    try {
      const { name, description } = req.body;
      
      if (!name || !description) {
        return res.status(400).json({ message: 'Name and description are required' });
      }
      
      const slug = slugify(name, { lower: true });
      
      const category = await storage.createForumCategory({
        name,
        description,
        slug
      });
      
      res.status(201).json(category);
    } catch (error) {
      console.error('Error creating category:', error);
      res.status(500).json({ message: 'Failed to create category' });
    }
  });

  /**
   * Create a new thread in a category
   */
  router.post('/threads', authenticate, async (req: Request, res: Response) => {
    try {
      const { categoryId, title, content } = req.body;
      
      if (!categoryId || !title || !content) {
        return res.status(400).json({ message: 'Category ID, title, and content are required' });
      }
      
      // Validate category exists
      const category = await storage.getForumCategory(categoryId);
      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }
      
      // Create thread with slug
      const slug = slugify(title, { lower: true });
      
      const thread = await storage.createForumThread({
        categoryId,
        userId: req.user.id,
        title,
        content,
        slug,
        isPinned: false,
        isLocked: false,
        views: 0
      });
      
      res.status(201).json(thread);
    } catch (error) {
      console.error('Error creating thread:', error);
      res.status(500).json({ message: 'Failed to create thread' });
    }
  });

  /**
   * Get a specific thread with its posts
   */
  router.get('/threads/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid thread ID' });
      }
      
      const thread = await storage.getForumThread(id);
      if (!thread) {
        return res.status(404).json({ message: 'Thread not found' });
      }
      
      // Increment view count
      await storage.updateForumThread(id, { views: thread.views + 1 });
      
      // Get posts in this thread
      const posts = await storage.getForumPostsByThread(id);
      
      // Get users who created the posts
      const userIds = Array.from(new Set(posts.map(post => post.userId)));
      userIds.push(thread.userId); // Add thread author
      
      const users = await Promise.all(userIds.map(userId => storage.getUser(userId)));
      const userMap = new Map(users.filter(Boolean).map(user => [user!.id, user]));
      
      // Format thread with author info
      const author = userMap.get(thread.userId);
      const threadWithAuthor = {
        ...thread,
        author: author ? {
          id: author.id,
          username: author.username,
          profileImage: author.profileImage
        } : null
      };
      
      // Format posts with user info
      const postsWithUsers = posts.map(post => {
        const author = userMap.get(post.userId);
        
        return {
          ...post,
          author: author ? {
            id: author.id,
            username: author.username,
            profileImage: author.profileImage
          } : null
        };
      });
      
      res.json({
        ...threadWithAuthor,
        posts: postsWithUsers
      });
    } catch (error) {
      console.error('Error fetching thread:', error);
      res.status(500).json({ message: 'Failed to fetch thread' });
    }
  });

  /**
   * Create a new post in a thread
   */
  router.post('/threads/:id/posts', authenticate, async (req: Request, res: Response) => {
    try {
      const threadId = parseInt(req.params.id);
      if (isNaN(threadId)) {
        return res.status(400).json({ message: 'Invalid thread ID' });
      }
      
      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ message: 'Content is required' });
      }
      
      // Validate thread exists and is not locked
      const thread = await storage.getForumThread(threadId);
      if (!thread) {
        return res.status(404).json({ message: 'Thread not found' });
      }
      
      if (thread.isLocked) {
        return res.status(403).json({ message: 'This thread is locked and cannot receive new posts' });
      }
      
      // Create post
      const post = await storage.createForumPost({
        threadId,
        userId: req.user.id,
        content
      });
      
      // Update thread's timestamp to reflect latest activity
      await storage.updateForumThread(threadId, {});
      
      // Get author
      const author = await storage.getUser(req.user.id);
      
      res.status(201).json({
        ...post,
        author: author ? {
          id: author.id,
          username: author.username,
          profileImage: author.profileImage
        } : null
      });
    } catch (error) {
      console.error('Error creating post:', error);
      res.status(500).json({ message: 'Failed to create post' });
    }
  });

  /**
   * Get recent threads across all categories
   */
  router.get('/recent', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      
      // Get all threads, sort by last activity, and limit
      const threads = await storage.getForumThreads();
      const sortedThreads = threads.sort((a, b) => 
        new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      ).slice(0, limit);
      
      // Get category info
      const categoryIds = Array.from(new Set(sortedThreads.map(thread => thread.categoryId)));
      const categories = await Promise.all(categoryIds.map(id => storage.getForumCategory(id)));
      const categoryMap = new Map(categories.filter(Boolean).map(category => [category!.id, category]));
      
      // Get user info
      const userIds = Array.from(new Set(sortedThreads.map(thread => thread.userId)));
      const users = await Promise.all(userIds.map(id => storage.getUser(id)));
      const userMap = new Map(users.filter(Boolean).map(user => [user!.id, user]));
      
      // Format the results
      const formattedThreads = sortedThreads.map(thread => {
        const author = userMap.get(thread.userId);
        const category = categoryMap.get(thread.categoryId);
        
        return {
          ...thread,
          category: category ? {
            id: category.id,
            name: category.name,
            slug: category.slug
          } : null,
          author: author ? {
            id: author.id,
            username: author.username,
            profileImage: author.profileImage
          } : null
        };
      });
      
      res.json(formattedThreads);
    } catch (error) {
      console.error('Error fetching recent threads:', error);
      res.status(500).json({ message: 'Failed to fetch recent threads' });
    }
  });

  /**
   * Pin/unpin a thread (admin only)
   */
  router.patch('/threads/:id/pin', adminOnly, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid thread ID' });
      }
      
      const thread = await storage.getForumThread(id);
      if (!thread) {
        return res.status(404).json({ message: 'Thread not found' });
      }
      
      const updatedThread = await storage.updateForumThread(id, {
        isPinned: !thread.isPinned
      });
      
      res.json(updatedThread);
    } catch (error) {
      console.error('Error updating thread pin status:', error);
      res.status(500).json({ message: 'Failed to update thread' });
    }
  });

  /**
   * Lock/unlock a thread (admin only)
   */
  router.patch('/threads/:id/lock', adminOnly, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid thread ID' });
      }
      
      const thread = await storage.getForumThread(id);
      if (!thread) {
        return res.status(404).json({ message: 'Thread not found' });
      }
      
      const updatedThread = await storage.updateForumThread(id, {
        isLocked: !thread.isLocked
      });
      
      res.json(updatedThread);
    } catch (error) {
      console.error('Error updating thread lock status:', error);
      res.status(500).json({ message: 'Failed to update thread' });
    }
  });

  /**
   * Delete a thread (admin or thread creator only)
   */
  router.delete('/threads/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid thread ID' });
      }
      
      const thread = await storage.getForumThread(id);
      if (!thread) {
        return res.status(404).json({ message: 'Thread not found' });
      }
      
      // Check permissions - admin or thread creator
      if (req.user.role !== 'admin' && thread.userId !== req.user.id) {
        return res.status(403).json({ message: 'You do not have permission to delete this thread' });
      }
      
      // Delete thread's posts first
      // Note: In a real application, we might want to use transactions for this
      await storage.deleteForumPostsByThread(id);
      
      // Delete the thread
      await storage.deleteForumThread(id);
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting thread:', error);
      res.status(500).json({ message: 'Failed to delete thread' });
    }
  });

  /**
   * Delete a post (admin or post creator only)
   */
  router.delete('/posts/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid post ID' });
      }
      
      const post = await storage.getForumPost(id);
      if (!post) {
        return res.status(404).json({ message: 'Post not found' });
      }
      
      // Check permissions - admin or post creator
      if (req.user.role !== 'admin' && post.userId !== req.user.id) {
        return res.status(403).json({ message: 'You do not have permission to delete this post' });
      }
      
      // Delete the post
      await storage.deleteForumPost(id);
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting post:', error);
      res.status(500).json({ message: 'Failed to delete post' });
    }
  });

  return router;
}