/**
 * @file LiveAuctionRoom.jsx
 * @description Real-time auction room component with live updates, chat, and viewer count
 */

import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext.jsx';
import { useAuthContext } from '../hooks/useAuth.js';
import { FaUsers, FaEye, FaClock, FaComments } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import './LiveAuctionRoom.css';

const LiveAuctionRoom = ({ itemId }) => {
  const { socket, isConnected } = useSocket();
  const { authUser } = useAuthContext();
  const [viewerCount, setViewerCount] = useState(0);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [showChat, setShowChat] = useState(true); // Changed to true - chat visible by default
  const [notifications, setNotifications] = useState([]);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Join auction room on mount
  useEffect(() => {
    if (!socket || !isConnected || !itemId) return;

    console.log('🔵 Joining auction room:', itemId);
    socket.emit('join-auction-room', {
      itemId,
      userId: authUser?._id || null
    });

    // Viewer count updates
    socket.on('viewer-count-update', (data) => {
      if (data.itemId === itemId) {
        setViewerCount(data.count);
      }
    });

    // New chat messages
    socket.on('new-auction-message', (data) => {
      if (data.itemId === itemId) {
        setMessages(prev => [...prev, data]);
      }
    });

    // Typing indicators
    socket.on('user-typing-update', (data) => {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        if (data.isTyping) {
          newSet.add(data.userName);
        } else {
          newSet.delete(data.userName);
        }
        return newSet;
      });
    });

    // Auction alerts
    socket.on('auction-alert', (alert) => {
      if (alert.itemId === itemId) {
        addNotification(alert.message, 'warning');
      }
    });

    // Watch count updates
    socket.on('watch-count-update', (data) => {
      if (data.itemId === itemId) {
        addNotification(`${data.count} people watching this item`, 'info');
      }
    });

    // Cleanup on unmount
    return () => {
      console.log('🔴 Leaving auction room:', itemId);
      socket.emit('leave-auction-room', itemId);
      socket.off('viewer-count-update');
      socket.off('new-auction-message');
      socket.off('user-typing-update');
      socket.off('auction-alert');
      socket.off('watch-count-update');
    };
  }, [socket, isConnected, itemId, authUser]);

  const addNotification = (message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !socket || !authUser) return;

    const messageData = {
      itemId,
      message: messageInput.trim(),
      userName: authUser.username,
      timestamp: new Date().toISOString()
    };

    socket.emit('send-auction-message', messageData);
    setMessageInput('');
    handleStopTyping();
  };

  const handleTyping = () => {
    if (!socket || !authUser) return;

    socket.emit('user-typing', {
      itemId,
      userName: authUser.username,
      isTyping: true
    });

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping();
    }, 2000);
  };

  const handleStopTyping = () => {
    if (!socket || !authUser) return;

    socket.emit('user-typing', {
      itemId,
      userName: authUser.username,
      isTyping: false
    });
  };

  return (
    <div className="live-auction-room">
      {/* Real-time Stats Bar */}
      <div className="auction-stats-bar">
        <motion.div 
          className="stat-item"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring' }}
        >
          <FaEye className="stat-icon" />
          <span className="stat-value">{viewerCount}</span>
          <span className="stat-label">Live Watchers</span>
        </motion.div>

        <div className="stat-item">
          <FaClock className="stat-icon pulse" />
          <span className="stat-label">Live Auction</span>
        </div>

        <button 
          className="chat-toggle-btn"
          onClick={() => setShowChat(!showChat)}
        >
          <FaComments className="stat-icon" />
          <span className="stat-label">
            {showChat ? 'Hide Live Chat' : 'Show Live Chat'}
          </span>
          {messages.length > 0 && !showChat && (
            <span className="chat-badge">{messages.length}</span>
          )}
        </button>
      </div>

      {/* Live Notifications */}
      <AnimatePresence>
        {notifications.map(notification => (
          <motion.div
            key={notification.id}
            className={`live-notification ${notification.type}`}
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            transition={{ type: 'spring', damping: 20 }}
          >
            {notification.message}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Live Chat Panel */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            className="chat-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="chat-header">
              <h4>Live Chat</h4>
              <span className="online-count">
                <FaUsers /> {viewerCount} online
              </span>
            </div>

            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="no-messages">
                  <FaComments size={40} />
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((msg, index) => (
                  <motion.div
                    key={index}
                    className={`chat-message ${msg.socketId === socket?.id ? 'own-message' : ''}`}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="message-header">
                      <strong>{msg.userName}</strong>
                      <span className="message-time">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="message-body">{msg.message}</div>
                  </motion.div>
                ))
              )}
              
              {typingUsers.size > 0 && (
                <motion.div
                  className="typing-indicator"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <span className="typing-dots">
                    <span></span><span></span><span></span>
                  </span>
                  {Array.from(typingUsers).join(', ')} typing...
                </motion.div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {authUser ? (
              <form className="chat-input-form" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  className="chat-input"
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => {
                    setMessageInput(e.target.value);
                    handleTyping();
                  }}
                  maxLength={200}
                />
                <button type="submit" className="send-btn" disabled={!messageInput.trim()}>
                  Send
                </button>
              </form>
            ) : (
              <div className="chat-login-prompt">
                Please login to participate in chat
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connection Status Indicator */}
      {!isConnected && (
        <div className="connection-status offline">
          <span className="status-dot"></span>
          Reconnecting...
        </div>
      )}
    </div>
  );
};

export default LiveAuctionRoom;
