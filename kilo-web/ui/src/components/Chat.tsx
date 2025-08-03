import React, { useState, useEffect, useRef } from 'react';
import Settings from './Settings';
import ModeSelector from './ModeSelector';
import './Chat.css';

interface ChatMessage {
  id?: string;
  type: 'user' | 'assistant';
  text: string;
  timestamp: number;
  partial?: boolean;
  mode?: string;
  metadata?: {
    tokensEstimate?: number;
    contextFiles?: string[];
    toolsUsed?: string[];
    important?: boolean;
  };
  editHistory?: Array<{
    previousText: string;
    editedAt: number;
  }>;
  lastModified?: number;
}

interface ConversationHistoryItem {
  id: string;
  created: number;
  lastModified: number;
  mode: string;
  messageCount: number;
  preview: string;
  metadata?: {
    totalMessages: number;
    tokensUsed: number;
    lastActivity: number;
  };
}

interface ModeInfo {
  slug: string;
  name: string;
  description: string;
  icon: string;
}

interface ChatProps {
  webSocket: WebSocket | null;
  isConnected: boolean;
}

const Chat: React.FC<ChatProps> = ({ webSocket, isConnected }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [streamEnabled, setStreamEnabled] = useState(true);
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  const [currentMode, setCurrentMode] = useState<ModeInfo>({
    slug: 'code',
    name: 'Code',
    description: 'Write, modify, and refactor code',
    icon: '💻'
  });
  const [availableModes, setAvailableModes] = useState<ModeInfo[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ConversationHistoryItem[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [, setContextFiles] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  useEffect(() => {
    if (webSocket) {
      const handleMessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'state' && data.state?.clineMessages) {
            const clineMessages = data.state.clineMessages.filter((msg: any) =>
              !msg.partial && msg.type in ['user', 'assistant'] && msg.text
            ).map((msg: any) => ({
              id: msg.id,
              type: msg.type,
              text: msg.text,
              timestamp: msg.timestamp,
              mode: msg.mode || currentMode.slug,
              metadata: msg.metadata,
              editHistory: msg.editHistory,
              lastModified: msg.lastModified
            }));
            setMessages(clineMessages);
            setStreamingMessage(null);
            setIsLoading(false);
            
            // Set conversation state
            if (data.state.currentConversationId) {
              setCurrentConversationId(data.state.currentConversationId);
            }
            if (data.state.contextFiles) {
              setContextFiles(data.state.contextFiles);
            }
          } else if (data.type === 'cline_message' && data.data) {
            const msg = data.data;
            if (msg.partial) {
              // Handle streaming message
              setStreamingMessage({
                id: msg.id,
                type: msg.type,
                text: msg.text,
                timestamp: msg.timestamp,
                partial: true,
                mode: msg.mode || currentMode.slug,
                metadata: msg.metadata
              });
            } else {
              // Handle complete message
              setMessages(prev => [...prev, {
                id: msg.id,
                type: msg.type,
                text: msg.text,
                timestamp: msg.timestamp,
                mode: msg.mode || currentMode.slug,
                metadata: msg.metadata,
                editHistory: msg.editHistory,
                lastModified: msg.lastModified
              }]);
              setStreamingMessage(null);
              setIsLoading(false);
            }
          } else if (data.type === 'messageEdited' && data.data) {
            // Handle message edit
            setMessages(prev => prev.map(msg =>
              msg.id === data.data.messageId
                ? { ...msg, text: data.data.newText, lastModified: data.data.message.lastModified, editHistory: data.data.message.editHistory }
                : msg
            ));
            setEditingMessageId(null);
            setEditingText('');
          } else if (data.type === 'messageDeleted' && data.data) {
            // Handle message deletion
            setMessages(prev => prev.filter(msg => msg.id !== data.data.messageId));
          } else if (data.type === 'conversationHistory' && data.data) {
            // Handle conversation history
            setConversationHistory(data.data);
          } else if (data.type === 'conversationCleared') {
            // Handle conversation clear
            setMessages([]);
            setStreamingMessage(null);
            setCurrentConversationId(null);
            setContextFiles([]);
          } else if (data.type === 'messageComplete') {
            // Final message when streaming is complete
            setStreamingMessage(null);
            setIsLoading(false);
          } else if (data.type === 'modeChanged' && data.data) {
            // Handle mode change notifications
            setCurrentMode({
              slug: data.data.slug,
              name: data.data.name,
              description: data.data.description,
              icon: data.data.icon || '🤖'
            });
          } else if (data.type === 'modesAvailable' && data.data) {
            // Handle available modes list
            setAvailableModes(data.data);
          } else if (data.type === 'providerChanged') {
            console.log('AI provider changed:', data.data?.provider);
          } else if (data.type === 'error') {
            console.error('WebSocket error:', data.message);
            setIsLoading(false);
            setStreamingMessage(null);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      webSocket.addEventListener('message', handleMessage);
      
      return () => {
        webSocket.removeEventListener('message', handleMessage);
      };
    }
  }, [webSocket, currentMode.slug]);

  // Request initial mode and available modes when connected
  useEffect(() => {
    if (webSocket && isConnected) {
      webSocket.send(JSON.stringify({
        type: 'getModes'
      }));
      webSocket.send(JSON.stringify({
        type: 'getCurrentMode'
      }));
    }
  }, [webSocket, isConnected]);

  const sendMessage = () => {
    if (!input.trim() || !isConnected || isLoading) return;

    const messageType = streamEnabled ? 'streamingMessage' : 'newTask';
    
    webSocket?.send(JSON.stringify({
      type: messageType,
      text: input.trim(),
      mode: currentMode.slug
    }));
    
    setInput('');
    setIsLoading(true);
    setStreamingMessage(null);
  };

  const handleModeSwitch = (modeSlug: string, reason?: string) => {
    if (!webSocket || !isConnected) return;
    
    webSocket.send(JSON.stringify({
      type: 'switchMode',
      mode: modeSlug,
      reason: reason
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearHistory = () => {
    setMessages([]);
    setStreamingMessage(null);
    setCurrentConversationId(null);
    setContextFiles([]);
    // Send clear command to backend
    if (webSocket && isConnected) {
      webSocket.send(JSON.stringify({
        type: 'clearTask'
      }));
    }
  };

  const startEditMessage = (messageId: string, currentText: string) => {
    setEditingMessageId(messageId);
    setEditingText(currentText);
  };

  const saveEditMessage = () => {
    if (!editingMessageId || !editingText.trim()) return;
    
    if (webSocket && isConnected) {
      webSocket.send(JSON.stringify({
        type: 'editMessage',
        messageId: editingMessageId,
        newText: editingText.trim()
      }));
    }
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  const deleteMessage = (messageId: string) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      if (webSocket && isConnected) {
        webSocket.send(JSON.stringify({
          type: 'deleteMessage',
          messageId: messageId
        }));
      }
    }
  };

  const loadConversationHistory = () => {
    if (webSocket && isConnected) {
      webSocket.send(JSON.stringify({
        type: 'getConversationHistory'
      }));
    }
    setShowHistory(true);
  };

  const loadConversation = (conversationId: string) => {
    if (webSocket && isConnected) {
      webSocket.send(JSON.stringify({
        type: 'loadConversation',
        conversationId: conversationId
      }));
    }
    setShowHistory(false);
  };

  const createNewConversation = () => {
    clearHistory();
    setShowHistory(false);
  };

  const formatMessage = (content: string) => {
    // Basic markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>');
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>Kilo Code Assistant</h2>
        <div className="chat-controls">
          <label className="stream-toggle">
            <input
              type="checkbox"
              checked={streamEnabled}
              onChange={(e) => setStreamEnabled(e.target.checked)}
            />
            Streaming
          </label>
          <button
            onClick={loadConversationHistory}
            className="history-button"
            title="Conversation History"
          >
            📚 History
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="settings-button"
            title="AI Provider Settings"
          >
            ⚙️
          </button>
          <button
            onClick={clearHistory}
            className="clear-button"
            title="Clear chat history"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Conversation History Modal */}
      {showHistory && (
        <div className="history-modal">
          <div className="history-modal-content">
            <div className="history-header">
              <h3>Conversation History</h3>
              <button onClick={() => setShowHistory(false)} className="close-button">×</button>
            </div>
            <div className="history-list">
              <button
                onClick={createNewConversation}
                className="new-conversation-button"
              >
                + New Conversation
              </button>
              {conversationHistory.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`history-item ${conversation.id === currentConversationId ? 'active' : ''}`}
                  onClick={() => loadConversation(conversation.id)}
                >
                  <div className="history-item-header">
                    <span className="history-mode">{conversation.mode}</span>
                    <span className="history-date">
                      {new Date(conversation.lastModified).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="history-preview">{conversation.preview}</div>
                  <div className="history-meta">
                    {conversation.messageCount} messages • {conversation.metadata?.tokensUsed || 0} tokens
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <ModeSelector
        currentMode={currentMode.slug}
        modes={availableModes}
        onModeChange={handleModeSwitch}
      />
      
      <div className="messages-container">
        {messages.map((message, index) => (
          <div
            key={message.id || `${message.timestamp}-${index}`}
            className={`message ${message.type}`}
          >
            {editingMessageId === message.id ? (
              <div className="message-edit">
                <textarea
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  className="edit-textarea"
                  rows={3}
                />
                <div className="edit-actions">
                  <button onClick={saveEditMessage} className="save-edit-btn">Save</button>
                  <button onClick={cancelEditMessage} className="cancel-edit-btn">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="message-content">
                  <div
                    dangerouslySetInnerHTML={{
                      __html: formatMessage(message.text)
                    }}
                  />
                </div>
                <div className="message-meta">
                  <div className="message-left-meta">
                    <div className="message-time">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                    {message.mode && (
                      <div className="message-mode" title={`Mode: ${message.mode}`}>
                        {message.mode}
                      </div>
                    )}
                    {message.lastModified && (
                      <div className="message-edited" title="Message was edited">
                        (edited)
                      </div>
                    )}
                  </div>
                  {message.id && (
                    <div className="message-actions">
                      <button
                        onClick={() => startEditMessage(message.id!, message.text)}
                        className="edit-message-btn"
                        title="Edit message"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteMessage(message.id!)}
                        className="delete-message-btn"
                        title="Delete message"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
        
        {streamingMessage && (
          <div className="message assistant streaming">
            <div className="message-content">
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: formatMessage(streamingMessage.text) 
                }}
              />
              <span className="streaming-indicator">▋</span>
            </div>
          </div>
        )}
        
        {isLoading && !streamingMessage && (
          <div className="message assistant loading">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="input-container">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={isConnected ? "Type your message..." : "Connecting..."}
          disabled={!isConnected || isLoading}
          rows={1}
        />
        <button 
          onClick={sendMessage} 
          disabled={!isConnected || !input.trim() || isLoading}
          className="send-button"
        >
          Send
        </button>
      </div>

      <Settings 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
};

export default Chat;