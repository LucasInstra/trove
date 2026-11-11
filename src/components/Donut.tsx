export interface DonutSegment {
  color: string;
  value: number;
}

export function Donut({
  segments,
  size = 148,
  thickness = 22,
  centerLabel,
  centerValue,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
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
          stroke="var(--bar-rest)"
          strokeWidth={thickness}
        />
      </svg>
    );
  }

  const lengths = segments.map((segment) => (Math.max(0, segment.value) / total) * circumference);
  // A round cap grows half a thickness past each end of its dash, so the gap has
  // to be at least that wide or neighbouring arcs overlap and a zero share is
  // drawn as a full dot.
  const gap = thickness + 2;
  const offsets = lengths.map((_, index) =>
    lengths.slice(0, index).reduce((sum, length) => sum + length, 0),
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={centerValue ? `${centerLabel ?? ""} ${centerValue}`.trim() : undefined}
      aria-hidden={centerValue ? undefined : true}
    >
      {segments.map((segment, index) => (
        <circle
          key={index}
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={segment.color}
          strokeWidth={thickness}
          strokeDasharray={`${Math.max(lengths[index] - gap, 0.1)} ${circumference}`}
          strokeDashoffset={-offsets[index]}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      ))}
      {centerValue ? (
        <text
          x={center}
          y={center + size * 0.035}
          textAnchor="middle"
          fill="var(--ink)"
          fontSize={Math.min(12, size * 0.09)}
          className="donut-center-value"
        >
          {centerValue}
        </text>
      ) : null}
      {centerLabel ? (
        <text
          x={center}
          y={center + size * 0.19}
          textAnchor="middle"
          fill="var(--muted)"
          fontSize={Math.min(9, size * 0.07)}
        >
          {centerLabel}
        </text>
      ) : null}
    </svg>
  );
}
