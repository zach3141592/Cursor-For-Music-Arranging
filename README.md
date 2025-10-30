# Easy Piano Arranger (AI-Powered)

An intelligent piano sheet music simplification app built with Next.js, OpenAI API, and abcjs.

## What this is

- A Next.js web app that lets you paste ABC notation and generate simplified piano versions using AI or rule-based approaches
- Powered by OpenAI GPT-4 for intelligent music simplification
- Renders notation and provides playback using abcjs
- Basic PDF upload placeholder (OMR not implemented)

## Features

- **AI-Powered Simplification**: Uses OpenAI GPT-4 to intelligently simplify complex piano music
- **Rule-Based Fallback**: Traditional simplification rules when AI is disabled
- **Real-time Rendering**: Instant visual feedback with abcjs notation rendering
- **Audio Playback**: Play original and simplified versions
- **Export**: Download simplified ABC files
- **Customizable Settings**: Toggle different simplification approaches

## Setup & Installation

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Set up environment variables**:

   ```bash
   cp env.example .env.local
   ```

   Edit `.env.local` and add your OpenAI API key:

   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

3. **Run the development server**:

   ```bash
   npm run dev
   ```

4. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## How to use

1. **Input**: Paste ABC notation in the text area (demo tune is prefilled)
2. **Settings**: Choose between AI-powered or rule-based simplification
3. **Simplify**: Click "Simplify + Render" to process your music
4. **Compare**: View original and simplified versions side by side
5. **Play**: Use playback controls to hear both versions
6. **Export**: Download the simplified ABC file

## API Integration

The app uses OpenAI's GPT-4 model to intelligently simplify music by:

- Removing complex ornaments while preserving musical essence
- Reducing chords to playable intervals
- Simplifying rhythms for intermediate players
- Maintaining key and structure
- Preserving melody and form

## Technical Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **AI**: OpenAI GPT-4 API
- **Music Rendering**: abcjs library
- **Styling**: CSS with CSS variables

## Notes on PDF (OMR)

- Converting PDF sheet music into structured notation requires an OMR engine (e.g., Audiveris)
- The "Process PDF (Placeholder)" button is a UI stub
- To enable full PDF→ABC workflow, integrate an OMR service that converts PDF → ABC/MusicXML

## About abcjs

The app uses `abcjs` to render notation and handle basic playback. See the official site for docs and options: [abcjs.net](https://www.abcjs.net/)

## License

MIT, like abcjs.

## API Reference

- **abcjs**: [https://www.abcjs.net/](https://www.abcjs.net/)
- **OpenAI API**: [https://platform.openai.com/docs](https://platform.openai.com/docs)
