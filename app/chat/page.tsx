'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'react-hot-toast';
import ProtectedRoute from '@/components/ProtectedRoute';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';

interface Message {
  _id: string;
  text: string;
  type: 'text' | 'image';
  sender: { _id: string; name: string; nickname?: string };
  createdAt: string;
}

function formatTime(date: string) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(date: string) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

// Animation variants
const messageVariants = {
  hidden: (isMine: boolean) => ({
    opacity: 0,
    x: isMine ? 100 : -100,
    scale: 0.8,
    rotate: isMine ? 10 : -10,
  }),
  visible: (isMine: boolean) => ({
    opacity: 1,
    x: 0,
    scale: 1,
    rotate: 0,
    transition: {
      type: "spring",
      damping: 20,
      stiffness: 300,
      duration: 0.4,
    },
  }),
  exit: {
    opacity: 0,
    scale: 0.5,
    x: (isMine: boolean) => isMine ? 100 : -100,
    transition: { duration: 0.2 },
  },
};

const typingAnimation = {
  initial: { opacity: 0, y: 30, scale: 0.8 },
  animate: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { 
      type: "spring", 
      damping: 12, 
      stiffness: 200,
      duration: 0.3 
    }
  },
  exit: { opacity: 0, y: 30, scale: 0.8, transition: { duration: 0.2 } },
};

const buttonVariants = {
  tap: { scale: 0.92 },
  hover: { 
    scale: 1.08, 
    transition: { type: "spring", stiffness: 400 },
    boxShadow: "0 0 20px rgba(236, 72, 153, 0.5)"
  },
};

const onlineDotVariants = {
  online: { 
    scale: [1, 1.3, 1],
    transition: { duration: 1.5, repeat: Infinity }
  },
  offline: { scale: 1 }
};

