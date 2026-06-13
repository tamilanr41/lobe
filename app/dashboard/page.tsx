'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ProtectedRoute from '@/components/ProtectedRoute';
import BottomNav from '@/components/BottomNav';
import FloatingParticles from '@/components/FloatingParticles';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';

interface CoupleData {
  _id: string;
  user1: { _id: string; name: string; nickname?: string };
  user2: { _id: string; name: string; nickname?: string };
  relationshipStartDate: string | null;
  loveMeter: number;
}

interface DailyQuestionData {
  date: string;
  question: string;
  answers: Record<string, string>;
}

function formatDuration(start: Date) {
  const now = new Date();
  let diff = now.getTime() - start.getTime();
  if (diff < 0) diff = 0;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const remDays = (days % 365) % 30;

  const parts = [];
  if (years) parts.push(`${years}y`);
  if (months) parts.push(`${months}m`);
  parts.push(`${remDays}d`);
  return parts.join(' ');
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [couple, setCoupleData] = useState<CoupleData | null>(null);
  const [dailyQ, setDailyQ] = useState<DailyQuestionData | null>(null);
  const [answer, setAnswer] = useState('');
  const [startDateInput, setStartDateInput] = useState('');
  const [hugAnim, setHugAnim] = useState(false);
  const [kissAnim, setKissAnim] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      const [coupleRes, dqRes] = await Promise.all([
        api.get('/couple'),
        api.get('/couple/daily-question'),
      ]);
      setCoupleData(coupleRes.data.couple);
      setDailyQ(dqRes.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not load your data.');
    }
  };

  useEffect(() => {
    loadData();

    const socket = getSocket();
    if (!socket) return;

    socket.on('receive:hug', () => {
      setHugAnim(true);
      setTimeout(() => setHugAnim(false), 2000);
    });
    socket.on('receive:kiss', () => {
      setKissAnim(true);
      setTimeout(() => setKissAnim(false), 2000);
    });

    return () => {
      socket.off('receive:hug');
      socket.off('receive:kiss');
    };
  }, []);

  const partner = couple
    ? couple.user1._id === user?.id
      ? couple.user2
      : couple.user1
    : null;

  const handleAdjustLove = async (delta: number) => {
    try {
      const { data } = await api.post('/couple/love-meter/adjust', { delta });
      setCoupleData((prev) => (prev ? { ...prev, loveMeter: data.loveMeter } : prev));
    } catch {
      // silent fail is fine for a small UI toggle
    }
  };

  const handleAnswerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) return;
    try {
      const { data } = await api.post('/couple/daily-question/answer', { answer });
      setDailyQ(data);
      setAnswer('');
    } catch {
      setError('Could not submit your answer.');
    }
  };

  const handleSetStartDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDateInput) return;
    try {
      const { data } = await api.patch('/couple/relationship-start', { date: startDateInput });
      setCoupleData((prev) =>
        prev ? { ...prev, relationshipStartDate: data.relationshipStartDate } : prev
      );
    } catch {
      setError('Could not save the date.');
    }
  };

  const sendHug = () => getSocket()?.emit('send:hug');
  const sendKiss = () => getSocket()?.emit('send:kiss');

  const myAnswer = dailyQ?.answers?.[user?.id || ''];
  const partnerAnswer = partner ? dailyQ?.answers?.[partner._id] : undefined;

  return (
    <ProtectedRoute>
      <main className="relative min-h-screen px-5 pt-8 pb-28 overflow-hidden">
        <FloatingParticles />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-white/50 text-sm">Welcome back,</p>
            <h1 className="font-display text-2xl gradient-text">
              {user?.nickname || user?.name} 💕
            </h1>
          </div>
          <button
            onClick={logout}
            className="text-white/40 text-xs glass px-3 py-2 rounded-xl"
          >
            Log out
          </button>
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {/* Relationship counter */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-3xl p-5 mb-4 text-center"
        >
          {couple?.relationshipStartDate ? (
            <>
              <p className="text-white/50 text-xs mb-1">Together for</p>
              <p className="font-display text-3xl gradient-text">
                {formatDuration(new Date(couple.relationshipStartDate))}
              </p>
            </>
          ) : (
            <form onSubmit={handleSetStartDate} className="flex flex-col gap-3 items-center">
              <p className="text-white/60 text-sm">When did your story begin?</p>
              <input
                type="date"
                required
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-primary/60"
              />
              <button className="px-5 py-2 rounded-xl bg-romantic-gradient text-sm font-medium">
                Save our date
              </button>
            </form>
          )}
        </motion.div>

        {/* Love meter */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass rounded-3xl p-5 mb-4"
        >
          <div className="flex justify-between items-center mb-2">
            <p className="text-white/60 text-sm">Love meter</p>
            <p className="text-primary-light font-semibold">{couple?.loveMeter ?? 50}%</p>
          </div>
          <div className="h-3 rounded-full bg-white/10 overflow-hidden mb-3">
            <motion.div
              className="h-full bg-romantic-gradient"
              initial={{ width: 0 }}
              animate={{ width: `${couple?.loveMeter ?? 50}%` }}
              transition={{ duration: 0.6 }}
            />
          </div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => handleAdjustLove(5)}
              className="flex-1 py-2 rounded-xl glass text-sm"
            >
              +5 ❤️
            </button>
            <button
              onClick={() => handleAdjustLove(-5)}
              className="flex-1 py-2 rounded-xl glass text-sm"
            >
              -5
            </button>
          </div>
        </motion.div>

        {/* Daily question */}
        {dailyQ && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-3xl p-5 mb-4"
          >
            <p className="text-white/50 text-xs mb-1">💭 Today's question</p>
            <p className="font-display text-lg mb-3">{dailyQ.question}</p>

            {!myAnswer ? (
              <form onSubmit={handleAnswerSubmit} className="flex gap-2">
                <input
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Your answer…"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-primary/60"
                />
                <button className="px-4 py-2 rounded-xl bg-romantic-gradient text-sm font-medium">
                  Send
                </button>
              </form>
            ) : (
              <div className="flex flex-col gap-2 text-sm">
                <div className="bg-white/5 rounded-xl px-4 py-2">
                  <span className="text-white/40 text-xs">You: </span>
                  {myAnswer}
                </div>
                {partnerAnswer ? (
                  <div className="bg-primary/10 rounded-xl px-4 py-2">
                    <span className="text-white/40 text-xs">
                      {partner?.nickname || partner?.name}:{' '}
                    </span>
                    {partnerAnswer}
                  </div>
                ) : (
                  <p className="text-white/40 text-xs">
                    Waiting for {partner?.nickname || partner?.name} to answer…
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Virtual hug & kiss */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-3xl p-5 flex gap-3"
        >
          <button
            onClick={sendHug}
            className="flex-1 py-4 rounded-2xl glass flex flex-col items-center gap-1"
          >
            <span className="text-2xl">🤗</span>
            <span className="text-xs text-white/60">Send a hug</span>
          </button>
          <button
            onClick={sendKiss}
            className="flex-1 py-4 rounded-2xl glass flex flex-col items-center gap-1"
          >
            <span className="text-2xl">😘</span>
            <span className="text-xs text-white/60">Send a kiss</span>
          </button>
        </motion.div>

        {/* Incoming animations */}
        <AnimatePresence>
          {hugAnim && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 50 }}
              animate={{ opacity: 1, scale: 1.4, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: -50 }}
              className="fixed inset-0 flex items-center justify-center text-8xl pointer-events-none z-30"
            >
              🤗
            </motion.div>
          )}
          {kissAnim && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 50 }}
              animate={{ opacity: 1, scale: 1.4, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: -50 }}
              className="fixed inset-0 flex items-center justify-center text-8xl pointer-events-none z-30"
            >
              😘
            </motion.div>
          )}
        </AnimatePresence>

        <BottomNav />
      </main>
    </ProtectedRoute>
  );
}
