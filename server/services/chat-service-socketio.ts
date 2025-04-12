import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { log } from '../server-only';
import { Session, User } from '../mongodb';
import { webRTCService } from './webrtc-service';

interface ChatMessage {
  type: 'message' | 'system' | 'history' | 'join' | 'leave' | 'error';
  id?: string;
  sessionId?: string;
  roomId?: string;
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
  content?: string;
  timestamp?: string;
  messages?: ChatMessage[];
  // Additional fields for join messages
  userId?: string;
  userName?: string;
}

interface ChatRoom {
  id: string;
  sessionId: string;
  messages: ChatMessage[];
}

class ChatService {
  private io: SocketIOServer | null = null;
  private rooms: Map<string, ChatRoom> = new Map();
  
  public initialize(server: HttpServer): void {
    log('Initializing Chat Service with Socket.IO');
    
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
        log('Created new Socket.IO instance for Chat Service');
      }
      
      // Create a namespace for chat
      const chatNamespace = this.io.of('/chat');
      
      chatNamespace.on('connection', (socket: Socket) => {
        this.handleConnection(socket);
      });
      
      log('Chat Service initialized successfully');
    } catch (error) {
      log(`Failed to initialize Chat Service: ${error}`, 'error');
      throw error;
    }
  }
  
  private handleConnection(socket: Socket): void {
    log(`New Chat socket connection: ${socket.id}`);
    
    // Handle joining a chat room
    socket.on('join', async (data: any) => {
      try {
        const { roomId, sessionId, userId, userName } = data;
        
        if (!roomId || !sessionId || !userId || !userName) {
          socket.emit('error', { message: 'Missing required fields' });
          return;
        }
        
        // Verify the session exists and is active
        const session = await Session.findById(sessionId);
        if (!session) {
          socket.emit('error', { message: 'Invalid session' });
          return;
        }
        
        // Verify the user is part of this session
        if (!session.clientId.equals(userId) && !session.readerId.equals(userId)) {
          socket.emit('error', { message: 'User not authorized for this session' });
          return;
        }
        
        // Join the socket to the room
        socket.join(roomId);
        
        // Get or create the room
        const room = this.getRoom(roomId) || this.createRoom(roomId, sessionId);
        
        // Send message history to the client
        socket.emit('history', { messages: room.messages });
        
        // Send a system message about the new user
        const joinMessage: ChatMessage = {
          type: 'system',
          content: `${userName} has joined the chat`,
          timestamp: new Date().toISOString()
        };
        
        this.io?.of('/chat').to(roomId).emit('message', joinMessage);
        
        // Store room ID and user info in socket data for later use
        socket.data.roomId = roomId;
        socket.data.userId = userId;
        socket.data.userName = userName;
        socket.data.sessionId = sessionId;
        
        log(`User ${userName} (${userId}) joined chat room ${roomId}`);
      } catch (error) {
        log(`Error handling join: ${error}`, 'error');
        socket.emit('error', { message: 'Failed to join chat room' });
      }
    });
    
    // Handle chat messages
    socket.on('message', async (data: any) => {
      try {
        const { content } = data;
        const { roomId, userId, userName, sessionId } = socket.data;
        
        if (!roomId || !userId || !userName || !sessionId || !content) {
          socket.emit('error', { message: 'Missing required fields' });
          return;
        }
        
        // Get the room
        const room = this.getRoom(roomId);
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }
        
        // Create a new message
        const newMessage: ChatMessage = {
          type: 'message',
          id: uuidv4(),
          sessionId,
          roomId,
          senderId: userId,
          senderName: userName,
          senderAvatar: data.senderAvatar,
          content,
          timestamp: new Date().toISOString()
        };
        
        // Store the message
        room.messages.push(newMessage);
        
        // Trim message history if needed
        if (room.messages.length > 100) {
          room.messages.shift(); // Remove oldest message
        }
        
        // Broadcast to all clients in the room
        this.io?.of('/chat').to(roomId).emit('message', newMessage);
        
        log(`Chat message sent in room ${roomId} by ${userName} (${userId})`);
      } catch (error) {
        log(`Error handling message: ${error}`, 'error');
        socket.emit('error', { message: 'Failed to send message' });
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      try {
        const { roomId, userId, userName } = socket.data;
        
        if (roomId && userName) {
          // Send a system message about the user leaving
          const leaveMessage: ChatMessage = {
            type: 'system',
            content: `${userName} has left the chat`,
            timestamp: new Date().toISOString()
          };
          
          this.io?.of('/chat').to(roomId).emit('message', leaveMessage);
          
          log(`User ${userName} (${userId}) left chat room ${roomId}`);
        }
      } catch (error) {
        log(`Error handling disconnect: ${error}`, 'error');
      }
    });
  }
  
  private createRoom(roomId: string, sessionId: string): ChatRoom {
    const room: ChatRoom = {
      id: roomId,
      sessionId,
      messages: []
    };
    
    this.rooms.set(roomId, room);
    log(`Created new chat room: ${roomId} for session: ${sessionId}`);
    
    return room;
  }
  
  private getRoom(roomId: string): ChatRoom | undefined {
    return this.rooms.get(roomId);
  }
}

export const chatService = new ChatService();