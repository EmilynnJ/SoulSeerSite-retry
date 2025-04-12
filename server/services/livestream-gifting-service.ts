import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { log } from '../server-only';
import { v4 as uuidv4 } from 'uuid';
import { 
  Livestream, 
  User, 
  updateById, 
  insertOne, 
  findById, 
  find 
} from '../mongodb';
import { webRTCService } from './webrtc-service';

interface LivestreamMessage {
  id: string;
  userId: string;
  username: string;
  userAvatar?: string;
  content: string;
  timestamp: Date;
  isGift?: boolean;
  giftValue?: number;
  giftType?: string;
}

interface Gift {
  id: string;
  name: string;
  value: number;
  icon: string;
}

class LivestreamGiftingService {
  private io: SocketIOServer | null = null;
  private messageHistory: Map<string, LivestreamMessage[]> = new Map();
  private viewerCounts: Map<string, Set<string>> = new Map(); // livestreamId -> Set of userIds
  private availableGifts: Gift[] = [
    {
      id: 'gift-1',
      name: 'Crystal Ball',
      value: 100, // $1.00
      icon: '🔮'
    },
    {
      id: 'gift-2',
      name: 'Energy Boost',
      value: 200, // $2.00
      icon: '✨'
    },
    {
      id: 'gift-3',
      name: 'Celestial Star',
      value: 500, // $5.00
      icon: '⭐'
    },
    {
      id: 'gift-4',
      name: 'Spiritual Rose',
      value: 1000, // $10.00
      icon: '🌹'
    }
  ];

  public initialize(server: HttpServer): void {
    log('Initializing Livestream Gifting Service');
    
    try {
      // Check if the WebRTC service has already initialized Socket.IO
      if (webRTCService.getIO()) {
        log('Using existing Socket.IO instance from WebRTC service');
        this.io = webRTCService.getIO();
      } else {
        // Initialize Socket.IO server if not already done
        this.io = new SocketIOServer(server, {
          cors: {
            origin: '*',
            methods: ['GET', 'POST']
          }
        });
        log('Created new Socket.IO instance for Livestream Gifting Service');
      }
      
      // Create a namespace for livestreams
      const livestreamNamespace = this.io.of('/livestream');
      
      livestreamNamespace.on('connection', (socket) => {
        this.handleConnection(socket);
      });
      
      log('Livestream Gifting Service initialized successfully');
    } catch (error) {
      log(`Failed to initialize Livestream Gifting Service: ${error}`, 'error');
      throw error;
    }
  }
  
