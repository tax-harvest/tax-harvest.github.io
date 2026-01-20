/**
 * Edge Function: create-access-token
 *
 * Creates a recovery token for the authenticated user.
 * The token allows accessing buyback records from any device.
 *
 * Security:
 * - Requires authentication (uses user's JWT)
 * - Token is hashed before storage
 * - Returns plain token only once (never stored in plain text)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * Generate a secure random token
 */
function generateToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Hash a token using SHA-256
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create Supabase client with user's JWT
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Get the user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse the request body for optional label
    let label: string | null = null
    try {
      const body = await req.json()
      label = body.label || null
    } catch {
      // No body or invalid JSON is fine
    }

    // Generate default label if none provided
    if (!label) {
      const date = new Date()
      const month = date.toLocaleString('en-US', { month: 'short' })
      const year = date.getFullYear()
      label = `Buyback ${month} ${year}`
    }

    // Generate a new token
    const token = generateToken()
    const tokenHash = await hashToken(token)

    // Create service role client to insert (access_tokens has no RLS)
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    // Check if user already has a token
    const { data: existingToken } = await serviceClient
      .from('access_tokens')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existingToken) {
      // Update existing token
      const { error: updateError } = await serviceClient
        .from('access_tokens')
        .update({
          token_hash: tokenHash,
          label,
          created_at: new Date().toISOString(),
          last_accessed_at: null
        })
        .eq('user_id', user.id)

      if (updateError) {
        console.error('Error updating token:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to create recovery link' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    } else {
      // Insert new token
      const { error: insertError } = await serviceClient
        .from('access_tokens')
        .insert({
          token_hash: tokenHash,
          user_id: user.id,
          label
        })

      if (insertError) {
        console.error('Error inserting token:', insertError)
        return new Response(
          JSON.stringify({ error: 'Failed to create recovery link' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    // Return the plain token (only time it's ever returned)
    return new Response(
      JSON.stringify({
        success: true,
        token,
        label,
        message: 'Save this link - it cannot be recovered if lost!'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
