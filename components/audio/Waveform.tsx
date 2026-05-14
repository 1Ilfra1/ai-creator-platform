export default function Waveform() {
  return (
    <div className="flex items-end gap-1 h-8">
      {[8, 16, 24, 14, 28, 18, 10, 22, 12, 26].map((height, index) => (
        <div
          key={index}
          className="w-1 rounded-full bg-purple-400 animate-pulse"
          style={{
            height: `${height}px`,
            animationDelay: `${index * 80}ms`,
          }}
        />
      ))}
    </div>
  );
}