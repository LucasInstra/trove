export interface DonutSegment {
  color: string;
  value: number;
}

export function Donut({
  segments,
  size = 148,
  thickness = 18,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  const center = size / 2;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  if (total <= 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#ece8e1"
          strokeWidth={thickness}
        />
      </svg>
    );
  }

  const lengths = segments.map(
    (segment) => (Math.max(0, segment.value) / total) * circumference,
  );
  const offsets = lengths.map((_, index) =>
    lengths.slice(0, index).reduce((sum, length) => sum + length, 0),
  );

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {segments.map((segment, index) => (
        <circle
          key={index}
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={segment.color}
          strokeWidth={thickness}
          strokeDasharray={`${Math.max(lengths[index] - 2, 0.6)} ${circumference}`}
          strokeDashoffset={-offsets[index]}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      ))}
    </svg>
  );
}
