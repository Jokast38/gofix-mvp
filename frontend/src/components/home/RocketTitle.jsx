// Hero title wrapped in an animated rocket-trail glow (echoes the swoosh of the GoFix logo)
export function RocketTitle({ children, className = "", testId = "home-hero-title" }) {
  return (
    <div className="gf-rocket-stage inline-block max-w-3xl px-3 py-2">
      <span className="gf-rocket-trail" aria-hidden="true" />
      <span className="gf-rocket-spark" aria-hidden="true" />
      <h1 className={className} data-testid={testId}>{children}</h1>
    </div>
  );
}
