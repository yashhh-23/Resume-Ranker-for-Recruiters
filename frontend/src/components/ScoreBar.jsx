const ScoreBar = ({ segments }) => {
  return (
    <div className="space-y-1.5">
      {segments.map((segment) => {
        const percent = Math.round((segment.value ?? 0) * 100);
        return (
          <div key={segment.label} className="flex items-center gap-2.5 text-[10px] font-mono">
            <span className="w-20 text-left text-slate-400 font-semibold truncate" title={segment.label}>
              {segment.label}
            </span>
            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-none h-1.5 relative overflow-hidden">
              <div
                className="h-full transition-all duration-500 ease-in-out"
                style={{
                  width: `${percent}%`,
                  backgroundColor: segment.colorCode
                }}
              />
            </div>
            <span className="w-8 text-right text-slate-300 font-bold">{percent}%</span>
          </div>
        );
      })}
    </div>
  );
};

export default ScoreBar;
