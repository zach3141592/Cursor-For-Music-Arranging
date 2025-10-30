# AI Piano Arranger

play any song you want

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
