import React, { useState, useEffect, useRef } from 'react';
import { kiloClient, KiloState } from './utils/webClient';
import { Terminal } from './components/Terminal';
import { EnhancedFileExplorer } from './components/EnhancedFileExplorer';
import ComprehensiveSettingsPanel from './components/ComprehensiveSettingsPanel';
import ModeSelector from './components/ModeSelector';
import WorkflowManager from './components/WorkflowManager';
import IOSPWADetector from './components/IOSPWADetector';
import { Mode, DEFAULT_MODES } from './types/modes';
import pushNotificationService from './utils/pushNotificationService';
import './App.css';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'error';
  content: string;
  timestamp: Date;
  isThinking?: boolean;
}

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
}

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [currentState, setCurrentState] = useState<KiloState | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'files' | 'terminal' | 'workflows'>('chat');
  const [activeTerminal] = useState<string>('main');
  const [currentMode, setCurrentMode] = useState<Mode>(DEFAULT_MODES[1]); // Default to 'code' mode
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initializeConnection();
    initializePushNotifications();
    return () => {
      kiloClient.disconnect();
      pushNotificationService.destroy();
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initializeConnection = async () => {
    try {
      await kiloClient.connect();
      setIsConnected(true);
      
      // Set up message handlers
      kiloClient.on('state', handleStateUpdate);
      kiloClient.on('messageResponse', handleMessageResponse);
      kiloClient.on('thinking', handleThinking);
      kiloClient.on('error', handleError);
      kiloClient.on('fileList', handleFileList);
      kiloClient.on('taskStarted', handleTaskStarted);
      kiloClient.on('apiProviderSet', handleApiProviderSet);
      kiloClient.on('modeChanged', handleModeChanged);
      kiloClient.on('currentMode', handleCurrentMode);
      
      // Request initial state
      await kiloClient.requestState();
      await loadFiles();
    } catch (error) {
      console.error('Failed to connect:', error);
      addSystemMessage(`Failed to connect to server: ${error}`);
    }
  };

  const initializePushNotifications = async () => {
    try {
      const initialized = await pushNotificationService.initialize();
      if (initialized) {
        console.log('✅ Push notification service initialized');
        
        // Set up event listeners
        pushNotificationService.on('error', (data) => {
          console.error('Push notification error:', data);
          addSystemMessage(`Push notification error: ${data.error}`, 'error');
        });

        pushNotificationService.on('subscriptionChanged', (data) => {
          const status = data.subscribed ? 'enabled' : 'disabled';
          addSystemMessage(`Push notifications ${status}`, 'system');
        });

        pushNotificationService.on('notificationEvent', (data) => {
          console.log('Notification event:', data);
        });

        pushNotificationService.on('updateAvailable', () => {
          addSystemMessage('App update available. Refresh to update.', 'system');
        });
      } else {
        console.warn('⚠️ Push notifications not available');
      }
    } catch (error) {
      console.error('❌ Failed to initialize push notifications:', error);
    }
  };

  const handleStateUpdate = (data: { state: KiloState }) => {
    setCurrentState(data.state);
    
    // Update messages from state
    if (data.state.clineMessages) {
      const convertedMessages: Message[] = data.state.clineMessages.map((msg: any, index: number) => ({
        id: `${msg.ts || Date.now()}-${index}`,
        type: msg.type === 'ask' ? 'user' : 'assistant',
        content: msg.text || '',
        timestamp: new Date(msg.ts || Date.now())
      }));
      setMessages(convertedMessages);
    }
  };

  const handleMessageResponse = (data: { message: any }) => {
    const message: Message = {
      id: `${Date.now()}-response`,
      type: 'assistant',
      content: data.message.text || '',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, message]);
    setIsThinking(false);
  };

  const handleThinking = (data: { isThinking: boolean }) => {
    setIsThinking(data.isThinking);
  };

  const handleError = (data: { error: string }) => {
    addSystemMessage(`Error: ${data.error}`, 'error');
    setIsThinking(false);
  };

  const handleFileList = (data: { files: FileItem[], path: string }) => {
    setFiles(data.files);
    setCurrentPath(data.path);
  };

  const handleTaskStarted = (data: { taskId: string }) => {
    addSystemMessage(`Task started: ${data.taskId}`, 'system');
  };

  const handleApiProviderSet = (data: { provider: string }) => {
    addSystemMessage(`API provider set to ${data.provider}`, 'system');
    setShowSettings(false);
  };

  const handleModeChanged = (data: { currentMode: string; previousMode?: string }) => {
    const newMode = DEFAULT_MODES.find(mode => mode.slug === data.currentMode);
    if (newMode) {
      setCurrentMode(newMode);
      addSystemMessage(`Switched to ${newMode.name} mode: ${newMode.description}`, 'system');
    }
  };

  const handleCurrentMode = (data: { mode: string }) => {
    const mode = DEFAULT_MODES.find(m => m.slug === data.mode);
    if (mode) {
      setCurrentMode(mode);
    }
  };

  const addSystemMessage = (content: string, type: 'system' | 'error' = 'system') => {
    const message: Message = {
      id: `${Date.now()}-system`,
      type,
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !isConnected) return;

    const userMessage: Message = {
      id: `${Date.now()}-user`,
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsThinking(true);

    try {
      if (currentState?.currentTask) {
        await kiloClient.sendMessage(inputValue);
      } else {
        await kiloClient.startNewTask(inputValue);
      }
    } catch (error) {
      addSystemMessage(`Failed to send message: ${error}`, 'error');
      setIsThinking(false);
    }
  };

  const loadFiles = async () => {
    try {
      await kiloClient.listFiles(currentPath);
    } catch (error) {
      console.error('Failed to load files:', error);
    }
  };

  const navigateToPath = async (path: string) => {
    try {
      await kiloClient.listFiles(path);
    } catch (error) {
      addSystemMessage(`Failed to navigate to ${path}: ${error}`, 'error');
    }
  };

  const handleClearTask = async () => {
    try {
      await kiloClient.clearTask();
      setMessages([]);
      addSystemMessage('Task cleared', 'system');
    } catch (error) {
      addSystemMessage(`Failed to clear task: ${error}`, 'error');
    }
  };

  const handleModeChange = (mode: Mode) => {
    if (isConnected && mode.slug !== currentMode.slug) {
      // Send mode switch message to backend
      kiloClient.send({
        type: 'switchMode',
        mode: mode.slug
      });
      
      // Optimistically update the UI
      setCurrentMode(mode);
    }
  };

  // Request current mode on connection
  useEffect(() => {
    if (isConnected) {
      kiloClient.send({
        type: 'getCurrentMode'
      });
    }
  }, [isConnected]);

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString();
  };

  return (
    <div className="app">
      <IOSPWADetector />
      
      <header className="app-header">
        <h1>Kilo Code Web</h1>
        <div className="header-controls">
          <ModeSelector
            currentMode={currentMode}
            onModeChange={handleModeChange}
            isConnected={isConnected}
          />
          <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
          <button onClick={() => setShowSettings(!showSettings)}>
            ⚙️ Settings
          </button>
          {currentState?.currentTask && (
            <button onClick={handleClearTask} className="clear-task">
              🗑️ Clear Task
            </button>
          )}
        </div>
      </header>

      <div className="app-content">
        {/* Comprehensive Settings Panel */}
        <ComprehensiveSettingsPanel
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          targetSection="providers"
          webSocket={kiloClient.webSocket}
          isConnected={isConnected}
        />

        <div className="main-content">
          {/* Tab Navigation */}
          <div className="tab-navigation">
            <button
              className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              💬 Chat
            </button>
            <button
              className={`tab ${activeTab === 'files' ? 'active' : ''}`}
              onClick={() => setActiveTab('files')}
            >
              📁 Files
            </button>
            <button
              className={`tab ${activeTab === 'terminal' ? 'active' : ''}`}
              onClick={() => setActiveTab('terminal')}
            >
              💻 Terminal
            </button>
            <button
              className={`tab ${activeTab === 'workflows' ? 'active' : ''}`}
              onClick={() => setActiveTab('workflows')}
            >
              ⚙️ Workflows
            </button>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {activeTab === 'chat' && (
              <div className="chat-container">
                <div className="mode-context">
                  <div className="mode-indicator">
                    <span className="mode-badge">{currentMode.name}</span>
                    <span className="mode-role">{currentMode.description}</span>
                  </div>
                </div>
                <div className="messages">
                  {messages.map((message) => (
                    <div key={message.id} className={`message ${message.type}`}>
                      <div className="message-header">
                        <span className="message-type">{message.type}</span>
                        <span className="message-time">{formatTimestamp(message.timestamp)}</span>
                      </div>
                      <div className="message-content">
                        <pre>{message.content}</pre>
                      </div>
                    </div>
                  ))}
                  
                  {isThinking && (
                    <div className="message assistant thinking">
                      <div className="message-header">
                        <span className="message-type">assistant</span>
                        <span className="message-time">{formatTimestamp(new Date())}</span>
                      </div>
                      <div className="message-content">
                        <div className="thinking-indicator">
                          <span>Thinking</span>
                          <div className="dots">
                            <span>.</span>
                            <span>.</span>
                            <span>.</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSubmit} className="input-form">
                  <div className="input-container">
                    <textarea
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder={
                        currentState?.hasApiProvider
                          ? "Type your message..."
                          : "Configure API settings first..."
                      }
                      disabled={!isConnected || !currentState?.hasApiProvider}
                      rows={3}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit(e);
                        }
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!inputValue.trim() || !isConnected || isThinking || !currentState?.hasApiProvider}
                      className="send-button"
                    >
                      {isThinking ? '⏳' : '➤'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'files' && (
              <div className="file-explorer">
                <EnhancedFileExplorer
                  files={files}
                  currentPath={currentPath}
                  onPathChange={navigateToPath}
                  onFileSelect={(file: FileItem) => {
                    console.log('File selected:', file);
                  }}
                />
              </div>
            )}

            {activeTab === 'terminal' && (
              <div className="terminal-container">
                <Terminal
                  terminalId={activeTerminal}
                  className="app-terminal"
                />
              </div>
            )}

            {activeTab === 'workflows' && (
              <div className="workflow-container">
                <WorkflowManager
                  webSocket={kiloClient.webSocket}
                  isConnected={isConnected}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
