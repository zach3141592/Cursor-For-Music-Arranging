'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function LandingPage() {
  return (
    <div className="landing-page">
      <div className="landing-container">
        <header className="landing-header">
          <div className="logo-3d">TF</div>
          <h1 className="landing-title">TuneForm AI</h1>
          <p className="landing-subtitle">Simplify complex piano sheet music using AI</p>
        </header>

        <main className="landing-main">
          <div className="landing-cta">
            <Link href="/arrange" className="btn btn-large">
              Get Started
            </Link>
          </div>

          <footer className="landing-footer">
            <p>
              Made with the help of <a href="https://www.abcjs.net/" target="_blank" rel="noreferrer noopener">abcjs</a> notation converter
            </p>
          </footer>
        </main>
      </div>
    </div>
  )
}