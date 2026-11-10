import { paint } from './elevator/paint'
import { LOGO_H, LOGO_W, drawLogo } from './logo-art'

const ART = paint(drawLogo)

/** The wordmark: chunky pixel letters, ending in a bubble. Decorative; give its heading a text name */
export function Logo() {
  return (
    <svg className="logo" viewBox={`0 0 ${LOGO_W} ${LOGO_H}`} shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      {ART}
    </svg>
  )
}
