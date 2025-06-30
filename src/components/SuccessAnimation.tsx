import { useState, useEffect } from 'react';
import { soundManager } from '../lib/sounds';

interface SuccessAnimationProps {
  isActive: boolean;
  onAnimationComplete: () => void;
}

export default function SuccessAnimation({ isActive, onAnimationComplete }: SuccessAnimationProps) {
  const [beatIndex, setBeatIndex] = useState(0);
  const [totalBeats, setTotalBeats] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isActive) {
      setIsVisible(true);
      setBeatIndex(0);
      setTotalBeats(0);
    } else {
      // Hide immediately when not active
      setIsVisible(false);
      onAnimationComplete();
    }
  }, [isActive, onAnimationComplete]);

  const handleBeat = (beatIndex: number, totalBeats: number) => {
    setBeatIndex(beatIndex);
    setTotalBeats(totalBeats);
    
    // Hide animation when the last beat is reached
    if (beatIndex === totalBeats - 1) {
      setTimeout(() => {
        setIsVisible(false);
        onAnimationComplete();
      }, 100); // Small delay to show the last pose
    }
  };

  useEffect(() => {
    // Set up the beat callback
    soundManager.setBeatCallback(handleBeat);
  }, []);

  if (!isVisible) return null;

  // Dancing stickman poses - each pose is a different dance move
  const stickmanPoses = [
    // Pose 1: Arms up, legs apart
    "👨‍🦱",
    // Pose 2: One arm up, one down, legs together
    "🧍",
    // Pose 3: Arms out, one leg up
    "🕺",
    // Pose 4: Arms down, legs apart
    "👤",
    // Pose 5: Jumping pose
    "🤸",
    // Pose 6: Spinning pose
    "💃",
    // Pose 7: Victory pose
    "🏆",
    // Pose 8: Celebration pose
    "🎉",
    // Pose 9: Final pose
    "✨",
    // Pose 10: End pose
    "🌟"
  ];

  const currentPose = stickmanPoses[beatIndex] || stickmanPoses[0];

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Full screen overlay with pulsing animation */}
      <div 
        className={`absolute inset-0 transition-all duration-75 ease-out ${
          beatIndex < totalBeats 
            ? 'bg-green-500/20' 
            : 'bg-transparent'
        }`}
        style={{
          animation: beatIndex < totalBeats ? 'pulse 0.15s ease-out' : 'none'
        }}
      />
      
      {/* Radial pulse effect */}
      <div 
        className={`absolute inset-0 transition-all duration-100 ease-out ${
          beatIndex < totalBeats 
            ? 'bg-green-400/10' 
            : 'bg-transparent'
        }`}
        style={{
          transform: beatIndex < totalBeats ? 'scale(1.05)' : 'scale(1)',
          animation: beatIndex < totalBeats ? 'radialPulse 0.2s ease-out' : 'none'
        }}
      />
      
      {/* Dancing stickman in center */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div 
          className="text-6xl animate-bounce"
          style={{
            animation: 'dance 0.3s ease-in-out',
            animationIterationCount: 1
          }}
        >
          {currentPose}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes pulse {
            0% { opacity: 0; }
            50% { opacity: 1; }
            100% { opacity: 0; }
          }
          
          @keyframes radialPulse {
            0% { 
              transform: scale(1);
              opacity: 0.8;
            }
            50% { 
              transform: scale(1.1);
              opacity: 0.4;
            }
            100% { 
              transform: scale(1.2);
              opacity: 0;
            }
          }
          
          @keyframes dance {
            0% { transform: scale(1) rotate(0deg); }
            25% { transform: scale(1.2) rotate(-5deg); }
            50% { transform: scale(1.1) rotate(5deg); }
            75% { transform: scale(1.15) rotate(-3deg); }
            100% { transform: scale(1) rotate(0deg); }
          }
        `
      }} />
    </div>
  );
} 