"use client";

interface SparklineProps {
  data: { timestamp: number; price: number }[];
  width?: number;
  height?: number;
  className?: string;
  showArea?: boolean;
  showLabels?: boolean;
}

export function Sparkline({
  data,
  width = 200,
  height = 48,
  className = "",
  showArea = false,
  showLabels = false,
}: SparklineProps) {
  if (data.length < 2) return null;

  const prices = data.map((d) => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice || 0.001;

  const padding = showLabels ? { top: 4, bottom: 16, left: 36, right: 8 } : { top: 2, bottom: 2, left: 2, right: 2 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartW;
    const y = padding.top + chartH - ((d.price - minPrice) / range) * chartH;
    return { x, y };
  });

  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = showArea
    ? `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)} ${points
        .slice(1)
        .map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(" ")} L${points[points.length - 1].x.toFixed(1)},${(
        padding.top + chartH
      ).toFixed(1)} L${points[0].x.toFixed(1)},${(padding.top + chartH).toFixed(1)} Z`
    : "";

  const isPositive = prices[prices.length - 1] >= prices[0];
  const strokeColor = isPositive ? "#059669" : "#dc2626";
  const fillColor = isPositive ? "#059669" : "#dc2626";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
    >
      {showArea && (
        <path d={areaPath} fill={fillColor} opacity={0.08} />
      )}
      <polyline
        points={polyline}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Current price dot */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r={2.5}
        fill={strokeColor}
      />
      {showLabels && (
        <>
          <text
            x={padding.left - 4}
            y={padding.top + 4}
            textAnchor="end"
            className="fill-muted-foreground"
            fontSize={9}
            fontFamily="monospace"
          >
            ${maxPrice.toFixed(3)}
          </text>
          <text
            x={padding.left - 4}
            y={padding.top + chartH}
            textAnchor="end"
            className="fill-muted-foreground"
            fontSize={9}
            fontFamily="monospace"
          >
            ${minPrice.toFixed(3)}
          </text>
          <text
            x={padding.left}
            y={height - 2}
            textAnchor="start"
            className="fill-muted-foreground"
            fontSize={8}
            fontFamily="monospace"
          >
            12h ago
          </text>
          <text
            x={width - padding.right}
            y={height - 2}
            textAnchor="end"
            className="fill-muted-foreground"
            fontSize={8}
            fontFamily="monospace"
          >
            now
          </text>
        </>
      )}
    </svg>
  );
}
