import { PROVIDER_NAMES, analyticsConfig } from '../analytics'

/** Home screen footer. Says what's measured only when this build has analytics; otherwise that nothing is */
export function PrivacyNote() {
  const config = analyticsConfig()
  return (
    <footer className="privacy">
      <details>
        <summary>
          {config ? 'No cookies, no tracking of what you type.' : 'No cookies, no analytics.'}{' '}
          <span className="privacy__more">Privacy</span>
        </summary>
        <p>Your progress and stats stay in this browser. Nothing you type is sent anywhere.</p>
        {config ? (
          <p>
            We count visits and a few anonymous events with {PROVIDER_NAMES[config.provider]}, which sets no cookies:
            starting and finishing the daily dive (with the score in bands of 100 points), starting Unlimited,
            tapping Share and opening How to play.
          </p>
        ) : (
          <p>This site doesn't use analytics.</p>
        )}
        <p>Fonts load from Google Fonts, and the web host keeps standard server logs.</p>
      </details>
    </footer>
  )
}
