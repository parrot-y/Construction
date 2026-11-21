import React from 'react';

export interface TimelineItem {
  id: string;
  percentage: number;
  notes?: string | null;
  recorded_at: string;
  item_description: string;
  section_code?: string;
}

interface MilestoneTimelineProps {
  items?: TimelineItem[];
  projectName?: string;
  projectCode?: string;
  ncaRegistration?: string;
}

export default function MilestoneTimeline({
  items = [],
  projectName = '',
  projectCode = '',
  ncaRegistration = '',
}: MilestoneTimelineProps): React.JSX.Element {
  const displayItems = items;

  return (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
<div>
<span className="text-[10px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
            Project Schedule & Verification
</span>
<h3 className="text-base font-bold text-slate-900 mt-1">Milestone Progress Timeline</h3>
<p className="text-xs text-slate-500">
            {[projectName, projectCode && `Code: ${projectCode}`, ncaRegistration && `NCA Reg: ${ncaRegistration}`].filter(Boolean).join(' • ')}
</p>
</div>
<span className="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg">
          Chronological Progress
</span>
</div>

<div className="space-y-3 pt-2">
        {displayItems.length === 0 && (
<div className="p-6 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
            No milestone progress recorded yet — entries appear here as physical progress is certified.
</div>
)}
        {displayItems.map((item, idx) => {
          const isComplete = item.percentage >= 100;
          const isActive = item.percentage > 0 && item.percentage< 100;

          return (
<div
              key={item.id || idx}
              className={`p-3.5 rounded-xl border transition ${
                isComplete
                  ? 'bg-emerald-50/50 border-emerald-200'
                  : isActive
                  ? 'bg-blue-50/50 border-blue-200'
                  : 'bg-slate-50/50 border-slate-200'
}`}
            >
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
<div className="space-y-1">
<div className="flex items-center gap-2 flex-wrap">
<span className="font-semibold text-xs text-slate-900 block">
                      {item.item_description}
</span>
                    {item.section_code && (
<span className="px-2 py-0.5 text-[10px] tabular-nums bg-white text-slate-600 border border-slate-200 rounded">
                        {item.section_code}
</span>
)}
</div>
                  {item.notes && (
<p className="text-[11px] text-slate-600 italic">
                      Inspector Note:"{item.notes}"
</p>
)}
</div>

<div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
<span className="text-[11px] text-slate-400 tabular-nums">
                    {item.recorded_at ? item.recorded_at.split('T')[0] : ''}
</span>
<span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                      isComplete
                        ? 'bg-emerald-200 text-emerald-900'
                        : isActive
                        ? 'bg-blue-200 text-blue-900'
                        : 'bg-slate-200 text-slate-700'
}`}
                  >
                    {`${item.percentage.toFixed(1)}%`}
</span>
</div>
</div>

              {/* Progress Track */}
<div className="w-full bg-slate-200 rounded-full h-1.5 mt-2.5 overflow-hidden">
<div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    isComplete ? 'bg-emerald-500' : 'bg-blue-500'
}`}
                  style={{ width: `${Math.min(100, Math.max(0, item.percentage))}%`}}
                />
</div>
</div>
);
})}
</div>
</div>
);
}
