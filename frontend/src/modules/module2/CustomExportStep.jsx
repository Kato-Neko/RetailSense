import { Button } from "@/components/ui/button"
import { Download, CheckCircle, Calendar, Clock, BarChart2, Timer, Lightbulb } from "lucide-react"

export default function AnalyticsSummaryBox({ customDateRange, customTimeRange, analysis, startDate, endDate, startTime, endTime }) {
  // Accepts either customDateRange/customTimeRange or startDate/endDate/startTime/endTime
  const startDateStr = customDateRange?.start instanceof Date ? customDateRange.start.toISOString().slice(0, 10) : (customDateRange?.start || startDate);
  const endDateStr = customDateRange?.end instanceof Date ? customDateRange.end.toISOString().slice(0, 10) : (customDateRange?.end || endDate);
  const startTimeStr = customTimeRange?.start instanceof Date ? customTimeRange.start.toLocaleTimeString() : (customTimeRange?.start || startTime);
  const endTimeStr = customTimeRange?.end instanceof Date ? customTimeRange.end.toLocaleTimeString() : (customTimeRange?.end || endTime);
  return (
    <div className="flex flex-col p-5 border border-green-300 bg-green-100/80 text-green-900 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300 rounded-lg w-full mb-6">
      <div className="flex items-center mb-12">
        <CheckCircle className="h-5 w-5 mr-3 text-green-400" />
        <div>
          <div className="font-semibold text-sm mb-1 text-green-700 dark:text-green-300">Ready to Export</div>
          <div className="text-xs text-green-700 dark:text-green-300">All information is valid. You can now export the heatmap analytics and data below.</div>
        </div>
      </div>
      <div className="bg-transparent rounded-lg p-0">
        <div className="grid grid-cols-2 gap-y-2 gap-x-4">
          {/* Date Range */}
          <div className="text-sm font-semibold flex items-center text-green-700 dark:text-green-300">
            <Calendar className="h-4 w-4 mr-2 text-green-400" />
            Date Range:
          </div>
          <div className="text-sm text-right text-green-700 dark:text-green-300">{startDateStr} to {endDateStr}</div>
          {/* Time Range */}
          <div className="text-sm font-semibold flex items-center text-green-700 dark:text-green-300">
            <Clock className="h-4 w-4 mr-2 text-green-400" />
            Time Range:
          </div>
          <div className="text-sm text-right text-green-700 dark:text-green-300">{startTimeStr} to {endTimeStr}</div>
          {/* Total Visitors */}
          <div className="text-sm font-semibold flex items-center text-green-700 dark:text-green-300">
            <svg className="h-4 w-4 mr-2 text-green-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m9-4a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            Total Visitors:
          </div>
          <div className="text-sm text-right text-green-700 dark:text-green-300">{analysis?.total_visitors ?? 0}</div>
          {/* Traffic Distribution */}
          <div className="text-sm font-semibold flex items-center text-green-700 dark:text-green-300 pt-2">
            <BarChart2 className="h-4 w-4 mr-2 text-green-400" />
            Traffic Distribution
          </div>
          <div></div>
          <div className="text-sm font-semibold pl-12 flex items-center text-green-700 dark:text-green-300">Low</div>
          <div className="text-sm text-right text-green-700 dark:text-green-300">{analysis?.areas?.low?.percentage ?? 0}%</div>
          <div className="text-sm font-semibold pl-12 flex items-center text-green-700 dark:text-green-300">Medium</div>
          <div className="text-sm text-right text-green-700 dark:text-green-300">{analysis?.areas?.medium?.percentage ?? 0}%</div>
          <div className="text-sm font-semibold pl-12 flex items-center text-green-700 dark:text-green-300">High</div>
          <div className="text-sm text-right text-green-700 dark:text-green-300">{analysis?.areas?.high?.percentage ?? 0}%</div>
          {/* Peak Hour/Minute */}
          <div className="text-sm font-semibold flex items-center text-green-700 dark:text-green-300">
            <Timer className="h-4 w-4 mr-2 text-green-400" />
            {analysis?.peak_hour_label ? 'Peak Hour:' : 'Peak Minute:'}
          </div>
          <div className="text-sm text-right text-green-700 dark:text-green-300">
            {analysis?.peak_hour_label
              ? analysis.peak_hour_label
              : (analysis?.peak_minutes && analysis.peak_minutes.length > 0)
                ? `${analysis.peak_minutes[0].minute}`
                : 'N/A'}
          </div>
          {/* Recommendations */}
          <div className="text-sm font-semibold flex items-start text-green-700 dark:text-green-300">
            <Lightbulb className="h-4 w-4 mr-2 text-green-400" />
            Recommendations
          </div>
          <div className="text-sm text-right text-green-700 dark:text-green-300">
            {analysis?.recommendations?.[0] ?? 'No recommendations available.'}
            {/* Additional recommendations, if any */}
            {analysis?.recommendations?.length > 1 && (
              <div className="text-sm mt-2 whitespace-pre-line text-green-700 dark:text-green-300">
                {analysis.recommendations.slice(1).join('\n')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 