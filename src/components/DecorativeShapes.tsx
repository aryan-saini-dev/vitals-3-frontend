const DecorativeShapes = () => (
  <>
    {/* Top-left circle */}
    <div className="absolute -top-10 -left-10 w-32 h-32 rounded-full bg-tertiary opacity-60 animate-float pointer-events-none" />
    {/* Top-right triangle */}
    <div
      className="absolute top-20 -right-6 w-0 h-0 opacity-50 pointer-events-none"
      style={{
        borderLeft: '30px solid transparent',
        borderRight: '30px solid transparent',
        borderBottom: '52px solid hsl(var(--secondary))',
      }}
    />
    {/* Bottom-left squiggle */}
    <svg className="absolute bottom-10 left-10 w-24 h-6 opacity-30 pointer-events-none" viewBox="0 0 100 20">
      <path d="M0 10 Q15 0 30 10 Q45 20 60 10 Q75 0 90 10" fill="none" stroke="hsl(var(--quaternary))" strokeWidth="3" strokeLinecap="round" />
    </svg>
    {/* Bottom-right dot */}
    <div className="absolute -bottom-4 right-20 w-8 h-8 rounded-full bg-primary opacity-40 pointer-events-none" />
  </>
);

export default DecorativeShapes;
