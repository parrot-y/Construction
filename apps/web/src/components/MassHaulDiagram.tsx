import React from 'react';
import type { CrossSectionStationRecord } from './TopographicSurveyView';

const MassHaulDiagramSvg: React.FC<{ stations: CrossSectionStationRecord[] }> = ({ stations }) => {
    if (stations.length< 2) return null;

    const svgWidth = 840;
    const svgHeight = 280;
    const padLeft = 80;
    const padRight = 40;
    const padTop = 30;
    const padBottom = 45;

    const plotWidth = svgWidth - padLeft - padRight;
    const plotHeight = svgHeight - padTop - padBottom;

    const chainageValues = stations.map((s) => Number(s.chainageMeters));
    const massValues = stations.map((s) => Number(s.cumulativeMassOrdinateM3 ?? 0));

    const minX = Math.min(...chainageValues);
    const maxX = Math.max(...chainageValues);
    const rawMinY = Math.min(...massValues);
    const rawMaxY = Math.max(...massValues);

    const spanY = Math.max(100, Math.max(Math.abs(rawMinY), Math.abs(rawMaxY)) * 1.2);
    const minY = -spanY;
    const maxY = spanY;

    const scaleX = (x: number) => padLeft + ((x - minX) / (maxX - minX || 1)) * plotWidth;
    const scaleY = (y: number) => padTop + ((maxY - y) / (maxY - minY || 1)) * plotHeight;

    const zeroY = scaleY(0);

    const points = stations.map((s) => ({
      x: scaleX(Number(s.chainageMeters)),
      y: scaleY(Number(s.cumulativeMassOrdinateM3 ?? 0)),
      chainage: Number(s.chainageMeters),
      mass: Number(s.cumulativeMassOrdinateM3 ?? 0),
      label: s.chainageLabel,
}));

    const pathD = points.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
}, '');

    // Cut surplus area (above 0 line)
    const cutAreaPath = points.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${Math.min(zeroY, pt.y)}` : `${acc} L ${pt.x} ${Math.min(zeroY, pt.y)}`;
}, '') + ` L ${points[points.length - 1]!.x} ${zeroY} L ${points[0]!.x} ${zeroY} Z`;

    // Fill deficit area (below 0 line)
    const fillAreaPath = points.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${Math.max(zeroY, pt.y)}` : `${acc} L ${pt.x} ${Math.max(zeroY, pt.y)}`;
}, '') + ` L ${points[points.length - 1]!.x} ${zeroY} L ${points[0]!.x} ${zeroY} Z`;

    // Detect balance points (crossing zero)
    const balancePoints: Array<{ x: number; y: number; chainageApprox: number}> = [];
    for (let i = 0; i< points.length - 1; i++) {
      const p1 = points[i]!;
      const p2 = points[i + 1]!;
      if ((p1.mass<= 0 && p2.mass >= 0) || (p1.mass >= 0 && p2.mass<= 0)) {
        if (p1.mass !== p2.mass) {
          const t = (0 - p1.mass) / (p2.mass - p1.mass);
          const crossX = p1.x + t * (p2.x - p1.x);
          const crossCh = p1.chainage + t * (p2.chainage - p1.chainage);
          balancePoints.push({ x: crossX, y: zeroY, chainageApprox: crossCh});
}
}
}

    return (
<svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-auto max-h-[320px] overflow-visible font-sans select-none"
        aria-label="Mass Haul Diagram"
      >
<defs>
<linearGradient id="cutSurplusGrad" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
<stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
</linearGradient>
<linearGradient id="fillDeficitGrad" x1="0" y1="1" x2="0" y2="0">
<stop offset="0%" stopColor="#f43f5e" stopOpacity="0.35" />
<stop offset="100%" stopColor="#f43f5e" stopOpacity="0.05" />
</linearGradient>
</defs>

        {/* Background Grid */}
<line
          x1={padLeft}
          y1={scaleY(maxY * 0.5)}
          x2={svgWidth - padRight}
          y2={scaleY(maxY * 0.5)}
          stroke="#e2e8f0"
          strokeDasharray="4 4"
        />
<line
          x1={padLeft}
          y1={scaleY(minY * 0.5)}
          x2={svgWidth - padRight}
          y2={scaleY(minY * 0.5)}
          stroke="#e2e8f0"
          strokeDasharray="4 4"
        />

        {/* Shaded Cut Surplus Area */}
<path d={cutAreaPath} fill="url(#cutSurplusGrad)" />

        {/* Shaded Fill Deficit Area */}
<path d={fillAreaPath} fill="url(#fillDeficitGrad)" />

        {/* Zero Datum Axis */}
<line
          x1={padLeft}
          y1={zeroY}
          x2={svgWidth - padRight}
          y2={zeroY}
          stroke="#0f172a"
          strokeWidth="1.5"
          strokeDasharray="6 3"
        />
<text
          x={padLeft - 10}
          y={zeroY + 4}
          textAnchor="end"
          className="text-[10px] tabular-nums fill-slate-700 font-bold"
        >
          0 m³ (Datum)
</text>

        {/* Y Axis Max & Min labels */}
<text
          x={padLeft - 10}
          y={padTop + 10}
          textAnchor="end"
          className="text-[10px] tabular-nums fill-emerald-600 font-semibold"
        >
          +{Math.round(maxY)} m³
</text>
<text
          x={padLeft - 10}
          y={svgHeight - padBottom}
          textAnchor="end"
          className="text-[10px] tabular-nums fill-rose-600 font-semibold"
        >
          {Math.round(minY)} m³
</text>

        {/* Mass Haul Curve Line */}
<path d={pathD} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />

        {/* Station Nodes & Balance Points */}
        {points.map((pt, idx) => (
<g key={`station-${idx}`}>
<circle cx={pt.x} cy={pt.y} r="4" fill="#1d4ed8" stroke="#ffffff" strokeWidth="1.5" />
            {/* Station chainage tick */}
<line x1={pt.x} y1={zeroY - 4} x2={pt.x} y2={zeroY + 4} stroke="#64748b" strokeWidth="1" />
<text
              x={pt.x}
              y={svgHeight - padBottom + 18}
              textAnchor="middle"
              className="text-[10px] tabular-nums fill-slate-600"
            >
              {pt.label}
</text>
</g>
))}

        {/* Balance Points with markers */}
        {balancePoints.map((bp, bIdx) => (
<g key={`bp-${bIdx}`}>
<circle cx={bp.x} cy={bp.y} r="5" fill="#f59e0b" stroke="#78350f" strokeWidth="1.5" />
<text
              x={bp.x}
              y={bp.y - 10}
              textAnchor="middle"
              className="text-[9px] font-bold tabular-nums fill-amber-700 bg-white"
            >
              BP Ch {Math.round(bp.chainageApprox)}m
</text>
</g>
))}
</svg>
);
};

export const MassHaulDiagramCard: React.FC<{ stations: CrossSectionStationRecord[] }> = ({ stations }) => (
<div className="border border-slate-200 rounded-2xl p-5 bg-white space-y-3">
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
<div>
<h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
<span></span>
<span>Mass Haul Diagram (MHD)</span>
</h3>
<p className="text-xs text-slate-500">
              Cumulative mass ordinate curve vs alignment chainage with cut surplus (+) and fill deficit (-) regions.
</p>
</div>
<div className="flex items-center gap-4 text-xs font-medium">
<span className="inline-flex items-center gap-1.5 text-emerald-700">
<span className="w-3 h-3 rounded bg-emerald-400 opacity-60"></span>
<span>Cut Surplus</span>
</span>
<span className="inline-flex items-center gap-1.5 text-rose-700">
<span className="w-3 h-3 rounded bg-rose-400 opacity-60"></span>
<span>Fill Deficit</span>
</span>
<span className="inline-flex items-center gap-1.5 text-amber-700">
<span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
<span>Balance Point (BP)</span>
</span>
</div>
</div>

<div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex items-center justify-center">
          <MassHaulDiagramSvg stations={stations} />
</div>
</div>
);
