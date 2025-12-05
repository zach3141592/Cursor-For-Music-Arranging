import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// Web search function using DuckDuckGo (no API key required)
async function searchWeb(query: string): Promise<string> {
  try {
    // Use DuckDuckGo HTML search
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })

    if (!response.ok) {
      throw new Error(`Search error: ${response.status}`)
    }

    const html = await response.text()

    // Parse results from HTML
    const results: string[] = []

    // Extract result snippets using regex (simple parsing)
    const snippetRegex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi
    const titleRegex = /<a class="result__a"[^>]*>([\s\S]*?)<\/a>/gi

    let match: RegExpExecArray | null
    const titles: string[] = []
    const snippets: string[] = []

    while ((match = titleRegex.exec(html)) !== null && titles.length < 5) {
      // Clean HTML tags and entities
      const title = match[1]
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .trim()
      if (title) titles.push(title)
    }

    while ((match = snippetRegex.exec(html)) !== null && snippets.length < 5) {
      const snippet = match[1]
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .trim()
      if (snippet) snippets.push(snippet)
    }

    // Combine titles and snippets
    for (let i = 0; i < Math.max(titles.length, snippets.length); i++) {
      const title = titles[i] || ''
      const snippet = snippets[i] || ''
      if (title || snippet) {
        results.push(`${title}: ${snippet}`)
      }
    }

    if (results.length === 0) {
      return 'No search results found.'
    }

    return `Search results for "${query}":\n\n${results.join('\n\n')}`
  } catch (error) {
    console.error('Web search error:', error)
    return `Search failed: ${(error as Error).message}. Proceeding with general knowledge.`
  }
}

// Define the search tool for OpenAI function calling
const tools: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_song_info',
      description: 'Search the web for information about a specific song, including chord progressions, key, melody notes, and structure. Use this when the user asks for a lead sheet of a known song (jazz standard, pop song, etc.) to get accurate chord changes and song information.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query. Include the song name and what information you need (e.g., "Autumn Leaves jazz chord progression key" or "Blue Bossa chords melody")'
          }
        },
        required: ['query']
      }
    }
  }
]

