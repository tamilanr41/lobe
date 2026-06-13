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

export default function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadMessages = async () => {
    const { data } = await api.get('/chat/messages');
    setMessages(data.messages);
  };

  useEffect(() => {
    loadMessages();

    const socket = getSocket();
    if (!socket) return;

    socket.on('message:new', (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      // message will arrive via socket; no need to manually append
    } catch {
      setText(value); // restore on failure
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
      <main className="relative min-h-screen flex flex-col pb-24">
        {/* Header */}
        <div className="glass sticky top-0 z-10 px-5 py-4 flex items-center justify-between rounded-b-3xl">
          <div>
            <h1 className="font-display text-xl gradient-text">Our Chat</h1>
            <p className="text-xs text-white/40">
              {partnerOnline ? (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Online
                </span>
              ) : (
                'Offline'
              )}
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 px-4 py-4 overflow-y-auto flex flex-col gap-2">
          {grouped.map((group) => (
            <div key={group.date}>
              <div className="text-center text-xs text-white/30 my-3">{group.date}</div>
              {group.items.map((msg) => {
                const isMine = msg.sender._id === user?.id;
                return (
                  <motion.div
                    key={msg._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex mb-2 ${isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`group relative max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                        isMine
                          ? 'bg-romantic-gradient text-white rounded-br-sm'
                          : 'glass rounded-bl-sm'
                      }`}
                    >
                      {editingId === msg._id ? (
                        <form onSubmit={submitEdit} className="flex gap-2">
                          <input
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="bg-black/20 rounded-lg px-2 py-1 text-sm outline-none flex-1"
                            autoFocus
                          />
                          <button type="submit" className="text-xs underline">
                            Save
                          </button>
                        </form>
                      ) : (
                        <>
                          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                          <p className="text-[10px] opacity-60 mt-1 text-right">
                            {formatTime(msg.createdAt)}
                          </p>

                          {isMine && (
                            <div className="absolute -top-2 right-2 hidden group-hover:flex gap-1 bg-bg-card rounded-full px-2 py-1 text-[10px]">
                              <button onClick={() => startEdit(msg)}>✏️</button>
                              <button onClick={() => handleDelete(msg._id)}>🗑️</button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ))}

          <AnimatePresence>
            {partnerTyping && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="glass rounded-2xl px-4 py-2 text-sm w-fit"
              >
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handleSend}
          className="fixed bottom-20 left-0 right-0 px-4 flex gap-2 max-w-md mx-auto"
        >
          <input
            value={text}
            onChange={(e) => handleTyping(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 glass rounded-2xl px-4 py-3 text-sm outline-none"
          />
          <motion.button
            whileTap={{ scale: 0.92 }}
            type="submit"
            className="px-5 rounded-2xl bg-romantic-gradient font-medium"
          >
            Send
          </motion.button>
        </form>

        <BottomNav />
      </main>
    </ProtectedRoute>
  );
}
