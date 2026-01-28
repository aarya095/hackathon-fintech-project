import { useEffect, useState } from "react";

interface TrustScoreProps {
  score: number; // 0 to 1
  label?: string;
}

export default function TrustScore({ score, label = "Payment Reliability" }: TrustScoreProps) {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    // Simple animation effect
    const timeout = setTimeout(() => {
      setDisplayScore(score);
    }, 100);
    return () => clearTimeout(timeout);
  }, [score]);

  const percentage = Math.round(displayScore * 100);
  
  // Color determination based on score
  let colorClass = "text-gray-400";
  let strokeClass = "stroke-gray-200";
  
  if (percentage >= 90) {
    colorClass = "text-emerald-600";
    strokeClass = "stroke-emerald-500";
  } else if (percentage >= 70) {
    colorClass = "text-teal-600";
    strokeClass = "stroke-teal-500";
  } else if (percentage >= 50) {
    colorClass = "text-amber-500";
    strokeClass = "stroke-amber-400";
  } else if (percentage > 0) {
    colorClass = "text-red-500";
    strokeClass = "stroke-red-400";
  }

  // SVG parameters
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (displayScore * circumference);

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="relative w-20 h-20 flex items-center justify-center">
        {/* Background Circle */}
        <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 80 80">
          <circle
            className="text-gray-100"
            strokeWidth="8"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx="40"
            cy="40"
          />
          {/* Progress Circle */}
          <circle
            className={`${strokeClass} transition-all duration-1000 ease-out`}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx="40"
            cy="40"
          />
        </svg>
        <span className={`absolute text-xl font-bold ${colorClass}`}>
          {percentage}%
        </span>
      </div>
      <p className="mt-2 text-sm font-medium text-gray-500">{label}</p>
    </div>
  );
}
