import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  try {
    const { image, mimeType } = await request.json()

    if (!image) {
      return Response.json({ error: 'Image data is required' }, { status: 400 })
    }

    const prompt = `You are an expert at reading sheet music and converting it to ABC notation.

Analyze this sheet music image and convert it to valid ABC notation.

Guidelines:
1. Start with the standard ABC headers (X:, T:, M:, L:, K:, etc.)
2. Identify the time signature (M:)
3. Identify the key signature (K:)
4. Read each note carefully, including:
   - Note pitches (using ABC notation: C D E F G A B for lower octave, c d e f g a b for higher)
   - Note durations (whole, half, quarter, eighth, sixteenth)
   - Accidentals (^=sharp, _=flat, ==natural)
   - Rests (z for rest)
   - Bar lines (|)
   - Chords (notes in brackets [CEG])
5. If there are multiple voices/staves (like piano with treble and bass), use V:1 and V:2
6. Preserve dynamics and articulation marks where possible

Return ONLY valid ABC notation that can be rendered. No explanations, just the ABC code.
If you cannot read parts clearly, make your best musical judgment to fill in reasonable notes.`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert music transcriber. Return only valid ABC notation without any explanations or markdown formatting."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${image}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 4000,
      temperature: 0.2,
    })

    let abcNotation = completion.choices[0]?.message?.content?.trim()

    if (!abcNotation) {
      throw new Error('No response from OpenAI')
    }

    // Clean up the response - remove markdown code blocks if present
    abcNotation = abcNotation
      .replace(/```abc\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim()

    return Response.json({ abc: abcNotation })

  } catch (error) {
    console.error('OpenAI Vision API error:', error)
    return Response.json(
      { error: 'Failed to read sheet music from image' },
      { status: 500 }
    )
  }
}
