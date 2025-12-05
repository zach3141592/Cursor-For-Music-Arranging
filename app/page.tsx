'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function LandingPage() {
  return (
    <div className="landing-page">
      <div className="landing-container">
        <header className="landing-header">
          <Image 
            src="/logo.png" 
            alt="TuneForm AI Logo" 
            width={100} 
            height={100}
            className="logo-3d-image"
            priority
          />
          <h1 className="landing-title">TunesForm AI</h1>
          <p className="landing-subtitle">Make lead sheets with AI</p>
        </header>

        <main className="landing-main">
          <div className="landing-cta">
            <Link href="/arrange" className="btn btn-large">
              Get Started
            </Link>
          </div>
        </main>

        <footer className="landing-footer">
          Made by <a href="https://www.zacharyyu.com/" target="_blank" rel="noreferrer noopener">Zachary Yu</a>
        </footer>
      </div>
    </div>
  )
}