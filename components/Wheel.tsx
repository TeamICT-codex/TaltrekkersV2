import React, { useState, useRef, useEffect } from 'react';
import { ReadingStrategyItem } from '../types';

interface WheelProps {
  items: ReadingStrategyItem[];
  onSpinEnd: (selectedItem: ReadingStrategyItem) => void;
}

const Wheel: React.FC<WheelProps> = ({ items, onSpinEnd }) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const wheelRef = useRef<HTMLDivElement>(null);
  const onSpinEndRef = useRef(onSpinEnd);

  // Keep the ref updated with the latest onSpinEnd callback
  useEffect(() => {
    onSpinEndRef.current = onSpinEnd;
  }, [onSpinEnd]);
  
  const segmentCount = items.length;
  const segmentAngle = 360 / segmentCount;
  const colorPalette = ['#9F86C0', '#2D7A7B', '#FFC75F', '#E07A5F', '#3D405B'];

  const conicGradient = items.map((_, index) => {
    const color = colorPalette[index % colorPalette.length];
    const startAngle = index * segmentAngle;
    const endAngle = (index + 1) * segmentAngle;
    return `${color} ${startAngle}deg ${endAngle}deg`;
  }).join(', ');

  useEffect(() => {
    const wheelElement = wheelRef.current;
    if (!wheelElement) return;

    const handleTransitionEnd = () => {
      // The pointer is at the top (0/360 deg). We need to find which segment is under it.
      // A positive rotation moves the wheel clockwise. A 30deg rotation means the 330deg mark is now at the top.
      const finalAngle = rotation % 360;
      const winningSegmentStartAngle = (360 - finalAngle) % 360;
      
      const winnerIndex = Math.floor(winningSegmentStartAngle / segmentAngle);
      
      setIsSpinning(false);
      // Use the ref to call the latest version of the callback
      onSpinEndRef.current(items[winnerIndex]);
    };

    wheelElement.addEventListener('transitionend', handleTransitionEnd);
    return () => {
      wheelElement.removeEventListener('transitionend', handleTransitionEnd);
    };
  }, [rotation, items, segmentAngle]);


  const spin = () => {
    if (isSpinning) return;

    const randomSegment = Math.floor(Math.random() * segmentCount);
    // Calculate the angle to land in the middle of the random segment
    const targetAngle = (randomSegment * segmentAngle) + (segmentAngle / 2);

    // Add multiple full rotations for visual effect. 5 to 8 rotations.
    const fullRotations = Math.floor(Math.random() * 4) + 5;
    
    // The final rotation value. We rotate so the target segment lands at the top.
    const spinAmount = (fullRotations * 360) + (360 - targetAngle);

    setIsSpinning(true);
    // Add to the previous rotation value to make spins cumulative and feel more natural
    setRotation(rotation + spinAmount);
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-8 p-4">
      <div className="relative w-72 h-72 md:w-96 md:h-96">
        {/* Pointer */}
        <div 
          className="absolute left-1/2 -translate-x-1/2 top-[-10px] z-20"
          style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.5))' }}
        >
          <div className="w-0 h-0 
            border-l-[15px] border-l-transparent
            border-r-[15px] border-r-transparent
            border-t-[25px] border-t-tal-gold">
          </div>
        </div>

        {/* Wheel Container */}
        <div
          ref={wheelRef}
          className="relative w-full h-full rounded-full transition-transform duration-[5000ms] ease-out"
          style={{ 
            transform: `rotate(${rotation}deg)`,
            background: `conic-gradient(${conicGradient})`,
            boxShadow: '0 0 25px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.4)',
            border: '8px solid var(--color-tal-teal-dark)'
          }}
        >
          {/* Numbers */}
          <div className="absolute inset-0">
            {items.map((_, index) => {
                const angle = index * segmentAngle + segmentAngle / 2;
                return (
                    <div
                        key={index}
                        className="absolute top-0 left-0 w-full h-full"
                        style={{ transform: `rotate(${angle}deg)` }}
                    >
                        <div className="w-full h-1/2 flex justify-center items-start pt-6 md:pt-8"> 
                            <span 
                                className="text-white font-bold text-3xl md:text-4xl"
                                style={{ 
                                    transform: `rotate(-${angle}deg)`, // Rotate the number back to be upright
                                    textShadow: '2px 2px 4px rgba(0,0,0,0.7)'
                                }}
                            >
                                {index + 1}
                            </span>
                        </div>
                    </div>
                );
            })}
          </div>
        </div>
        
        {/* Center Hub */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-tal-teal-dark border-4 border-tal-purple shadow-inner z-10 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full bg-black/50 shadow-inner"></div>
        </div>
      </div>
      
      <button
        onClick={spin}
        disabled={isSpinning}
        className="px-8 py-4 bg-tal-gold text-tal-teal-dark font-bold text-lg rounded-xl shadow-lg hover:opacity-90 transform hover:scale-105 active:scale-100 transition-all duration-300 disabled:bg-slate-500 disabled:cursor-not-allowed disabled:scale-100"
      >
        {isSpinning ? 'Draaien...' : 'Draai aan het rad!'}
      </button>
    </div>
  );
};

export default Wheel;