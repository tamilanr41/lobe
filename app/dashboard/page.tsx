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

// Animation variants for staggered card entrance
const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: 0.08 * i, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [couple, setCoupleData] = useState<CoupleData | null>(null);
  const [dailyQ, setDailyQ] = useState<DailyQuestionData | null>(null);
  const [answer, setAnswer] = useState('');
  const [startDateInput, setStartDateInput] = useState('');
  const [hugAnim, setHugAnim] = useState(false);
  const [kissAnim, setKissAnim] = useState(false);
  const [error, setError] = useState('');
  const [loveDelta, setLoveDelta] = useState<number | null>(null);
  const [pulseHeart, setPulseHeart] = useState(false);

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

  // Gentle heartbeat pulse loop for the love meter heart icon
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseHeart(true);
      setTimeout(() => setPulseHeart(false), 600);
    }, 4000);
    return () => clearInterval(interval);
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
      setLoveDelta(delta);
      setTimeout(() => setLoveDelta(null), 900);
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
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between mb-6"
        >
          <div>
            <p className="text-white/50 text-sm">Welcome back,</p>
            <h1 className="font-display text-2xl gradient-text">
              {user?.nickname || user?.name}{' '}
              <motion.span
                className="inline-block"
                animate={{ scale: [1, 1.25, 1] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              >
                💕
              </motion.span>
            </h1>
          </div>
          <motion.button
            whileTap={{ scale: 0.94 }}
            whileHover={{ scale: 1.03 }}
            onClick={logout}
            className="text-white/40 text-xs glass px-3 py-2 rounded-xl"
          >
            Log out
          </motion.button>
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-red-400 text-sm mb-4"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Relationship counter */}
        <motion.div
          custom={0}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          whileHover={{ scale: 1.01 }}
          className="glass rounded-3xl p-5 mb-4 text-center relative overflow-hidden"
        >
          <motion.div
            className="absolute inset-0 opacity-0"
            animate={{ opacity: [0, 0.15, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              background:
                'radial-gradient(circle at 50% 0%, rgba(255,93,143,0.5), transparent 60%)',
            }}
          />
          {couple?.relationshipStartDate ? (
            <>
              <p className="text-white/50 text-xs mb-1 relative z-10">Together for</p>
              <motion.p
                key={formatDuration(new Date(couple.relationshipStartDate))}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="font-display text-3xl gradient-text relative z-10"
              >
                {formatDuration(new Date(couple.relationshipStartDate))}
              </motion.p>
            </>
          ) : (
            <form onSubmit={handleSetStartDate} className="flex flex-col gap-3 items-center relative z-10">
              <p className="text-white/60 text-sm">When did your story begin?</p>
              <input
                type="date"
                required
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-primary/60 transition-colors"
              />
              <motion.button
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.03 }}
                className="px-5 py-2 rounded-xl bg-romantic-gradient text-sm font-medium"
              >
                Save our date
              </motion.button>
            </form>
          )}
        </motion.div>

        {/* Love meter */}
        <motion.div
          custom={1}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="glass rounded-3xl p-5 mb-4"
        >
          <div className="flex justify-between items-center mb-2">
            <p className="text-white/60 text-sm flex items-center gap-1.5">
              Love meter
              <motion.span
                animate={pulseHeart ? { scale: [1, 1.4, 1] } : {}}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              >
                ❤️
              </motion.span>
            </p>
            <motion.p
              key={couple?.loveMeter}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.4 }}
              className="text-primary-light font-semibold"
            >
              {couple?.loveMeter ?? 50}%
            </motion.p>
          </div>
          <div className="h-3 rounded-full bg-white/10 overflow-hidden mb-3 relative">
            <motion.div
              className="h-full bg-romantic-gradient relative"
              initial={{ width: 0 }}
              animate={{ width: `${couple?.loveMeter ?? 50}%` }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.div
                className="absolute inset-0"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                  width: '40%',
                }}
              />
            </motion.div>
          </div>
          <div className="flex gap-2 justify-center relative">
            <motion.button
              whileTap={{ scale: 0.93 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => handleAdjustLove(5)}
              className="flex-1 py-2 rounded-xl glass text-sm"
            >
              +5 ❤️
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.93 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => handleAdjustLove(-5)}
              className="flex-1 py-2 rounded-xl glass text-sm"
            >
              -5
            </motion.button>

            <AnimatePresence>
              {loveDelta !== null && (
                <motion.span
                  initial={{ opacity: 0, y: 0, scale: 0.8 }}
                  animate={{ opacity: 1, y: -28, scale: 1.1 }}
                  exit={{ opacity: 0, y: -40 }}
                  transition={{ duration: 0.8 }}
                  className={`absolute top-0 left-1/2 -translate-x-1/2 font-display text-sm font-semibold pointer-events-none ${
                    loveDelta > 0 ? 'text-primary-light' : 'text-white/50'
                  }`}
                >
                  {loveDelta > 0 ? '+5 💗' : '−5'}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Daily question */}
        {dailyQ && (
          <motion.div
            custom={2}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="glass rounded-3xl p-5 mb-4"
          >
            <p className="text-white/50 text-xs mb-1">💭 Today&apos;s question</p>
            <p className="font-display text-lg mb-3">{dailyQ.question}</p>

            <AnimatePresence mode="wait">
              {!myAnswer ? (
                <motion.form
                  key="answer-form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleAnswerSubmit}
                  className="flex gap-2"
                >
                  <input
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Your answer…"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-primary/60 transition-colors"
                  />
                  <motion.button
                    whileTap={{ scale: 0.93 }}
                    whileHover={{ scale: 1.03 }}
                    className="px-4 py-2 rounded-xl bg-romantic-gradient text-sm font-medium"
                  >
                    Send
                  </motion.button>
                </motion.form>
              ) : (
                <motion.div
                  key="answers"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-2 text-sm"
                >
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 }}
                    className="bg-white/5 rounded-xl px-4 py-2"
                  >
                    <span className="text-white/40 text-xs">You: </span>
                    {myAnswer}
                  </motion.div>
                  {partnerAnswer ? (
                    <motion.div
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 }}
                      className="bg-primary/10 rounded-xl px-4 py-2"
                    >
                      <span className="text-white/40 text-xs">
                        {partner?.nickname || partner?.name}:{' '}
                      </span>
                      {partnerAnswer}
                    </motion.div>
                  ) : (
                    <p className="text-white/40 text-xs flex items-center gap-1">
                      Waiting for {partner?.nickname || partner?.name} to answer
                      <motion.span
                        animate={{ opacity: [0, 1, 0] }}
                        transition={{ duration: 1.4, repeat: Infinity }}
                      >
                        …
                      </motion.span>
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Virtual hug & kiss */}
        <motion.div
          custom={3}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="glass rounded-3xl p-5 flex gap-3"
        >
          <motion.button
            whileTap={{ scale: 0.9, rotate: -4 }}
            whileHover={{ scale: 1.04, y: -2 }}
            onClick={sendHug}
            className="flex-1 py-4 rounded-2xl glass flex flex-col items-center gap-1"
          >
            <motion.span
              className="text-2xl"
              animate={{ rotate: [0, -8, 8, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              🤗
            </motion.span>
            <span className="text-xs text-white/60">Send a hug</span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9, rotate: 4 }}
            whileHover={{ scale: 1.04, y: -2 }}
            onClick={sendKiss}
            className="flex-1 py-4 rounded-2xl glass flex flex-col items-center gap-1"
          >
            <motion.span
              className="text-2xl"
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              😘
            </motion.span>
            <span className="text-xs text-white/60">Send a kiss</span>
          </motion.button>
        </motion.div>

        {/* Incoming animations */}
        <AnimatePresence>
          {hugAnim && (
            <motion.div
              initial={{ opacity: 0, scale: 0.4, y: 60 }}
              animate={{ opacity: 1, scale: 1.4, y: 0 }}
              exit={{ opacity: 0, scale: 0.6, y: -60 }}
              transition={{ duration: 0.6 }}
              className="fixed inset-0 flex items-center justify-center text-8xl pointer-events-none z-30"
            >
              <div className="relative">
                <motion.span
                  animate={{ rotate: [0, -8, 8, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="inline-block"
                >
                  🤗
                </motion.span>
                {Array.from({ length: 6 }).map((_, i) => (
                  <motion.span
                    key={i}
                    className="absolute text-2xl"
                    style={{ left: '50%', top: '50%' }}
                    initial={{ opacity: 1, x: 0, y: 0, scale: 0.6 }}
                    animate={{
                      opacity: 0,
                      x: Math.cos((i / 6) * Math.PI * 2) * 90,
                      y: Math.sin((i / 6) * Math.PI * 2) * 90,
                      scale: 1.1,
                    }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                  >
                    💗
                  </motion.span>
                ))}
              </div>
            </motion.div>
          )}
          {kissAnim && (
            <motion.div
              initial={{ opacity: 0, scale: 0.4, y: 60 }}
              animate={{ opacity: 1, scale: 1.4, y: 0 }}
              exit={{ opacity: 0, scale: 0.6, y: -60 }}
              transition={{ duration: 0.6 }}
              className="fixed inset-0 flex items-center justify-center text-8xl pointer-events-none z-30"
            >
              <div className="relative">
                <motion.span
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="inline-block"
                >
                  😘
                </motion.span>
                {Array.from({ length: 6 }).map((_, i) => (
                  <motion.span
                    key={i}
                    className="absolute text-2xl"
                    style={{ left: '50%', top: '50%' }}
                    initial={{ opacity: 1, x: 0, y: 0, scale: 0.6 }}
                    animate={{
                      opacity: 0,
                      x: Math.cos((i / 6) * Math.PI * 2) * 90,
                      y: Math.sin((i / 6) * Math.PI * 2) * 90,
                      scale: 1.1,
                    }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                  >
                    💋
                  </motion.span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <BottomNav />
      </main>
    </ProtectedRoute>
  );
}
