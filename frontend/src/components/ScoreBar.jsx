const ScoreBar = ({ segments }) => {
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-none bg-slate-900 border border-slate-900">
      {segments.map((segment) => {
        const contribution = segment.value * (segment.weight ?? 1);
        const width = `${contribution * 100}%`;
        return (
          <div
            key={segment.label}
            className={`${segment.color ?? ""} transition-all duration-300 ease-in-out h-full`}
            style={{ 
              width,
              backgroundColor: segment.colorCode 
            }}
            title={`${segment.label}: ${(segment.value * 100).toFixed(0)}% (Weight: ${(segment.weight * 100).toFixed(0)}%, Contribution: ${(contribution * 100).toFixed(1)}%)`}
          />
        );
      })}
    </div>
  );
};

export default ScoreBar;
