/**
 * Edge Function: get-buybacks
 *
 * Retrieves buyback records using a recovery token.
 * This allows anonymous users to access their data from any device
 * without requiring authentication.
 *
 * Security:
 * - Token is hashed before lookup (SHA-256)
 * - Uses service role to bypass RLS
 * - Updates last_accessed_at for audit trail
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

  try {
    // Get token from URL or body
    let token: string | null = null

    if (req.method === 'GET') {
      const url = new URL(req.url)
      token = url.searchParams.get('token')
    } else if (req.method === 'POST') {
      const body = await req.json()
      token = body.token
    }

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate token format (should be UUID-like)
    if (token.length < 32) {
      return new Response(
        JSON.stringify({ error: 'Invalid token format' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Hash the token for lookup
    const tokenHash = await hashToken(token)

    // Look up the token
    const { data: tokenData, error: tokenError } = await supabase
      .from('access_tokens')
      .select('id, user_id, label, created_at')
      .eq('token_hash', tokenHash)
      .single()

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({
          error: 'Invalid or expired recovery link',
          details: 'This link may have been deleted or never existed.'
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Update last accessed timestamp
    await supabase
      .from('access_tokens')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', tokenData.id)

    // Fetch buyback records for this user
    const { data: buybacks, error: buybacksError } = await supabase
      .from('buyback_records')
      .select('*')
      .eq('user_id', tokenData.user_id)
      .order('sell_date', { ascending: false })

    if (buybacksError) {
      console.error('Error fetching buybacks:', buybacksError)
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve buyback records' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Return the buyback records with metadata
    return new Response(
      JSON.stringify({
        success: true,
        label: tokenData.label,
        createdAt: tokenData.created_at,
        buybacks: buybacks || [],
        pendingCount: (buybacks || []).filter((b: any) => b.status === 'PENDING').length
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
