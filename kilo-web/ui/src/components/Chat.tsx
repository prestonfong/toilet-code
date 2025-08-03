import React, { useState, useEffect, useRef } from 'react';
import Settings from './Settings';
import './Chat.css';

interface ChatMessage {
  type: 'user' | 'assistant';
  text: string;
  timestamp: number;
  partial?: boolean;
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
              type: msg.type,
              text: msg.text,
              timestamp: msg.timestamp
            }));
            setMessages(clineMessages);
            setStreamingMessage(null);
            setIsLoading(false);
          } else if (data.type === 'cline_message' && data.data) {
            const msg = data.data;
            if (msg.partial) {
              // Handle streaming message
              setStreamingMessage({
                type: msg.type,
                text: msg.text,
                timestamp: msg.timestamp,
                partial: true
              });
            } else {
              // Handle complete message
              setMessages(prev => [...prev, {
                type: msg.type,
                text: msg.text,
                timestamp: msg.timestamp
              }]);
              setStreamingMessage(null);
              setIsLoading(false);
            }
          } else if (data.type === 'messageComplete') {
            // Final message when streaming is complete
            setStreamingMessage(null);
            setIsLoading(false);
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
  }, [webSocket]);

  const sendMessage = () => {
    if (!input.trim() || !isConnected || isLoading) return;

    const messageType = streamEnabled ? 'streamingMessage' : 'newTask';
    
    webSocket?.send(JSON.stringify({
      type: messageType,
      text: input.trim()
    }));
    
    setInput('');
    setIsLoading(true);
    setStreamingMessage(null);
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
    // Send clear command to backend
    if (webSocket && isConnected) {
      webSocket.send(JSON.stringify({
        type: 'clearTask'
      }));
    }
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
      
      <div className="messages-container">
        {messages.map((message, index) => (
          <div 
            key={`${message.timestamp}-${index}`} 
            className={`message ${message.type}`}
          >
            <div className="message-content">
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: formatMessage(message.text) 
                }}
              />
            </div>
            <div className="message-time">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
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