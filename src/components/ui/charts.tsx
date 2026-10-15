import * as React from 'react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

// Types
interface ChartDataPoint {
  label: string
  value: number
  color?: string
  tooltipLabel?: string
}

interface BaseChartProps {
  data: ChartDataPoint[]
  height?: number
  showLegend?: boolean
  showValues?: boolean
  animate?: boolean
  className?: string
  valueFormatter?: (value: number) => string
}

// Color palette for charts
const chartColors = [
  'hsl(221, 83%, 53%)', // Blue
  'hsl(142, 71%, 45%)', // Green
  'hsl(262, 83%, 58%)', // Purple
  'hsl(25, 95%, 53%)', // Orange
  'hsl(349, 89%, 60%)', // Pink
  'hsl(47, 96%, 53%)', // Yellow
  'hsl(199, 89%, 48%)', // Cyan
  'hsl(315, 72%, 55%)', // Magenta
]

// Bar Chart
interface BarChartProps extends BaseChartProps {
  horizontal?: boolean
  barWidth?: number
  gap?: number
}

export const BarChart = ({
  data,
  height = 300,
  horizontal = false,
  showValues = true,
  showLegend = true,
  animate = true,
  className,
  valueFormatter,
}: BarChartProps) => {
  const maxValue = Math.max(...data.map((d) => d.value), 0)
  const safeMaxValue = maxValue > 0 ? maxValue : 1
  const coloredData = data.map((d, i) => ({
    ...d,
    color: d.color || chartColors[i % chartColors.length],
  }))
  const formatValue = (value: number) =>
    valueFormatter ? valueFormatter(value) : value.toLocaleString()

  if (horizontal) {
    return (
      <div className={cn('space-y-3', className)}>
        {coloredData.map((item, index) => (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span
                className="min-w-0 truncate text-foreground font-medium"
                title={item.tooltipLabel || item.label}
              >
                {item.label}
              </span>
              {showValues && (
                <span className="shrink-0 text-muted-foreground">
                  {formatValue(item.value)}
                </span>
              )}
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: item.color }}
                initial={animate ? { width: 0 } : undefined}
                animate={{ width: `${(item.value / safeMaxValue) * 100}%` }}
                transition={{ duration: 0.8, delay: index * 0.1, ease: 'easeOut' }}
              />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col', className)} style={{ height }}>
      <div className="flex-1 flex items-end gap-2 pb-2">
        {coloredData.map((item, index) => (
          <div
            key={item.label}
            className="flex-1 flex flex-col items-center justify-end gap-1"
            title={item.tooltipLabel || item.label}
          >
            {showValues && (
              <span className="text-xs text-muted-foreground font-medium">
                {formatValue(item.value)}
              </span>
            )}
            <motion.div
              className="w-full rounded-t-md min-h-[4px]"
              style={{ backgroundColor: item.color }}
              initial={animate ? { height: 0 } : undefined}
              animate={{ height: `${(item.value / safeMaxValue) * 100}%` }}
              transition={{ duration: 0.8, delay: index * 0.1, ease: 'easeOut' }}
            />
          </div>
        ))}
      </div>
      {showLegend && (
        <div className="flex gap-2 pt-2 border-t border-border">
          {coloredData.map((item) => (
            <div
              key={item.label}
              className="flex-1 text-center text-xs text-muted-foreground truncate"
              title={item.tooltipLabel || item.label}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface GroupedBarSeries {
  key: string
  label: string
  color: string
}

interface GroupedBarDatum {
  label: string
  tooltipLabel?: string
  values: Record<string, number>
}

interface GroupedBarChartProps {
  data: GroupedBarDatum[]
  series: GroupedBarSeries[]
  height?: number
  animate?: boolean
  className?: string
  valueFormatter?: (value: number) => string
  variant?: 'default' | 'analytics'
}

export const GroupedBarChart = ({
  data,
  series,
  height = 300,
  animate = true,
  className,
  valueFormatter,
  variant = 'default',
}: GroupedBarChartProps) => {
  const maxValue = Math.max(
    ...data.flatMap((d) => series.map((s) => d.values[s.key] ?? 0)),
    0
  )
  const safeMaxValue = maxValue > 0 ? maxValue : 1
  const formatValue = (value: number) =>
    valueFormatter ? valueFormatter(value) : value.toLocaleString()

  if (variant === 'analytics') {
    const roughStep = safeMaxValue / 4
    const magnitude = 10 ** Math.floor(Math.log10(roughStep))
    const residual = roughStep / magnitude
    const stepMultiplier = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10
    const step = stepMultiplier * magnitude
    const scaleMax = Math.ceil(safeMaxValue / step) * step
    const tickCount = Math.round(scaleMax / step) + 1
    const ticks = Array.from({ length: tickCount }, (_, index) => scaleMax - step * index)
    const chartMinWidth = Math.max(560, data.length * 52)

    return (
      <div className={cn('flex flex-col gap-4', className)}>
        <div className="flex flex-wrap items-center gap-2">
          {series.map((item) => (
            <div
              key={item.key}
              className="flex items-center gap-2 rounded-full border border-border/70 bg-muted/30 px-3 py-1.5 text-xs font-medium text-foreground"
            >
              <span
                className="h-2.5 w-2.5 rounded-full shadow-sm"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </div>
          ))}
        </div>

        <div className="overflow-x-auto pb-1">
          <div
            className="flex flex-col"
            style={{ height, minWidth: chartMinWidth }}
          >
            <div className="flex min-h-0 flex-1">
              <div className="flex w-12 shrink-0 flex-col justify-between pb-px pr-3 text-right text-[10px] tabular-nums text-muted-foreground sm:text-xs">
                {ticks.map((tick) => (
                  <span key={tick}>{formatValue(tick)}</span>
                ))}
              </div>

              <div className="relative min-w-0 flex-1 border-b border-l border-border/80">
                <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                  {ticks.map((tick) => (
                    <span
                      key={tick}
                      className="block w-full border-t border-dashed border-border/60 first:border-solid"
                    />
                  ))}
                </div>

                <div className="absolute inset-0 flex items-end gap-1 px-2 sm:gap-2 sm:px-3">
                  {data.map((item, index) => (
                    <div
                      key={item.label}
                      tabIndex={0}
                      className="group relative flex h-full min-w-0 flex-1 items-end justify-center gap-1 outline-none sm:gap-1.5"
                      aria-label={item.tooltipLabel || item.label}
                    >
                      <div
                        className={cn(
                          'pointer-events-none absolute top-3 z-30 w-max min-w-40 rounded-lg border border-border/80 bg-popover/95 p-3 text-popover-foreground opacity-0 shadow-xl backdrop-blur-sm transition-all duration-150 group-hover:-translate-y-1 group-hover:opacity-100 group-focus:-translate-y-1 group-focus:opacity-100',
                          index === 0
                            ? 'left-0'
                            : index === data.length - 1
                              ? 'right-0'
                              : 'left-1/2 -translate-x-1/2 group-hover:-translate-x-1/2 group-focus:-translate-x-1/2'
                        )}
                      >
                        <div className="mb-2 text-xs font-semibold">
                          {item.tooltipLabel || item.label}
                        </div>
                        <div className="space-y-1.5">
                          {series.map((entry) => (
                            <div
                              key={entry.key}
                              className="flex items-center justify-between gap-5 text-xs"
                            >
                              <span className="flex items-center gap-2 text-muted-foreground">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: entry.color }}
                                />
                                {entry.label}
                              </span>
                              <span className="font-semibold tabular-nums">
                                {formatValue(item.values[entry.key] ?? 0)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {series.map((entry) => {
                        const value = item.values[entry.key] ?? 0
                        return (
                          <motion.div
                            key={entry.key}
                            className="relative min-h-[3px] w-full max-w-7 rounded-t-md shadow-sm transition-[filter,opacity] duration-200 group-hover:brightness-105"
                            style={{
                              background: `linear-gradient(180deg, color-mix(in srgb, ${entry.color} 70%, white) 0%, ${entry.color} 100%)`,
                            }}
                            initial={animate ? { height: 0, opacity: 0.5 } : undefined}
                            animate={{
                              height: `${(value / scaleMax) * 100}%`,
                              opacity: 1,
                            }}
                            transition={{
                              duration: 0.65,
                              delay: index * 0.04,
                              ease: 'easeOut',
                            }}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 gap-1 pl-12 pt-2 sm:gap-2">
              {data.map((item) => (
                <div
                  key={item.label}
                  className="min-w-0 flex-1 truncate text-center text-[10px] font-medium text-muted-foreground sm:text-xs"
                  title={item.tooltipLabel || item.label}
                >
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            {s.label}
          </div>
        ))}
      </div>

      <div className="flex flex-col" style={{ height }}>
        <div className="flex flex-1 items-end gap-1 border-b border-border pb-0 sm:gap-2">
          {data.map((item, index) => (
            <div
              key={item.label}
              className="flex flex-1 items-end justify-center gap-[2px] sm:gap-1"
            >
              {series.map((s) => {
                const value = item.values[s.key] ?? 0
                return (
                  <motion.div
                    key={s.key}
                    className="w-full min-h-[2px] rounded-t-sm"
                    style={{ backgroundColor: s.color }}
                    title={`${item.tooltipLabel || item.label} — ${s.label}: ${formatValue(value)}`}
                    initial={animate ? { height: 0 } : undefined}
                    animate={{ height: `${(value / safeMaxValue) * 100}%` }}
                    transition={{
                      duration: 0.6,
                      delay: index * 0.04,
                      ease: 'easeOut',
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>

        <div className="flex gap-1 pt-2 sm:gap-2">
          {data.map((item) => (
            <div
              key={item.label}
              className="flex-1 truncate text-center text-[10px] text-muted-foreground sm:text-xs"
              title={item.tooltipLabel || item.label}
            >
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Donut/Pie Chart
interface DonutChartProps extends BaseChartProps {
  donut?: boolean
  strokeWidth?: number
  size?: number
  centerLabel?: string
  centerValue?: string | number
}

export const DonutChart = ({
  data,
  donut = true,
  strokeWidth = 40,
  size = 200,
  centerLabel,
  centerValue,
  showLegend = true,
  animate = true,
  className,
}: DonutChartProps) => {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const safeTotal = total > 0 ? total : 1
  const coloredData = data.map((d, i) => ({
    ...d,
    color: d.color || chartColors[i % chartColors.length],
  }))

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  let currentOffset = 0

  return (
    <div className={cn('flex items-center gap-6', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted"
          />
          {/* Data segments */}
          {total > 0 &&
            coloredData.map((item, index) => {
              const percentage = item.value / safeTotal
            const strokeDasharray = circumference
            const strokeDashoffset = circumference * (1 - percentage)
            const offset = currentOffset
            currentOffset += percentage * circumference

            return (
              <motion.circle
                key={item.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{
                  transformOrigin: 'center',
                  transform: `rotate(${(offset / circumference) * 360}deg)`,
                }}
                initial={animate ? { strokeDashoffset: circumference } : undefined}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1, delay: index * 0.15, ease: 'easeOut' }}
              />
            )
            })}
        </svg>
        {/* Center content */}
        {donut && (centerLabel || centerValue) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {centerValue && (
              <span className="text-xl sm:text-2xl font-bold text-foreground">
                {typeof centerValue === 'number' ? centerValue.toLocaleString() : centerValue}
              </span>
            )}
            {centerLabel && (
              <span className="text-xs sm:text-sm text-muted-foreground">{centerLabel}</span>
            )}
          </div>
        )}
      </div>
      {showLegend && (
        <div className="flex flex-col gap-2">
          {coloredData.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <span className="text-sm font-medium text-foreground ml-auto">
                {item.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Line Chart
interface LineChartProps extends BaseChartProps {
  curved?: boolean
  showDots?: boolean
  showArea?: boolean
  gridLines?: boolean
  startFromZero?: boolean
}

export const LineChart = ({
  data,
  height = 200,
  curved = true,
  showDots = true,
  showArea = true,
  showLegend = true,
  gridLines = true,
  startFromZero = false,
  animate = true,
  className,
}: LineChartProps) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [selectedPointIndex, setSelectedPointIndex] = React.useState<number | null>(
    null
  )
  const [containerWidth, setContainerWidth] = React.useState(400)

  React.useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const updateWidth = () => {
      const nextWidth = container.clientWidth

      if (nextWidth > 0) {
        setContainerWidth(nextWidth)
      }
    }

    updateWidth()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth)
      return () => window.removeEventListener('resize', updateWidth)
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]

      if (entry && entry.contentRect.width > 0) {
        setContainerWidth(entry.contentRect.width)
      }
    })

    observer.observe(container)

    return () => observer.disconnect()
  }, [])

  if (!data || data.length === 0) {
    return (
      <div ref={containerRef} className={cn('w-full', className)} style={{ height }} />
    )
  }

  const horizontalPadding = 40
  const topPadding = 24
  const labelHeight = showLegend ? 34 : 0
  const bottomPadding = 12
  const width = containerWidth
  const chartWidth = Math.max(width - horizontalPadding * 2, 1)
  const chartHeight = height - topPadding - bottomPadding - labelHeight
  const baselineY = topPadding + chartHeight

  const maxValue = Math.max(...data.map((d) => d.value), 0)
  const minValue = startFromZero
    ? Math.min(0, ...data.map((d) => d.value))
    : Math.min(...data.map((d) => d.value))
  const valueRange = maxValue - minValue || 1

  const points = data.map((d, i) => ({
    x: horizontalPadding + ((data.length === 1 ? 0 : i / (data.length - 1)) * chartWidth),
    y: topPadding + chartHeight - ((d.value - minValue) / valueRange) * chartHeight,
    ...d,
  }))

  const pathD = points
    .map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`
      if (curved) {
        const prev = points[i - 1]
        const cpx = (prev.x + p.x) / 2
        return `C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`
      }
      return `L ${p.x} ${p.y}`
    })
    .join(' ')

  const areaD =
    pathD +
    ` L ${points[points.length - 1].x} ${baselineY} L ${horizontalPadding} ${baselineY} Z`

  return (
    <div ref={containerRef} className={cn('w-full', className)}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {gridLines && (
          <g className="text-muted">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
              <line
                key={ratio}
                x1={horizontalPadding}
                y1={topPadding + chartHeight * ratio}
                x2={width - horizontalPadding}
                y2={topPadding + chartHeight * ratio}
                stroke="currentColor"
                strokeWidth={1}
                strokeDasharray="4 4"
                opacity={0.3}
              />
            ))}
          </g>
        )}
        
        {/* Area fill */}
        {showArea && (
          <motion.path
            d={areaD}
            fill="url(#gradient)"
            initial={animate ? { opacity: 0 } : undefined}
            animate={{ opacity: 0.2 }}
            transition={{ duration: 0.8, delay: 0.35 }}
          />
        )}
        
        {/* Gradient definition */}
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        
        {/* Line */}
        <motion.path
          d={pathD}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={animate ? { pathLength: 0 } : undefined}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2.2, ease: 'easeInOut' }}
        />
        
        {/* Dots */}
        {showDots &&
          points.map((point, i) => (
            <motion.circle
              key={i}
              cx={point.x}
              cy={point.y}
              r={selectedPointIndex === i ? 6 : 5}
              fill="hsl(var(--background))"
              stroke="hsl(var(--primary))"
              strokeWidth={selectedPointIndex === i ? 3 : 2}
              className="cursor-pointer"
              onMouseEnter={() => setSelectedPointIndex(i)}
              onMouseLeave={() => setSelectedPointIndex(null)}
              onClick={() => setSelectedPointIndex(i)}
              initial={animate ? { scale: 0 } : undefined}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, delay: 1.1 + i * 0.12 }}
            />
          ))}

        {/* X-axis labels */}
        {showLegend && (
          <g className="text-muted-foreground" fill="currentColor">
            {points.map((point, index) => (
              <text
                key={`${point.x}-${point.label}-${index}`}
                x={point.x}
                y={height - 10}
                textAnchor="middle"
                fontSize="12"
              >
                {point.label}
              </text>
            ))}
          </g>
        )}
      </svg>

      {selectedPointIndex !== null && data[selectedPointIndex] && (
        <div className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <div className="font-medium text-foreground">
            {data[selectedPointIndex].tooltipLabel || data[selectedPointIndex].label}
          </div>
          <div className="text-muted-foreground">
            {data[selectedPointIndex].value.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  )
}

// Stats Card
interface StatsCardProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon?: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}

export const StatsCard = ({
  title,
  value,
  change,
  changeLabel = 'from last period',
  icon,
  trend = 'neutral',
  className,
}: StatsCardProps) => {
  const trendColors = {
    up: 'text-green-600 dark:text-green-400',
    down: 'text-red-600 dark:text-red-400',
    neutral: 'text-muted-foreground',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'p-4 sm:p-6 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2 min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground break-words">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {change !== undefined && (
            <div className={cn('flex items-center gap-1 text-sm', trendColors[trend])}>
              {trend === 'up' && '↑'}
              {trend === 'down' && '↓'}
              <span className="font-medium">
                {change > 0 ? '+' : ''}
                {change}%
              </span>
              <span className="text-muted-foreground">{changeLabel}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="p-3 rounded-lg bg-primary/10 text-primary">{icon}</div>
        )}
      </div>
    </motion.div>
  )
}

// Mini Sparkline
interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  className?: string
}

export const Sparkline = ({
  data,
  width = 80,
  height = 24,
  color = 'hsl(var(--primary))',
  className,
}: SparklineProps) => {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  const points = data
    .map((value, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - ((value - min) / range) * height
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} className={className}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
