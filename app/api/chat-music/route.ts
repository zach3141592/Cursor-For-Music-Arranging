import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(request: Request) {
  try {
    const { message, currentAbc, history } = await request.json()

    if (!message) {
      return Response.json({ error: 'Message is required' }, { status: 400 })
    }

    const systemPrompt = `You are an expert music composer and arranger specializing in creating lead sheets in ABC notation format. Your role is to help users create, modify, and improve music notation.

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

When the user asks you to create or modify music:
1. Generate valid ABC notation
2. Explain briefly what you created/changed
3. Return the ABC in a code block marked with \`\`\`abc

Current ABC notation (if any):
${currentAbc || 'None - starting fresh'}

Be creative but musically coherent. Match the style the user requests.`

    // Build conversation history for context
    const messages: { role: 'system' | 'user' | 'assistant', content: string }[] = [
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

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages,
      max_tokens: 2000,
      temperature: 0.7,
    })

    const responseText = completion.choices[0]?.message?.content?.trim()

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
