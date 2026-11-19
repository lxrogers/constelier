// The chart engine reads the birth from a form on the page and draws on a 2D
// canvas beside it. The hero has neither on show: the director sets the birth
// itself and puts the canvas on the surface inside the 3D scene. So both live
// here, off screen.
export default function HiddenChartForm({ canvasRef }: { canvasRef: React.Ref<HTMLCanvasElement> }) {
  return (
    <div className="hero-film-offstage" aria-hidden="true">
      <select id="birth-year" tabIndex={-1}></select>
      <select id="birth-month" tabIndex={-1}></select>
      <select id="birth-day" tabIndex={-1}></select>
      <select id="birth-hour" tabIndex={-1}></select>
      <select id="birth-minute" tabIndex={-1}></select>
      <input id="location" tabIndex={-1} readOnly />
      <div id="location-dropdown"></div>
      <div id="location-info"></div>
      <div id="error"></div>
      <div className="hero-film-chart"><canvas ref={canvasRef} width="700" height="700"></canvas></div>
    </div>
  );
}