export async function POST(request: Request) {
  try {
    const { message, currentAbc, history } = await request.json()

    if (!message) {
      return Response.json({ error: 'Message is required' }, { status: 400 })
    }

    const systemPrompt = `You are an expert music composer and arranger specializing in creating lead sheets in ABC notation format. Your role is to help users create, modify, and improve music notation.

IMPORTANT: When a user asks for a lead sheet of a KNOWN SONG (jazz standard, pop song, classical piece, etc.), you MUST use the search_song_info tool first to look up the correct chord progression, key, and melody information. Do NOT guess or make up chord changes for real songs - always search first to ensure accuracy.

ABC Notation Guidelines:
- Always start with X: (reference number), T: (title), M: (meter), L: (default note length), K: (key)
- Use standard ABC note names: C D E F G A B (uppercase = octave below middle C, lowercase = middle C octave and above)
- Octave markers: , (lower octave) ' (higher octave)
- Note lengths: A2 = double length, A/2 = half length, A3/2 = dotted
- Bar lines: | for regular, || for double, |] for end
- Chords: "Am" before a note for chord symbols (important for lead sheets!)
- Rests: z (rest), z2 (half rest), etc.

Chord Notation (IMPORTANT - know the difference!):
- C = C major triad (C, E, G)
- Cm = C minor triad (C, Eb, G)
- C7 = C dominant 7th (C, E, G, Bb) - has a FLAT 7th, used in blues/jazz
- Cmaj7 = C major 7th (C, E, G, B) - has a NATURAL 7th
- Cm7 = C minor 7th (C, Eb, G, Bb)
- Cdim = C diminished (C, Eb, Gb)
- Cdim7 = C diminished 7th (C, Eb, Gb, Bbb/A)
- Caug = C augmented (C, E, G#)
- Csus4 = C suspended 4th (C, F, G)
- Csus2 = C suspended 2nd (C, D, G)
- C9 = C dominant 9th (C, E, G, Bb, D)
- Cmaj9 = C major 9th (C, E, G, B, D)
- C6 = C major 6th (C, E, G, A)
- Cm6 = C minor 6th (C, Eb, G, A)

Lead Sheet Specific:
- Lead sheets typically have melody line with chord symbols above
- Include chord symbols like "C" "Am" "Dm7" "G7" etc.
- Keep melodies singable and clear
- Common structures: 12-bar blues, 32-bar AABA, 16-bar verse/chorus
- Blues typically uses dominant 7th chords (C7, F7, G7)
- Jazz standards often use maj7, m7, and dominant 7th chords

Jazz Lead Sheet Best Practices (from Learn Jazz Standards):
- Keep it simple and organized
- Mark sections clearly (A, B, Coda, etc.)
- Keep it on one page if possible
- Write melody clearly so players can easily read on the spot
- Chord symbols go above the staff

Jazz Chord Symbol Standards:
- Major 7: Cmaj7 or use triangle symbol description
- Minor 7: Cm7 or C-7
- Dominant 7: C7 (the default "7" chord in jazz)
- Half-diminished (m7b5): Cm7b5 or Cø
- Diminished 7: Cdim7 or Co7
- Jazz often abbreviates to just "7" even if extensions (9, 11, 13) are implied
- Players have freedom to add extensions and alterations

Swing vs Straight Time:
- For swing feel, indicate "Swing" or "Medium Swing" at the top
- Don't notate triplet feel - just write regular eighth notes with swing indication
- For straight/even eighths, indicate "Straight 8ths" or "Even 8ths"

Turnarounds:
- Turnaround chords at the end lead back to the top for repeats
- Common turnarounds: I-VI-ii-V (e.g., Cmaj7-A7-Dm7-G7)
- On the final chorus, skip the turnaround and end on the final chord

When the user asks you to create or modify music:
1. If it's a KNOWN SONG, use search_song_info first to get accurate information
2. Generate valid ABC notation based on real chord progressions and melody
3. Explain briefly what you created/changed
4. Return the ABC in a code block marked with \`\`\`abc

Current ABC notation (if any):
${currentAbc || 'None - starting fresh'}

Be creative but musically coherent. For known songs, be ACCURATE to the original.`

    // Build conversation history for context
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt }
    ]

    // Add conversation history (limit to last 10 messages for context)
    const recentHistory = (history || []).slice(-10) as ChatMessage[]
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role,
        content: msg.content
      })
    }

    // Add current message
    messages.push({ role: 'user', content: message })

    // First API call - may trigger function calling
    let completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages,
      tools,
      tool_choice: 'auto',
      max_tokens: 2000,
      temperature: 0.7,
    })

    let responseMessage = completion.choices[0]?.message

    // Handle function calls (tool use)
    while (responseMessage?.tool_calls && responseMessage.tool_calls.length > 0) {
      // Add the assistant's message with tool calls
      messages.push(responseMessage)

      // Process each tool call
      for (const toolCall of responseMessage.tool_calls) {
        if (toolCall.function.name === 'search_song_info') {
          const args = JSON.parse(toolCall.function.arguments)
          console.log('Searching for:', args.query)

          const searchResult = await searchWeb(args.query)

          // Add the tool response
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: searchResult
          })
        }
      }

      // Get the next response after tool calls
      completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages,
        tools,
        tool_choice: 'auto',
        max_tokens: 2000,
        temperature: 0.7,
      })

      responseMessage = completion.choices[0]?.message
    }

    const responseText = responseMessage?.content?.trim()

    if (!responseText) {
      throw new Error('No response from OpenAI')
    }

    // Extract ABC notation from the response if present
    let extractedAbc: string | null = null
    const abcMatch = responseText.match(/```abc\n([\s\S]*?)```/)
    if (abcMatch) {
      extractedAbc = abcMatch[1].trim()
    } else {
      // Also try to find ABC without the abc language marker
      const genericMatch = responseText.match(/```\n?(X:\s*\d[\s\S]*?)```/)
      if (genericMatch) {
        extractedAbc = genericMatch[1].trim()
      }
    }

    // Clean up the message for display (remove the code block)
    let displayMessage = responseText
    if (extractedAbc) {
      displayMessage = responseText
        .replace(/```abc\n[\s\S]*?```/g, '')
        .replace(/```\n?X:\s*\d[\s\S]*?```/g, '')
        .trim()

      // Add a note that the ABC was applied
      if (displayMessage) {
        displayMessage += '\n\n✓ ABC notation has been applied to the editor.'
      } else {
        displayMessage = '✓ ABC notation has been applied to the editor.'
      }
    }

    return Response.json({
      message: displayMessage,
      abc: extractedAbc
    })

  } catch (error) {
    console.error('Chat API error:', error)
    return Response.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    )
  }
}
