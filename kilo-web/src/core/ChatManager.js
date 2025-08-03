/**
 * ChatManager - Enhanced conversation management for kilo-web
 * Inspired by kilocode's ClineProvider conversation system
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class ChatManager {
  constructor(workspaceDir) {
    this.workspaceDir = workspaceDir;
    this.conversationsDir = path.join(workspaceDir, '.kilo', 'conversations');
    this.currentConversationId = null;
    this.messages = [];
    this.contextFiles = new Set();
    this.taskStack = [];
    this.messageSender = null;
    
    this.ensureDirectories();
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.conversationsDir, { recursive: true });
    } catch (error) {
      console.error('Error creating conversations directory:', error);
    }
  }

  setWebSocketSender(sender) {
    this.messageSender = sender;
  }

  generateConversationId() {
    return crypto.randomUUID();
  }

  async createNewConversation(initialMessage = null, mode = 'code') {
    const conversationId = this.generateConversationId();
    const conversation = {
      id: conversationId,
      created: Date.now(),
      lastModified: Date.now(),
      mode: mode,
      messages: initialMessage ? [{
        id: crypto.randomUUID(),
        type: 'user',
        text: initialMessage,
        timestamp: Date.now(),
        mode: mode
      }] : [],
      contextFiles: [],
      taskStack: [],
      metadata: {
        totalMessages: initialMessage ? 1 : 0,
        tokensUsed: 0,
        lastActivity: Date.now()
      }
    };

    await this.saveConversation(conversation);
    this.currentConversationId = conversationId;
    this.messages = conversation.messages;
    this.contextFiles = new Set(conversation.contextFiles);
    this.taskStack = conversation.taskStack;

    return conversation;
  }

  async loadConversation(conversationId) {
    try {
      const conversationPath = path.join(this.conversationsDir, `${conversationId}.json`);
      const data = await fs.readFile(conversationPath, 'utf8');
      const conversation = JSON.parse(data);
      
      this.currentConversationId = conversationId;
      this.messages = conversation.messages || [];
      this.contextFiles = new Set(conversation.contextFiles || []);
      this.taskStack = conversation.taskStack || [];

      // Send updated state to WebSocket
      if (this.messageSender) {
        this.messageSender({
          type: 'state',
          state: {
            clineMessages: this.messages,
            currentConversationId: conversationId
          }
        });
      }

      return conversation;
    } catch (error) {
      console.error('Error loading conversation:', error);
      throw new Error(`Failed to load conversation: ${error.message}`);
    }
  }

  async saveConversation(conversation = null) {
    if (!conversation && !this.currentConversationId) {
      return;
    }

    const conversationToSave = conversation || {
      id: this.currentConversationId,
      created: this.created || Date.now(),
      lastModified: Date.now(),
      mode: this.currentMode || 'code',
      messages: this.messages,
      contextFiles: Array.from(this.contextFiles),
      taskStack: this.taskStack,
      metadata: {
        totalMessages: this.messages.length,
        tokensUsed: this.calculateTokens(),
        lastActivity: Date.now()
      }
    };

    try {
      const conversationPath = path.join(this.conversationsDir, `${conversationToSave.id}.json`);
      await fs.writeFile(conversationPath, JSON.stringify(conversationToSave, null, 2));
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  }

  async addMessage(type, text, options = {}) {
    const message = {
      id: crypto.randomUUID(),
      type: type,
      text: text,
      timestamp: Date.now(),
      mode: options.mode || 'code',
      partial: options.partial || false,
      metadata: {
        tokensEstimate: this.estimateTokens(text),
        contextFiles: options.contextFiles || [],
        toolsUsed: options.toolsUsed || []
      }
    };

    if (options.partial) {
      // Handle streaming message
      if (this.messageSender) {
        this.messageSender({
          type: 'cline_message',
          data: message
        });
      }
      return message;
    }

    this.messages.push(message);
    await this.saveConversation();

    // Send to WebSocket
    if (this.messageSender) {
      this.messageSender({
        type: 'cline_message',
        data: message
      });
    }

    return message;
  }

  async editMessage(messageId, newText) {
    const messageIndex = this.messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) {
      throw new Error('Message not found');
    }

    // Store original for undo capability
    const originalMessage = { ...this.messages[messageIndex] };
    
    this.messages[messageIndex] = {
      ...this.messages[messageIndex],
      text: newText,
      lastModified: Date.now(),
      editHistory: [
        ...(this.messages[messageIndex].editHistory || []),
        {
          previousText: originalMessage.text,
          editedAt: Date.now()
        }
      ]
    };

    await this.saveConversation();

    // Send updated state
    if (this.messageSender) {
      this.messageSender({
        type: 'messageEdited',
        data: {
          messageId: messageId,
          newText: newText,
          message: this.messages[messageIndex]
        }
      });
    }

    return this.messages[messageIndex];
  }

  async deleteMessage(messageId) {
    const messageIndex = this.messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) {
      throw new Error('Message not found');
    }

    const deletedMessage = this.messages.splice(messageIndex, 1)[0];
    await this.saveConversation();

    // Send updated state
    if (this.messageSender) {
      this.messageSender({
        type: 'messageDeleted',
        data: {
          messageId: messageId,
          deletedMessage: deletedMessage
        }
      });
    }

    return deletedMessage;
  }

  async clearConversation() {
    this.messages = [];
    this.contextFiles.clear();
    this.taskStack = [];
    
    if (this.currentConversationId) {
      await this.saveConversation();
    }

    if (this.messageSender) {
      this.messageSender({
        type: 'conversationCleared',
        data: { conversationId: this.currentConversationId }
      });
    }
  }

  async getConversationHistory() {
    try {
      const files = await fs.readdir(this.conversationsDir);
      const conversations = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(this.conversationsDir, file);
            const data = await fs.readFile(filePath, 'utf8');
            const conversation = JSON.parse(data);
            
            // Add summary info only
            conversations.push({
              id: conversation.id,
              created: conversation.created,
              lastModified: conversation.lastModified,
              mode: conversation.mode,
              messageCount: conversation.messages?.length || 0,
              preview: this.getConversationPreview(conversation.messages),
              metadata: conversation.metadata
            });
          } catch (error) {
            console.error(`Error reading conversation file ${file}:`, error);
          }
        }
      }

      return conversations.sort((a, b) => b.lastModified - a.lastModified);
    } catch (error) {
      console.error('Error getting conversation history:', error);
      return [];
    }
  }

  getConversationPreview(messages) {
    if (!messages || messages.length === 0) {
      return 'Empty conversation';
    }

    const firstUserMessage = messages.find(msg => msg.type === 'user');
    if (firstUserMessage) {
      return firstUserMessage.text.substring(0, 100) + (firstUserMessage.text.length > 100 ? '...' : '');
    }

    return 'No user messages';
  }

  addContextFile(filePath) {
    this.contextFiles.add(filePath);
  }

  removeContextFile(filePath) {
    this.contextFiles.delete(filePath);
  }

  getContextFiles() {
    return Array.from(this.contextFiles);
  }

  pushTask(taskInfo) {
    this.taskStack.push({
      ...taskInfo,
      startedAt: Date.now(),
      id: crypto.randomUUID()
    });
  }

  popTask() {
    return this.taskStack.pop();
  }

  getCurrentTask() {
    return this.taskStack[this.taskStack.length - 1] || null;
  }

  estimateTokens(text) {
    // Simple token estimation (roughly 4 characters per token)
    return Math.ceil(text.length / 4);
  }

  calculateTokens() {
    return this.messages.reduce((total, msg) => total + this.estimateTokens(msg.text), 0);
  }

  async condenseConversation(maxTokens = 8000) {
    const currentTokens = this.calculateTokens();
    
    if (currentTokens <= maxTokens) {
      return false; // No condensing needed
    }

    // Keep system messages, recent messages, and important context
    const systemMessages = this.messages.filter(msg => msg.type === 'system');
    const recentMessages = this.messages.slice(-10); // Keep last 10 messages
    const importantMessages = this.messages.filter(msg => 
      msg.metadata?.important || 
      msg.metadata?.toolsUsed?.length > 0
    );

    // Create condensed conversation
    const condensedMessages = [
      ...systemMessages,
      {
        id: crypto.randomUUID(),
        type: 'system',
        text: `[Previous conversation condensed - ${this.messages.length - recentMessages.length} messages summarized]`,
        timestamp: Date.now(),
        metadata: { condensed: true }
      },
      ...importantMessages.slice(-5), // Keep last 5 important messages
      ...recentMessages
    ];

    // Remove duplicates
    const uniqueMessages = condensedMessages.filter((msg, index, arr) => 
      arr.findIndex(m => m.id === msg.id) === index
    );

    this.messages = uniqueMessages;
    await this.saveConversation();

    return true; // Condensing performed
  }

  getCurrentState() {
    return {
      conversationId: this.currentConversationId,
      messageCount: this.messages.length,
      contextFiles: Array.from(this.contextFiles),
      taskStack: this.taskStack,
      tokenCount: this.calculateTokens(),
      lastActivity: this.messages.length > 0 ? this.messages[this.messages.length - 1].timestamp : null
    };
  }
}

module.exports = ChatManager;