export default function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [newMessageId, setNewMessageId] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastOnlineToastRef = useRef<string | null>(null);

  const loadMessages = async () => {
    setIsLoading(true);
    const { data } = await api.get('/chat/messages');
    setMessages(data.messages);
    setIsLoading(false);
  };

  // Scroll to bottom smoothly
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior, block: 'end' });
  };

  // Check if scrolled to bottom
  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    }
  };

  useEffect(() => {
    loadMessages();

    const socket = getSocket();
    if (!socket) return;

    socket.on('message:new', (msg: Message) => {
      setNewMessageId(msg._id);
      setMessages((prev) => [...prev, msg]);
      
      // Show notification for new message
      if (msg.sender._id !== user?.id) {
        toast.custom((t) => (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="bg-gradient-to-r from-romantic-500 to-pink-500 text-white rounded-xl px-4 py-2 shadow-xl flex items-center gap-2"
          >
            <span className="text-lg">💬</span>
            <div>
              <p className="text-sm font-semibold">{msg.sender.name || msg.sender.nickname}</p>
              <p className="text-xs">{msg.text.slice(0, 50)}</p>
            </div>
          </motion.div>
        ), { duration: 3000 });
      }
      
      setTimeout(() => setNewMessageId(null), 1000);
      scrollToBottom();
    });

    socket.on('message:edit', ({ id, text }: { id: string; text: string }) => {
      setMessages((prev) => prev.map((m) => (m._id === id ? { ...m, text } : m)));
      toast.success('Message edited', { icon: '✏️', duration: 2000 });
    });

    socket.on('message:delete', ({ id }: { id: string }) => {
      setMessages((prev) => prev.filter((m) => m._id !== id));
      toast.success('Message deleted', { icon: '🗑️', duration: 2000 });
    });

    socket.on('typing:start', () => {
      setPartnerTyping(true);
    });
    
    socket.on('typing:stop', () => {
      setPartnerTyping(false);
    });

    // Handle online status with toast
    socket.on('presence:update', ({ online }: { online: string[] }) => {
      const isOnline = online.some((id) => id !== user?.id);
      
      if (isOnline !== partnerOnline) {
        if (isOnline) {
          // Show online toast only once every 30 seconds
          if (!lastOnlineToastRef.current || Date.now() - parseInt(lastOnlineToastRef.current) > 30000) {
            toast.custom((t) => (
              <motion.div
                initial={{ opacity: 0, y: -50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -50 }}
                className="bg-green-500/90 backdrop-blur-md text-white rounded-xl px-4 py-2 shadow-xl flex items-center gap-2"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  🟢
                </motion.div>
                <span>Partner is now online!</span>
              </motion.div>
            ), { duration: 3000 });
            lastOnlineToastRef.current = Date.now().toString();
          }
        } else {
          toast.custom((t) => (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="bg-gray-500/90 backdrop-blur-md text-white rounded-xl px-4 py-2 shadow-xl flex items-center gap-2"
            >
              <span>⚫</span>
              <span>Partner went offline</span>
            </motion.div>
          ), { duration: 3000 });
        }
      }
      
      setPartnerOnline(isOnline);
    });

    return () => {
      socket.off('message:new');
      socket.off('message:edit');
      socket.off('message:delete');
      socket.off('typing:start');
      socket.off('typing:stop');
      socket.off('presence:update');
    };
  }, [user?.id, partnerOnline]);

  // Auto scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const handleTyping = (value: string) => {
    setText(value);
    const socket = getSocket();
    if (!socket) return;

    socket.emit('typing:start');
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit('typing:stop');
    }, 1500);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const value = text;
    setText('');
    getSocket()?.emit('typing:stop');
    
    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      _id: tempId,
      text: value,
      type: 'text',
      sender: { _id: user?.id || '', name: user?.name || '', nickname: user?.nickname },
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMessage]);
    scrollToBottom();
    
    try {
      const { data } = await api.post('/chat/messages', { text: value });
      // Replace temp message with real one
      setMessages((prev) => prev.map((m) => m._id === tempId ? data.message : m));
    } catch {
      // Remove temp message on failure
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
      setText(value);
      toast.error('Failed to send message', { icon: '❌' });
      // Shake effect
      inputRef.current?.classList.add('shake');
      setTimeout(() => inputRef.current?.classList.remove('shake'), 500);
    }
  };

  const startEdit = (msg: Message) => {
    setEditingId(msg._id);
    setEditText(msg.text);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editText.trim()) return;
    await api.patch(`/chat/messages/${editingId}`, { text: editText });
    setEditingId(null);
    setEditText('');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      await api.delete(`/chat/messages/${id}`);
    }
  };

  // Group messages by date
  const grouped: { date: string; items: Message[] }[] = [];
  messages.forEach((msg) => {
    const label = formatDateLabel(msg.createdAt);
    const lastGroup = grouped[grouped.length - 1];
    if (lastGroup && lastGroup.date === label) {
      lastGroup.items.push(msg);
    } else {
      grouped.push({ date: label, items: [msg] });
    }
  });

  return (
    <ProtectedRoute>
      <Toaster position="top-center" reverseOrder={false} />
      
      <main className="relative min-h-screen flex flex-col pb-24 overflow-hidden bg-gradient-to-br from-romantic-950 via-gray-900 to-romantic-950">
        
        {/* Animated Background */}
        <div className="fixed inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-romantic-500/10 via-transparent to-pink-500/10 animate-gradient-xy" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-romantic-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        {/* Header */}
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", damping: 20 }}
          className="sticky top-0 z-10 px-5 py-4 flex items-center justify-between bg-black/40 backdrop-blur-xl border-b border-white/10"
        >
          <div>
            <motion.h1 
              className="font-display text-xl bg-gradient-to-r from-romantic-400 to-pink-400 bg-clip-text text-transparent"
              animate={{ 
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
              }}
              transition={{ duration: 10, repeat: Infinity }}
            >
              Our Chat
            </motion.h1>
            
            <div className="flex items-center gap-2 mt-1">
              <motion.div
                variants={onlineDotVariants}
                animate={partnerOnline ? "online" : "offline"}
                className={`w-2 h-2 rounded-full ${partnerOnline ? 'bg-green-400' : 'bg-gray-400'}`}
              />
              <p className="text-xs text-white/60">
                {partnerOnline ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>
          
          <motion.div 
            className="w-10 h-10 rounded-full bg-gradient-to-r from-romantic-500 to-pink-500 flex items-center justify-center shadow-lg"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          >
            <span className="text-white text-lg">💬</span>
          </motion.div>
        </motion.div>

        {/* Messages Container */}
        <div 
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 px-4 py-4 pb-40 overflow-y-auto flex flex-col gap-2 scroll-smooth"
        >
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-10 h-10 border-2 border-romantic-500 border-t-transparent rounded-full"
              />
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {grouped.map((group) => (
                <div key={group.date}>
                  <motion.div 
                    className="text-center text-xs my-4"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                  >
                    <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-white/60">
                      {group.date}
                    </span>
                  </motion.div>
                  
                  {group.items.map((msg) => {
                    const isMine = String(msg.sender._id) === String(user?.id);
                    const isNew = msg._id === newMessageId;
                    
                    return (
                      <motion.div
                        key={msg._id}
                        custom={isMine}
                        variants={messageVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        layout
                        className={`w-full flex mb-3 ${isMine ? 'justify-end' : 'justify-start'}`}
                      >
                        <motion.div
                          whileHover={{ scale: 1.02 }}
                          transition={{ type: "spring", stiffness: 300 }}
                          className={`relative max-w-[75%] ${
                            isMine 
                              ? 'bg-gradient-to-r from-romantic-500 to-pink-500 text-white' 
                              : 'bg-white/10 backdrop-blur-md border border-white/20 text-white'
                          } rounded-2xl px-4 py-2 ${
                            isMine ? 'rounded-br-sm' : 'rounded-bl-sm'
                          } ${isNew ? 'animate-highlight' : ''}`}
                        >
                          {!isMine && msg.sender.name && (
                            <p className="text-xs text-romantic-300 mb-1 font-semibold">
                              {msg.sender.nickname || msg.sender.name}
                            </p>
                          )}
                          
                          {editingId === msg._id ? (
                            <form onSubmit={submitEdit} className="flex gap-2">
                              <input
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="bg-black/30 rounded-lg px-2 py-1 text-sm outline-none flex-1 text-white"
                                autoFocus
                              />
                              <motion.button 
                                type="submit"
                                whileTap={{ scale: 0.95 }}
                                className="text-xs text-romantic-300"
                              >
                                Save
                              </motion.button>
                            </form>
                          ) : (
                            <>
                              <p className="whitespace-pre-wrap break-words text-sm">
                                {msg.text}
                              </p>
                              <p className="text-[10px] opacity-60 mt-1 text-right">
                                {formatTime(msg.createdAt)}
                              </p>
                              
                              {isMine && (
                                <motion.div 
                                  className="absolute -top-2 -right-2 hidden group-hover:flex gap-1 bg-black/80 backdrop-blur-md rounded-full px-2 py-1"
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                >
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => startEdit(msg)}
                                    className="text-xs"
                                  >
                                    ✏️
                                  </motion.button>
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleDelete(msg._id)}
                                    className="text-xs"
                                  >
                                    🗑️
                                  </motion.button>
                                </motion.div>
                              )}
                            </>
                          )}
                        </motion.div>
                      </motion.div>
                    );
                  })}
                </div>
              ))}
            </AnimatePresence>
          )}
          
          {/* Typing Indicator */}
          <AnimatePresence>
            {partnerTyping && (
              <motion.div
                variants={typingAnimation}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex justify-start"
              >
                <div className="bg-white/10 backdrop-blur-md rounded-2xl px-4 py-2 text-sm">
                  <div className="flex gap-1">
                    {[0, 0.2, 0.4].map((delay) => (
                      <motion.div
                        key={delay}
                        className="w-2 h-2 bg-white/60 rounded-full"
                        animate={{ y: [-4, 0, -4] }}
                        transition={{
                          duration: 0.6,
                          repeat: Infinity,
                          delay,
                          ease: "easeInOut"
                        }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Scroll to Bottom Button */}
          <AnimatePresence>
            {showScrollButton && (
              <motion.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                onClick={() => scrollToBottom()}
                className="fixed bottom-28 right-4 z-20 bg-romantic-500 text-white rounded-full p-3 shadow-lg"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                ↓
              </motion.button>
            )}
          </AnimatePresence>
          
          <div ref={bottomRef} />
        </div>

        {/* Input Area */}
        <motion.form
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", damping: 20, delay: 0.1 }}
          onSubmit={handleSend}
          className="fixed bottom-20 left-0 right-0 px-4 py-3"
        >
          <div className="max-w-md mx-auto flex gap-2">
            <div className="flex-1 relative">
              <motion.input
                ref={inputRef}
                value={text}
                onChange={(e) => handleTyping(e.target.value)}
                placeholder="Type a message..."
                className="w-full bg-white/10 backdrop-blur-md rounded-2xl px-4 py-3 text-sm outline-none text-white placeholder-white/40 border border-white/20 focus:border-romantic-500 transition-colors"
                whileFocus={{ scale: 1.02 }}
              />
              {text && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40"
                >
                  {text.length}
                </motion.div>
              )}
            </div>
            
            <motion.button
              variants={buttonVariants}
              whileTap="tap"
              whileHover="hover"
              type="submit"
              disabled={!text.trim()}
              className={`px-5 rounded-2xl font-medium shadow-lg transition-all ${
                text.trim()
                  ? 'bg-gradient-to-r from-romantic-500 to-pink-500 text-white shadow-romantic-500/30'
                  : 'bg-white/10 text-white/40 cursor-not-allowed'
              }`}
            >
              Send
            </motion.button>
          </div>
        </motion.form>

        <BottomNav />
      </main>

      <style jsx global>{`
        @keyframes gradient-xy {
          0%, 100% { transform: translate(0%, 0%); }
          25% { transform: translate(10%, 10%); }
          50% { transform: translate(-10%, -10%); }
          75% { transform: translate(10%, -10%); }
        }
        
        .animate-gradient-xy {
          animation: gradient-xy 15s ease infinite;
          background-size: 400% 400%;
        }
        
        @keyframes highlight {
          0% { 
            box-shadow: 0 0 0 0 rgba(236, 72, 153, 0.7);
            transform: scale(1);
          }
          50% { 
            box-shadow: 0 0 0 10px rgba(236, 72, 153, 0);
            transform: scale(1.02);
          }
          100% { 
            box-shadow: 0 0 0 0 rgba(236, 72, 153, 0);
            transform: scale(1);
          }
        }
        
        .animate-highlight {
          animation: highlight 0.8s ease-out;
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        
        .shake {
          animation: shake 0.5s ease-in-out;
        }
        
        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 5px;
        }
        
        ::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        
        ::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #ec4899, #f43f5e);
          border-radius: 10px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #f43f5e, #ec4899);
        }
      `}</style>
    </ProtectedRoute>
  );
}
