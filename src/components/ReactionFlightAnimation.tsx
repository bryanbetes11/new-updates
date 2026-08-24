import { motion } from 'framer-motion';

export interface ReactionFlightPath {
  emoji: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export function ReactionFlightAnimation({
  flight,
  onComplete,
  fixed = false,
}: {
  flight: ReactionFlightPath;
  onComplete: () => void;
  fixed?: boolean;
}) {
  const deltaX = flight.to.x - flight.from.x;
  const deltaY = flight.to.y - flight.from.y;
  const flightX = [flight.from.x - 14, flight.from.x + deltaX * 0.48 - 14, flight.to.x - 14];
  const flightY = [flight.from.y - 14, flight.from.y + deltaY * 0.32 - 34, flight.to.y - 14];
  const landingParticles = [
    { x: -17, y: -13 },
    { x: 1, y: -21 },
    { x: 18, y: -10 },
    { x: 16, y: 10 },
    { x: -14, y: 12 },
  ];

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none inset-0 z-[2147483647] overflow-visible ${fixed ? 'fixed' : 'absolute'}`}
    >
      {[0.08, 0.14].map((delay, index) => (
        <motion.span
          key={delay}
          initial={{ x: flightX[0], y: flightY[0], opacity: 0, scale: 0.55 }}
          animate={{
            x: flightX,
            y: flightY,
            opacity: [0, 0.2 - index * 0.06, 0],
            scale: [0.55, 0.85, 0.4],
          }}
          transition={{ duration: 0.57, delay, times: [0, 0.48, 1], ease: [0.16, 1, 0.3, 1] }}
          className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center text-lg blur-[0.4px]"
        >
          {flight.emoji}
        </motion.span>
      ))}

      <motion.span
        initial={{ x: flight.from.x - 14, y: flight.from.y - 14, opacity: 0, scale: 0.7, rotate: -8 }}
        animate={{
          x: flightX,
          y: flightY,
          opacity: [0, 1, 1, 0],
          scale: [0.7, 1.35, 1.05, 0.46],
          rotate: [-10, 11, -4, 0],
        }}
        transition={{ duration: 0.7, times: [0, 0.48, 0.88, 1], ease: [0.16, 1, 0.3, 1] }}
        onAnimationComplete={onComplete}
        className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center text-xl drop-shadow-[0_8px_12px_rgba(0,0,0,0.62)]"
      >
        {flight.emoji}
      </motion.span>

      <motion.span
        initial={{ x: flight.to.x - 15, y: flight.to.y - 15, opacity: 0, scale: 0.25 }}
        animate={{ opacity: [0, 0.8, 0], scale: [0.25, 1.05, 1.8] }}
        transition={{ duration: 0.34, delay: 0.48, ease: 'easeOut' }}
        className="absolute left-0 top-0 h-[30px] w-[30px] rounded-full border-2 border-[#7cffaa]/75 shadow-[0_0_14px_rgba(30,215,96,0.45)]"
      />

      {landingParticles.map((particle, index) => (
        <motion.span
          key={`${particle.x}-${particle.y}`}
          initial={{ x: flight.to.x - 2, y: flight.to.y - 2, opacity: 0, scale: 0.35 }}
          animate={{
            x: flight.to.x + particle.x,
            y: flight.to.y + particle.y,
            opacity: [0, 0.95, 0],
            scale: [0.35, 1, 0.25],
          }}
          transition={{ duration: 0.34, delay: 0.48 + index * 0.015, ease: 'easeOut' }}
          className="absolute left-0 top-0 h-1 w-1 rounded-full bg-[#9dffbd] shadow-[0_0_7px_rgba(124,255,170,0.95)]"
        />
      ))}
    </div>
  );
}
