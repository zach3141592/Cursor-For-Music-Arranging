'use client'

import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="landing-page">
      <div className="landing-container">
        <header className="landing-header">
          <h1 className="landing-title">Easy Piano Arranger</h1>
          <p className="landing-subtitle">Simplify complex piano sheet music using AI-powered technology</p>
        </header>

        <main className="landing-main">
          <div className="landing-features">
            <div className="landing-feature">
              <h3>AI-Powered</h3>
              <p>Intelligent music simplification</p>
            </div>
            <div className="landing-feature">
              <h3>ABC Notation</h3>
              <p>Standard format support</p>
            </div>
            <div className="landing-feature">
              <h3>Real-time Preview</h3>
              <p>Instant visualization</p>
            </div>
            <div className="landing-feature">
              <h3>Export Options</h3>
              <p>Download simplified files</p>
            </div>
          </div>

          <div className="landing-cta">
            <Link href="/arrange" className="btn btn-large">
              Get Started
            </Link>
          </div>

          <footer className="landing-footer">
            <p>
              Powered by <a href="https://www.abcjs.net/" target="_blank" rel="noreferrer noopener">abcjs</a> and OpenAI
            </p>
          </footer>
        </main>
      </div>
    </div>
  )
}