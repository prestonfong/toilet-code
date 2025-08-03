import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { kiloClient } from '../utils/webClient';
import './Terminal.css';

interface TerminalProps {
  terminalId: string;
  onClose?: () => void;
  className?: string;
}

export const Terminal: React.FC<TerminalProps> = ({ 
  terminalId, 
  onClose,
  className = '' 
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm.js
    const xterm = new XTerm({
      cursorBlink: true,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5'
      },
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      lineHeight: 1.2
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);
    
    xterm.open(terminalRef.current);
    
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Handle input
    xterm.onData((data: string) => {
      if (kiloClient.isConnected) {
        kiloClient.sendTerminalInput(terminalId, data);
      }
    });

    // Handle paste
    xterm.onKey((e: any) => {
      const ev = e.domEvent;
      if (ev.ctrlKey && ev.key === 'v') {
        navigator.clipboard.readText().then((text) => {
          if (kiloClient.isConnected) {
            kiloClient.sendTerminalInput(terminalId, text);
          }
        });
      }
    });

    // Fit terminal to container
    setTimeout(() => {
      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      if (dims && kiloClient.isConnected) {
        kiloClient.resizeTerminal(terminalId, dims.cols, dims.rows);
      }
      setIsReady(true);
    }, 100);

    return () => {
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [terminalId]);

  useEffect(() => {
    if (isReady && kiloClient.isConnected) {
      // Create terminal session
      kiloClient.createTerminal(terminalId);
    }
  }, [isReady, terminalId]);

  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current && kiloClient.isConnected) {
        fitAddonRef.current.fit();
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims) {
          kiloClient.resizeTerminal(terminalId, dims.cols, dims.rows);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [terminalId]);

  useEffect(() => {
    // Set up message listeners for terminal events
    const handleTerminalData = (data: any) => {
      if (data.terminalId === terminalId && xtermRef.current) {
        xtermRef.current.write(data.data);
      }
    };

    const handleTerminalExit = (data: any) => {
      if (data.terminalId === terminalId) {
        console.log(`Terminal ${terminalId} exited with code ${data.exitCode}`);
        if (onClose) {
          onClose();
        }
      }
    };

    const handleTerminalError = (data: any) => {
      if (data.terminalId === terminalId) {
        console.error(`Terminal ${terminalId} error:`, data.error);
      }
    };

    // Add listeners
    kiloClient.on('terminal-data', handleTerminalData);
    kiloClient.on('terminal-exit', handleTerminalExit);
    kiloClient.on('terminal-error', handleTerminalError);

    return () => {
      // Cleanup on unmount
      if (kiloClient.isConnected) {
        kiloClient.destroyTerminal(terminalId);
      }
    };
  }, [terminalId, onClose]);

  return (
    <div className={`terminal-container ${className}`}>
      <div className="terminal-header">
        <span className="terminal-title">Terminal {terminalId}</span>
        {onClose && (
          <button 
            className="terminal-close" 
            onClick={onClose}
            title="Close Terminal"
          >
            ×
          </button>
        )}
      </div>
      <div 
        ref={terminalRef} 
        className="terminal-content"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};