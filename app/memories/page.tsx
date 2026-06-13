'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ProtectedRoute from '@/components/ProtectedRoute';
import BottomNav from '@/components/BottomNav';
import FloatingParticles from '@/components/FloatingParticles';
import api from '@/lib/api';

interface Memory {
  _id: string;
  title: string;
  description: string;
  date: string;
  addedBy: { _id: string; name: string; nickname?: string };
}

export default function MemoriesPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const { data } = await api.get('/memories');
    setMemories(data.memories);
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    try {
      const { data } = await api.post('/memories', { title, description, date });
      setMemories((prev) => [...prev, data.memory].sort((a, b) => a.date.localeCompare(b.date)));
      setTitle('');
      setDescription('');
      setDate('');
      setShowForm(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not add memory.');
    }
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/memories/${id}`);
    setMemories((prev) => prev.filter((m) => m._id !== id));
  };

  return (
    <ProtectedRoute>
      <main className="relative min-h-screen px-5 pt-8 pb-28 overflow-hidden">
        <FloatingParticles />

        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl gradient-text">Our Memories</h1>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowForm((s) => !s)}
            className="px-4 py-2 rounded-xl bg-romantic-gradient text-sm font-medium"
          >
            {showForm ? 'Cancel' : '+ Add'}
          </motion.button>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleAdd}
              className="glass rounded-3xl p-5 mb-6 flex flex-col gap-3 overflow-hidden"
            >
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title (e.g. Our first date)"
                required
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-primary/60"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this memory…"
                rows={3}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-primary/60 resize-none"
              />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-primary/60"
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button className="py-2 rounded-xl bg-romantic-gradient text-sm font-medium">
                Save memory
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Timeline */}
        <div className="relative pl-6 border-l border-white/10 flex flex-col gap-6">
          {memories.length === 0 && (
            <p className="text-white/40 text-sm">No memories yet. Add your first one! 💌</p>
          )}

          {memories.map((memory, i) => (
            <motion.div
              key={memory._id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative"
            >
              <div className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-romantic-gradient" />

              <div className="glass rounded-2xl p-4">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-display text-lg">{memory.title}</h3>
                  <button
                    onClick={() => handleDelete(memory._id)}
                    className="text-white/30 text-xs"
                  >
                    🗑️
                  </button>
                </div>
                <p className="text-xs text-white/40 mb-2">
                  {new Date(memory.date).toLocaleDateString([], {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                {memory.description && (
                  <p className="text-sm text-white/70 whitespace-pre-wrap">{memory.description}</p>
                )}
                <p className="text-[10px] text-white/30 mt-2">
                  Added by {memory.addedBy?.nickname || memory.addedBy?.name}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <BottomNav />
      </main>
    </ProtectedRoute>
  );
}
