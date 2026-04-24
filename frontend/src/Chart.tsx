import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Line, Polyline, Circle, Rect, G, Text as SvgText } from 'react-native-svg';
import { useTheme } from './ThemeContext';

export interface ChartPoint { x: number; y: number }

interface Props {
  width: number;
  height: number;
  data: ChartPoint[];
  strokeColor?: string;
  xLabel?: string;
  yLabel?: string;
  showGrid?: boolean;
  overlay?: { data: ChartPoint[]; color: string }[];
  scatter?: { data: ChartPoint[]; color: string }[];
  fitFn?: (x: number) => number; // optional best-fit curve overlay
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
  testID?: string;
}

export function Chart({
  width,
  height,
  data,
  strokeColor,
  xLabel,
  yLabel,
  showGrid = true,
  overlay = [],
  scatter = [],
  fitFn,
  minX,
  maxX,
  minY,
  maxY,
  testID,
}: Props) {
  const { colors } = useTheme();
  const padL = 44;
  const padB = 30;
  const padT = 12;
  const padR = 12;
  const w = width - padL - padR;
  const h = height - padT - padB;

  const all = [...data, ...overlay.flatMap((o) => o.data), ...scatter.flatMap((s) => s.data)];
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const mnX = minX ?? (xs.length ? Math.min(...xs) : 0);
  const mxX = maxX ?? (xs.length ? Math.max(...xs) : 1);
  const mnY = minY ?? (ys.length ? Math.min(...ys) : 0);
  const mxY = maxY ?? (ys.length ? Math.max(...ys) : 1);
  const rangeX = mxX - mnX || 1;
  const rangeY = mxY - mnY || 1;

  const sx = (x: number) => padL + ((x - mnX) / rangeX) * w;
  const sy = (y: number) => padT + h - ((y - mnY) / rangeY) * h;

  const lineToPts = (pts: ChartPoint[]) => pts.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ');

  const gridLines = 4;
  const gridColor = colors.border;
  const axis = colors.textSecondary;

  const fitPts: ChartPoint[] = [];
  if (fitFn) {
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const x = mnX + (rangeX * i) / steps;
      fitPts.push({ x, y: fitFn(x) });
    }
  }

  return (
    <View testID={testID}>
      <Svg width={width} height={height}>
        <Rect x={padL} y={padT} width={w} height={h} fill="transparent" stroke={gridColor} strokeWidth={1} />
        {showGrid &&
          Array.from({ length: gridLines }).map((_, i) => {
            const y = padT + (h * (i + 1)) / (gridLines + 1);
            const x = padL + (w * (i + 1)) / (gridLines + 1);
            const yVal = mxY - (rangeY * (i + 1)) / (gridLines + 1);
            const xVal = mnX + (rangeX * (i + 1)) / (gridLines + 1);
            return (
              <G key={i}>
                <Line x1={padL} y1={y} x2={padL + w} y2={y} stroke={gridColor} strokeDasharray="4,4" strokeOpacity={0.5} />
                <Line x1={x} y1={padT} x2={x} y2={padT + h} stroke={gridColor} strokeDasharray="4,4" strokeOpacity={0.5} />
                <SvgText x={padL - 6} y={y + 3} fill={axis} fontSize={9} textAnchor="end">
                  {yVal.toFixed(2)}
                </SvgText>
                <SvgText x={x} y={padT + h + 14} fill={axis} fontSize={9} textAnchor="middle">
                  {xVal.toFixed(1)}
                </SvgText>
              </G>
            );
          })}
        {/* axis bounds labels */}
        <SvgText x={padL - 6} y={padT + 6} fill={axis} fontSize={9} textAnchor="end">
          {mxY.toFixed(2)}
        </SvgText>
        <SvgText x={padL - 6} y={padT + h + 3} fill={axis} fontSize={9} textAnchor="end">
          {mnY.toFixed(2)}
        </SvgText>
        <SvgText x={padL} y={padT + h + 14} fill={axis} fontSize={9} textAnchor="middle">
          {mnX.toFixed(1)}
        </SvgText>
        <SvgText x={padL + w} y={padT + h + 14} fill={axis} fontSize={9} textAnchor="middle">
          {mxX.toFixed(1)}
        </SvgText>

        {overlay.map((o, i) => (
          <Polyline key={`ov-${i}`} points={lineToPts(o.data)} fill="none" stroke={o.color} strokeWidth={1.5} strokeOpacity={0.6} />
        ))}
        {data.length > 1 && (
          <Polyline points={lineToPts(data)} fill="none" stroke={strokeColor || colors.primary} strokeWidth={2} />
        )}
        {fitFn && fitPts.length > 0 && (
          <Polyline points={lineToPts(fitPts)} fill="none" stroke={colors.primary} strokeWidth={1.5} strokeDasharray="3,3" />
        )}
        {scatter.map((s, si) =>
          s.data.map((p, pi) => (
            <Circle key={`sc-${si}-${pi}`} cx={sx(p.x)} cy={sy(p.y)} r={4} fill={s.color} />
          )),
        )}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 10, letterSpacing: 1 }}>{yLabel?.toUpperCase()}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 10, letterSpacing: 1 }}>{xLabel?.toUpperCase()}</Text>
      </View>
    </View>
  );
}