  private handleConnection(socket: any): void {
    log(`New Livestream socket connection: ${socket.id}`);
    
    // Handle joining a livestream
    socket.on('join', async (data: any) => {
      try {
        const { livestreamId, userId, username } = data;
        
        if (!livestreamId) {
          socket.emit('error', { message: 'Livestream ID is required' });
          return;
        }
        
        // Join the socket to the livestream room
        socket.join(livestreamId);
        
        // Add to viewer count if authenticated
        if (userId && username) {
          this.addViewer(livestreamId, userId);
          
          // Send viewer count to all clients in the livestream
          this.io?.of('/livestream').to(livestreamId).emit('viewers', {
            count: this.getViewerCount(livestreamId)
          });
          
          // Send a system message about the new viewer
          const joinMessage = {
            id: uuidv4(),
            type: 'system',
            content: `${username} joined the livestream`,
            timestamp: new Date()
          };
          
          socket.to(livestreamId).emit('message', joinMessage);
          
          // Send message history to the new viewer
          const messages = this.getMessageHistory(livestreamId);
          socket.emit('history', { messages });
          
          log(`User ${username} (${userId}) joined livestream ${livestreamId}`);
        }
        
        // Store livestream ID and user ID in socket data for later use
        socket.data.livestreamId = livestreamId;
        socket.data.userId = userId;
        socket.data.username = username;
      } catch (error) {
        log(`Error handling join: ${error}`, 'error');
        socket.emit('error', { message: 'Failed to join livestream' });
      }
    });
    
    // Handle chat messages
    socket.on('message', async (data: any) => {
      try {
        const { content } = data;
        const { livestreamId, userId, username } = socket.data;
        
        if (!livestreamId || !userId || !username || !content) {
          socket.emit('error', { message: 'Missing required fields' });
          return;
        }
        
        // Create message object
        const message: LivestreamMessage = {
          id: uuidv4(),
          userId,
          username,
          userAvatar: data.userAvatar,
          content,
          timestamp: new Date(),
          isGift: false
        };
        
        // Store message in history
        this.addMessageToHistory(livestreamId, message);
        
        // Broadcast message to all clients in the livestream
        this.io?.of('/livestream').to(livestreamId).emit('message', message);
        
        log(`Chat message sent in livestream ${livestreamId} by ${username}`);
      } catch (error) {
        log(`Error handling message: ${error}`, 'error');
        socket.emit('error', { message: 'Failed to send message' });
      }
    });
    
    // Handle sending gifts
    socket.on('gift', async (data: any) => {
      try {
        const { giftId, amount } = data;
        const { livestreamId, userId, username } = socket.data;
        
        if (!livestreamId || !userId || !username || !giftId) {
          socket.emit('error', { message: 'Missing required fields' });
          return;
        }
        
        // Find the gift
        const gift = this.availableGifts.find(g => g.id === giftId);
        if (!gift) {
          socket.emit('error', { message: 'Invalid gift' });
          return;
        }
        
        // Find the livestream and user
        const livestream = await findById('Livestream', livestreamId);
        const user = await findById('User', userId);
        
        if (!livestream || !user) {
          socket.emit('error', { message: 'Livestream or user not found' });
          return;
        }
        
        // Create a gift transaction record
        const giftTransaction = {
          id: uuidv4(),
          livestreamId,
          senderId: userId,
          senderName: username,
          receiverId: livestream.userId,
          receiverName: livestream.userName || 'Reader',
          giftId,
          giftName: gift.name,
          amount: gift.value,
          timestamp: new Date()
        };
        
        // Save the gift transaction to the database
        await insertOne('GiftTransaction', giftTransaction);
        
        // Update livestream earnings
        const currentEarnings = livestream.earnings || 0;
        await updateById('Livestream', livestreamId, {
          earnings: currentEarnings + gift.value
        });
        
        // Create gift message
        const giftMessage: LivestreamMessage = {
          id: uuidv4(),
          userId,
          username,
          userAvatar: user.profileImage,
          content: `Sent a ${gift.name}!`,
          timestamp: new Date(),
          isGift: true,
          giftValue: gift.value,
          giftType: giftId
        };
        
        // Store message in history
        this.addMessageToHistory(livestreamId, giftMessage);
        
        // Broadcast gift message to all clients in the livestream
        this.io?.of('/livestream').to(livestreamId).emit('message', giftMessage);
        
        // Send special gift event for animations
        this.io?.of('/livestream').to(livestreamId).emit('gift', {
          userId,
          username,
          giftId,
          giftName: gift.name,
          giftValue: gift.value,
          giftIcon: gift.icon
        });
        
        log(`Gift sent in livestream ${livestreamId} by ${username}: ${gift.name} ($${gift.value / 100})`);
        
        // Send confirmation to the sender
        socket.emit('giftConfirmation', {
          success: true,
          giftId,
          giftName: gift.name,
          amount: gift.value
        });
      } catch (error) {
        log(`Error handling gift: ${error}`, 'error');
        socket.emit('error', { message: 'Failed to send gift' });
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      try {
        const { livestreamId, userId, username } = socket.data;
        
        if (livestreamId && userId) {
          // Remove from viewer count
          this.removeViewer(livestreamId, userId);
          
          // Send updated viewer count
          this.io?.of('/livestream').to(livestreamId).emit('viewers', {
            count: this.getViewerCount(livestreamId)
          });
          
          // Send a system message about the viewer leaving
          if (username) {
            const leaveMessage = {
              id: uuidv4(),
              type: 'system',
              content: `${username} left the livestream`,
              timestamp: new Date()
            };
            
            this.io?.of('/livestream').to(livestreamId).emit('message', leaveMessage);
            
            log(`User ${username} (${userId}) left livestream ${livestreamId}`);
          }
        }
      } catch (error) {
        log(`Error handling disconnect: ${error}`, 'error');
      }
    });
  }
  
  private addViewer(livestreamId: string, userId: string): void {
    if (!this.viewerCounts.has(livestreamId)) {
      this.viewerCounts.set(livestreamId, new Set());
    }
    
    this.viewerCounts.get(livestreamId)?.add(userId);
  }
  
  private removeViewer(livestreamId: string, userId: string): void {
    this.viewerCounts.get(livestreamId)?.delete(userId);
    
    // Clean up if no viewers
    if (this.viewerCounts.get(livestreamId)?.size === 0) {
      this.viewerCounts.delete(livestreamId);
    }
  }
  
  private getViewerCount(livestreamId: string): number {
    return this.viewerCounts.get(livestreamId)?.size || 0;
  }
  
  private addMessageToHistory(livestreamId: string, message: LivestreamMessage): void {
    if (!this.messageHistory.has(livestreamId)) {
      this.messageHistory.set(livestreamId, []);
    }
    
    const messages = this.messageHistory.get(livestreamId);
    if (messages) {
      // Limit history to 100 messages
      if (messages.length >= 100) {
        messages.shift(); // Remove oldest message
      }
      
      messages.push(message);
    }
  }
  
  private getMessageHistory(livestreamId: string): LivestreamMessage[] {
    return this.messageHistory.get(livestreamId) || [];
  }
  
  public getAvailableGifts(): Gift[] {
    return this.availableGifts;
  }
}

export const livestreamGiftingService = new LivestreamGiftingService();