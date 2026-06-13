'use client';

export default function FloatingParticles() {
  const particles = Array.from({ length: 12 });

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
      {particles.map((_, i) => {
        const size = 4 + Math.random() * 10;
        const left = Math.random() * 100;
        const top = Math.random() * 100;
        const delay = Math.random() * 8;
        const isAccent = i % 2 === 0;

        return (
          <div
            key={i}
            className="particle absolute rounded-full"
            style={{
              width: size,
              height: size,
              left: `${left}%`,
              top: `${top}%`,
              background: isAccent
                ? 'rgba(167, 139, 250, 0.4)'
                : 'rgba(255, 93, 143, 0.4)',
              animationDelay: `${delay}s`,
              filter: 'blur(1px)',
            }}
          />
        );
      })}
    </div>
  );
}
