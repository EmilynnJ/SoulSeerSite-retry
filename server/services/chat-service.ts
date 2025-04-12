import { Server as HttpServer } from 'http';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { log } from '../server-only';
import { Session, User } from '../mongodb';

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
  clients: Map<string, WebSocket>;
  messages: ChatMessage[];
}

class ChatService {
  private wss: WebSocket.Server | null = null;
  private rooms: Map<string, ChatRoom> = new Map();
  private clientRooms: Map<string, string> = new Map(); // clientId -> roomId mapping

  public initialize(server: HttpServer): void {
    log('Initializing chat WebSocket service');
    
    // Create WebSocket server
    this.wss = new WebSocket.Server({ 
      server,
      path: '/ws/chat'
    });
    
    this.wss.on('connection', this.handleConnection.bind(this));
    
    log('Chat WebSocket service initialized');
  }
  
  private async handleConnection(ws: WebSocket, request: any): Promise<void> {
    try {
      // Extract room ID from the URL
      const url = new URL(request.url, `http://${request.headers.host}`);
      const pathname = url.pathname;
      const pathParts = pathname.split('/');
      let roomId = pathParts[pathParts.length - 1];
      
      if (!roomId || roomId === 'chat') {
        // No room ID provided
        this.sendError(ws, 'Invalid room ID');
        return;
      }
      
      log(`New chat WebSocket connection for room: ${roomId}`);
      
      // Set up message handler for this connection
      ws.on('message', async (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString()) as ChatMessage;
          
          if (message.type === 'join') {
            // Handle client joining a room
            await this.handleJoin(ws, message, roomId);
          } else if (message.type === 'message') {
            // Handle new message
            await this.handleMessage(ws, message, roomId);
          } else if (message.type === 'leave') {
            // Handle client leaving a room
            this.handleLeave(message, roomId);
          }
        } catch (error) {
          log(`Error processing chat message: ${error}`, 'error');
          this.sendError(ws, 'Failed to process message');
        }
      });
      
      // Handle disconnection
      ws.on('close', () => {
        log(`WebSocket connection closed for room: ${roomId}`);
        // Find client ID for this connection and remove from room
        const room = this.getRoom(roomId);
        if (room) {
          for (const [clientId, clientWs] of room.clients.entries()) {
            if (clientWs === ws) {
              this.removeClientFromRoom(clientId, roomId);
              break;
            }
          }
        }
      });
    } catch (error) {
      log(`Error handling WebSocket connection: ${error}`, 'error');
      this.sendError(ws, 'Connection error');
    }
  }
  
  private async handleJoin(ws: WebSocket, message: ChatMessage, roomId: string): Promise<void> {
    try {
      const { sessionId, userId, userName } = message;
      
      if (!sessionId || !userId || !userName) {
        this.sendError(ws, 'Missing required fields');
        return;
      }
      
      // Verify the session exists and is active
      const session = await Session.findById(sessionId);
      if (!session) {
        this.sendError(ws, 'Invalid session');
        return;
      }
      
      // Verify the user is part of this session
      if (!session.clientId.equals(userId) && !session.readerId.equals(userId)) {
        this.sendError(ws, 'User not authorized for this session');
        return;
      }
      
      // Get room or create if not exists
      const room = this.getRoom(roomId) || this.createRoom(roomId, sessionId);
      
      // Add client to room
      room.clients.set(userId, ws);
      this.clientRooms.set(userId, roomId);
      
      // Send message history to the client
      this.sendMessageHistory(ws, room);
      
      // Send system message to all clients in the room
      this.broadcastSystemMessage(roomId, `${userName} has joined the chat`);
      
      log(`User ${userName} (${userId}) joined chat room ${roomId}`);
    } catch (error) {
      log(`Error handling join message: ${error}`, 'error');
      this.sendError(ws, 'Failed to join chat room');
    }
  }
  
  private async handleMessage(ws: WebSocket, message: ChatMessage, roomId: string): Promise<void> {
    try {
      const { sessionId, senderId, senderName, content } = message;
      
      if (!sessionId || !senderId || !senderName || !content) {
        this.sendError(ws, 'Missing required fields');
        return;
      }
      
      // Get the room
      const room = this.getRoom(roomId);
      if (!room) {
        this.sendError(ws, 'Room not found');
        return;
      }
      
      // Create a new message
      const newMessage: ChatMessage = {
        type: 'message',
        id: message.id || uuidv4(),
        sessionId,
        senderId,
        senderName,
        senderAvatar: message.senderAvatar,
        content,
        timestamp: message.timestamp || new Date().toISOString()
      };
      
      // Store the message
      room.messages.push(newMessage);
      
      // Broadcast to all clients in the room
      this.broadcastMessage(roomId, newMessage);
      
      // Log message
      log(`Chat message sent in room ${roomId} by ${senderName} (${senderId})`);
    } catch (error) {
      log(`Error handling chat message: ${error}`, 'error');
      this.sendError(ws, 'Failed to send message');
    }
  }
  
  private handleLeave(message: ChatMessage, roomId: string): void {
    try {
      const { senderId, senderName } = message;
      
      if (!senderId || !senderName) {
        return;
      }
      
      // Remove client from room
      this.removeClientFromRoom(senderId, roomId);
      
      // Send system message to all clients in the room
      this.broadcastSystemMessage(roomId, `${senderName} has left the chat`);
      
      log(`User ${senderName} (${senderId}) left chat room ${roomId}`);
    } catch (error) {
      log(`Error handling leave message: ${error}`, 'error');
    }
  }
  
  private createRoom(roomId: string, sessionId: string): ChatRoom {
    const room: ChatRoom = {
      id: roomId,
      sessionId,
      clients: new Map(),
      messages: []
    };
    
    this.rooms.set(roomId, room);
    log(`Created new chat room: ${roomId} for session: ${sessionId}`);
    
    return room;
  }
  
  private getRoom(roomId: string): ChatRoom | undefined {
    return this.rooms.get(roomId);
  }
  
  private removeClientFromRoom(clientId: string, roomId: string): void {
    const room = this.getRoom(roomId);
    
    if (room) {
      room.clients.delete(clientId);
      this.clientRooms.delete(clientId);
      
      // If room is empty, remove it
      if (room.clients.size === 0) {
        this.rooms.delete(roomId);
        log(`Removed empty chat room: ${roomId}`);
      }
    }
  }
  
  private sendMessageHistory(ws: WebSocket, room: ChatRoom): void {
    const historyMessage: ChatMessage = {
      type: 'history',
      messages: room.messages
    };
    
    ws.send(JSON.stringify(historyMessage));
  }
  
  private broadcastMessage(roomId: string, message: ChatMessage): void {
    const room = this.getRoom(roomId);
    
    if (room) {
      const messageStr = JSON.stringify(message);
      
      room.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(messageStr);
        }
      });
    }
  }
  
  private broadcastSystemMessage(roomId: string, content: string): void {
    const message: ChatMessage = {
      type: 'system',
      content,
      timestamp: new Date().toISOString()
    };
    
    this.broadcastMessage(roomId, message);
  }
  
  private sendError(ws: WebSocket, content: string): void {
    const errorMessage: ChatMessage = {
      type: 'error',
      content,
      timestamp: new Date().toISOString()
    };
    
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(errorMessage));
    }
  }
}

export const chatService = new ChatService();