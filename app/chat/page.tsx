'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
    x: isMine ? 50 : -50,
    scale: 0.8,
  }),
  visible: (isMine: boolean) => ({
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      type: "spring",
      damping: 20,
      stiffness: 300,
      duration: 0.3,
    },
  }),
  exit: {
    opacity: 0,
    scale: 0.5,
    transition: { duration: 0.2 },
  },
};

const typingAnimation = {
  initial: { opacity: 0, y: 20, scale: 0.9 },
  animate: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { type: "spring", damping: 15, stiffness: 400 }
  },
  exit: { opacity: 0, y: 20, scale: 0.9 },
};

const buttonVariants = {
  tap: { scale: 0.95 },
  hover: { scale: 1.05, transition: { type: "spring", stiffness: 400 } },
};

const headerVariants = {
  hidden: { y: -100, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1,
    transition: { type: "spring", damping: 20, stiffness: 300 }
  },
};

const inputVariants = {
  hidden: { y: 100, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1,
    transition: { type: "spring", damping: 20, stiffness: 300, delay: 0.1 }
  },
};

const dateSeparatorVariants = {
  hidden: { scale: 0.9, opacity: 0 },
  visible: { 
    scale: 1, 
    opacity: 1,
    transition: { duration: 0.3 }
  },
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadMessages = async () => {
    setIsLoading(true);
    const { data } = await api.get('/chat/messages');
    setMessages(data.messages);
    setIsLoading(false);
  };

  useEffect(() => {
    loadMessages();

    const socket = getSocket();
    if (!socket) return;

    socket.on('message:new', (msg: Message) => {
      setNewMessageId(msg._id);
      setMessages((prev) => [...prev, msg]);
      // Remove highlight after animation
      setTimeout(() => setNewMessageId(null), 1000);
    });

    socket.on('message:edit', ({ id, text }: { id: string; text: string }) => {
      setMessages((prev) => prev.map((m) => (m._id === id ? { ...m, text } : m)));
    });

    socket.on('message:delete', ({ id }: { id: string }) => {
      setMessages((prev) => prev.filter((m) => m._id !== id));
    });

    socket.on('typing:start', () => setPartnerTyping(true));
    socket.on('typing:stop', () => setPartnerTyping(false));

    socket.on('presence:update', ({ online }: { online: string[] }) => {
      setPartnerOnline(online.some((id) => id !== user?.id));
    });

    return () => {
      socket.off('message:new');
      socket.off('message:edit');
      socket.off('message:delete');
      socket.off('typing:start');
      socket.off('typing:stop');
      socket.off('presence:update');
    };
  }, [user?.id]);

  // Scroll to bottom with smooth animation
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
    try {
      await api.post('/chat/messages', { text: value });
      // message will arrive via socket
    } catch {
      setText(value); // restore on failure
      // Shake effect on input
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
    setMessages((prev) =>
      prev.map((m) => (m._id === editingId ? { ...m, text: editText } : m))
    );
    setEditingId(null);
    setEditText('');
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/chat/messages/${id}`);
    setMessages((prev) => prev.filter((m) => m._id !== id));
  };

  // Group messages by date for separators
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
      <main className="relative min-h-screen flex flex-col pb-24 overflow-hidden">
        {/* Animated Background Gradient */}
        <div className="fixed inset-0 bg-gradient-to-br from-romantic-900/20 via-bg-primary to-romantic-900/10 animate-gradient-xy" />
        
        {/* Header */}
        <motion.div
          variants={headerVariants}
          initial="hidden"
          animate="visible"
          className="sticky top-0 z-10 px-5 py-4 flex items-center justify-between rounded-b-3xl bg-gradient-to-r from-black/40 to-black/20 backdrop-blur-xl border-b border-white/10"
        >
          <div>
            <motion.h1 
              className="font-display text-xl gradient-text"
              animate={{ 
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            >
              Our Chat
            </motion.h1>
            <motion.p 
              className="text-xs text-white/40 flex items-center gap-1"
              animate={{ opacity: partnerOnline ? 1 : 0.6 }}
            >
              {partnerOnline ? (
                <motion.span 
                  className="flex items-center gap-1"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block animate-pulse" /> 
                  Online
                </motion.span>
              ) : (
                'Offline'
              )}
            </motion.p>
          </div>
          
          {/* Animated decorative element */}
          <motion.div 
            className="w-8 h-8 rounded-full bg-romantic-gradient/20"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
        </motion.div>

        {/* Messages Container */}
        <div className="flex-1 px-4 py-4 pb-40 overflow-y-auto flex flex-col gap-2">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 border-2 border-romantic-500 border-t-transparent rounded-full"
              />
            </div>
          ) : (
            grouped.map((group) => (
              <motion.div
                key={group.date}
                variants={dateSeparatorVariants}
                initial="hidden"
                animate="visible"
              >
                <div className="text-center text-xs text-white/30 my-3">
                  <motion.span 
                    className="inline-block px-3 py-1 rounded-full bg-white/5 backdrop-blur-sm"
                    whileHover={{ scale: 1.05 }}
                  >
                    {group.date}
                  </motion.span>
                </div>
                {group.items.map((msg, index) => {
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
                      transition={{ delay: index * 0.05 }}
                      className={`w-full flex mb-2 ${isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        className={`group relative max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                          isMine
                            ? 'bg-gradient-to-r from-romantic-500 to-pink-500 text-white rounded-br-sm shadow-lg'
                            : 'glass backdrop-blur-md rounded-bl-sm border border-white/10'
                        } ${isNew ? 'animate-highlight' : ''}`}
                      >
                        {editingId === msg._id ? (
                          <motion.form 
                            onSubmit={submitEdit} 
                            className="flex gap-2"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                          >
                            <input
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="bg-black/20 rounded-lg px-2 py-1 text-sm outline-none flex-1"
                              autoFocus
                            />
                            <motion.button 
                              type="submit" 
                              className="text-xs underline"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              Save
                            </motion.button>
                          </motion.form>
                        ) : (
                          <>
                            <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                            <p className="text-[10px] opacity-60 mt-1 text-right">
                              {formatTime(msg.createdAt)}
                            </p>

                            {isMine && (
                              <motion.div 
                                className="absolute -top-2 right-2 hidden group-hover:flex gap-1 bg-black/60 backdrop-blur-md rounded-full px-2 py-1 text-[10px]"
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                              >
                                <motion.button 
                                  onClick={() => startEdit(msg)}
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  className="hover:text-romantic-300 transition-colors"
                                >
                                  ✏️
                                </motion.button>
                                <motion.button 
                                  onClick={() => handleDelete(msg._id)}
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  className="hover:text-red-400 transition-colors"
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
              </motion.div>
            ))
          )}

          {/* Typing Indicator */}
          <AnimatePresence>
            {partnerTyping && (
              <motion.div
                variants={typingAnimation}
                initial="initial"
                animate="animate"
                exit="exit"
                className="glass rounded-2xl px-4 py-2 text-sm w-fit backdrop-blur-md"
              >
                <span className="inline-flex gap-1">
                  {[0, 150, 300].map((delay) => (
                    <motion.span
                      key={delay}
                      className="w-1.5 h-1.5 bg-white/60 rounded-full"
                      animate={{ y: [0, -8, 0] }}
                      transition={{ 
                        duration: 0.6, 
                        repeat: Infinity,
                        delay: delay / 1000,
                        ease: "easeInOut"
                      }}
                    />
                  ))}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={bottomRef} />
        </div>

        {/* Input Area */}
        <motion.form
          variants={inputVariants}
          initial="hidden"
          animate="visible"
          onSubmit={handleSend}
          className="fixed bottom-20 left-0 right-0 px-4 py-2 flex gap-2 max-w-md mx-auto z-20"
        >
          <motion.div className="flex-1 relative">
            <motion.input
              ref={inputRef}
              value={text}
              onChange={(e) => handleTyping(e.target.value)}
              placeholder="Type a message…"
              className="w-full glass rounded-2xl px-4 py-3 text-sm outline-none backdrop-blur-md pr-12"
              whileFocus={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300 }}
            />
            {text && (
              <motion.div 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                {text.length}
              </motion.div>
            )}
          </motion.div>
          
          <motion.button
            variants={buttonVariants}
            whileTap="tap"
            whileHover="hover"
            type="submit"
            className="px-5 rounded-2xl bg-gradient-to-r from-romantic-500 to-pink-500 font-medium shadow-lg shadow-romantic-500/30"
            disabled={!text.trim()}
          >
            <motion.span
              animate={text.trim() ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              Send
            </motion.span>
          </motion.button>
        </motion.form>

        <BottomNav />
      </main>

      {/* Add global styles for animations */}
      <style jsx global>{`
        @keyframes gradient-xy {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        .animate-gradient-xy {
          animation: gradient-xy 15s ease infinite;
          background-size: 400% 400%;
        }
        
        @keyframes highlight {
          0% { background-color: rgba(236, 72, 153, 0.5); transform: scale(1); }
          50% { background-color: rgba(236, 72, 153, 0.2); transform: scale(1.02); }
          100% { background-color: transparent; transform: scale(1); }
        }
        
        .animate-highlight {
          animation: highlight 1s ease-out;
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        
        .shake {
          animation: shake 0.3s ease-in-out;
        }
        
        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 4px;
        }
        
        ::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        
        ::-webkit-scrollbar-thumb {
          background: rgba(236, 72, 153, 0.5);
          border-radius: 10px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(236, 72, 153, 0.7);
        }
      `}</style>
    </ProtectedRoute>
  );
}
