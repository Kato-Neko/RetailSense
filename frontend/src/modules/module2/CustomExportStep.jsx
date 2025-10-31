import { Button } from "@/components/ui/button"
import { Download, CheckCircle, Calendar, Clock, BarChart2, Timer, Lightbulb, Bot } from "lucide-react"

// Add a helper to bin detections by time and count unique visitors
function getVisitorBins(detections, startMinute, endMinute, numBins = 5) {
  if (!detections || detections.length === 0) return [];
  const startTime = startMinute * 60;
  const endTime = endMinute * 60;
  const totalDuration = endTime - startTime;
  const interval = totalDuration / numBins;
  const bins = [];
  for (let i = 0; i < numBins; i++) {
    const binStart = startTime + i * interval;
    const binEnd = binStart + interval;
    const trackIds = new Set();
    detections.forEach(det => {
      const t = det.timestamp;
      if (t >= binStart && t < binEnd) {
        trackIds.add(det.track_id);
      }
    });
    const formatSec = (sec) => {
      const h = Math.floor(sec / 3600).toString().padStart(2, '0');
      const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
      const s = Math.floor(sec % 60).toString().padStart(2, '0');
      return `${h}:${m}:${s}`;
    };
    bins.push({
      range: `${formatSec(binStart)}-${formatSec(binEnd)}`,
      visitors: trackIds.size,
    });
  }
  return bins;
}

export default function AnalyticsSummaryBox({ customDateRange, customTimeRange, analysis, detections, startDate, endDate, startTime, endTime }) {
  // Accepts either customDateRange/customTimeRange or startDate/endDate/startTime/endTime
  const startDateStr = customDateRange?.start instanceof Date ? customDateRange.start.toISOString().slice(0, 10) : (customDateRange?.start || startDate);
  const endDateStr = customDateRange?.end instanceof Date ? customDateRange.end.toISOString().slice(0, 10) : (customDateRange?.end || endDate);
  const startTimeStr = customTimeRange?.start instanceof Date ? customTimeRange.start.toLocaleTimeString() : (customTimeRange?.start || startTime);
  const endTimeStr = customTimeRange?.end instanceof Date ? customTimeRange.end.toLocaleTimeString() : (customTimeRange?.end || endTime);

  const peakLabel = (() => {
    if (analysis?.peak_hours && analysis.peak_hours.length === 1) {
      const bin = analysis.peak_hours[0];
      const startTime = bin.start_minute * 60;
      const endTime = bin.end_minute * 60;
      const formatSec = (sec) => {
        const h = Math.floor(sec / 3600).toString().padStart(2, '0');
        const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(sec % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
      };
      return `${formatSec(startTime)}-${formatSec(endTime)}`;
    } else if (analysis?.peak_hour_label) {
      return analysis.peak_hour_label;
    } else if (analysis?.peak_minutes && analysis.peak_minutes.length > 0) {
      return `${analysis.peak_minutes[0].minute}`;
    }
    return 'N/A';
  })();

  const low = analysis?.areas?.low?.percentage ?? 0;
  const med = analysis?.areas?.medium?.percentage ?? 0;
  const high = analysis?.areas?.high?.percentage ?? 0;

  const recs = analysis?.recommendations || [];
  const showMore = recs.length > 3;

  return (
    <div className="flex flex-col gap-10 p-5 rounded-2xl w-full mb-3 border border-white/10 bg-gradient-to-br from-white/5 to-white/0 dark:from-slate-900/40 dark:to-slate-900/10 backdrop-blur-xl shadow-xl">
      {/* Top header removed; we will show the readiness state near the export buttons to group actions */}

      {/* Summary row: visitors on left, date+time merged on right */}
      <div className="rounded-2xl bg-white/8 dark:bg-white/5 border border-white/10 px-4 py-4 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Col 1: Big visitors stat */}
        <div className="flex flex-col items-center justify-center text-center">
          <div className="text-4xl md:text-4xl font-extrabold leading-none tracking-tight text-foreground">
            {analysis?.total_visitors ?? 0}
          </div>
          <div className="text-xs mt-2 opacity-70 uppercase tracking-wide">visitors</div>
        </div>

        {/* Col 2-3 merged: single rectangle with two rows, time emphasized then date */}
        <div className="md:col-span-2 flex items-stretch">
          <div className="w-full flex flex-col items-center justify-center text-center rounded-xl px-3 py-3 md:px-4 md:py-3 min-w-0 max-w-full overflow-hidden">
            <div className="text-base md:text-lg lg:text-xl font-semibold truncate text-foreground leading-tight w-full">{startTimeStr} – {endTimeStr}</div>
            <div className="mt-1 text-xs md:text-sm truncate text-foreground/70 leading-tight w-full">{startDateStr} – {endDateStr}</div>
          </div>
        </div>
      </div>

      {/* Distribution (no label) */}
      <div className="space-y-6 mt-8 mb-2">
        <div className="space-y-3">
          <div className="text-sm flex items-center gap-3"><span className="w-16 text-foreground/70">Low</span><div className="flex-1 h-3 rounded-full bg-white/10"><div className="h-3 rounded-full bg-blue-500" style={{ width: `${low}%` }}></div></div><span className="w-12 text-right text-foreground/80">{low}%</span></div>
          <div className="text-sm flex items-center gap-3"><span className="w-16 text-foreground/70">Medium</span><div className="flex-1 h-3 rounded-full bg-white/10"><div className="h-3 rounded-full bg-amber-500" style={{ width: `${med}%` }}></div></div><span className="w-12 text-right text-foreground/80">{med}%</span></div>
          <div className="text-sm flex items-center gap-3"><span className="w-16 text-foreground/70">High</span><div className="flex-1 h-3 rounded-full bg-white/10"><div className="h-3 rounded-full bg-red-500" style={{ width: `${high}%` }}></div></div><span className="w-12 text-right text-foreground/80">{high}%</span></div>
        </div>
      </div>

      {/* Recommendations (no label) */}
      <div className="space-y-4 mt-8">
        {analysis?.recommendations_source === 'ai' && (
          <div className="flex items-center gap-2 text-xs text-foreground/70">
            <Bot className="h-4 w-4 text-cyan-400" />
            <span>AI-generated recommendations</span>
          </div>
        )}
        {recs.length === 0 ? (
          <div className="text-sm text-foreground/70">No recommendations available.</div>
        ) : (
          <ul className="pl-5 pr-2 py-2 space-y-2 text-sm text-foreground/85 list-disc marker:text-cyan-400/80 rounded-lg bg-white/5 border border-white/10">
            {(showMore ? recs.slice(0, 3) : recs).map((r, i) => (<li key={`rec-${i}`}>{r}</li>))}
          </ul>
        )}
        {showMore && (
          <div className="pt-1 text-right">
            <span className="text-[11px] opacity-70">and more…</span>
          </div>
        )}
      </div>
      {/* Readiness notice removed per request */}
    </div>
  );
}