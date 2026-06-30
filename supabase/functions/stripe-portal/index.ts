// =====================================================
// Stripe Customer Portal Edge Function
// =====================================================
// Creates Stripe Customer Portal sessions for subscription management
//
// NOTE: This function uses publishable/secret keys (non-JWT based).
// Deploy with: supabase functions deploy stripe-portal --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.8.0?target=deno'
import { getCorsHeaders } from '../_shared/cors.js'
import { jsonResponse } from '../_shared/response.js'
import { handleError } from '../_shared/errors.js'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) })
  }

  const corsHeaders = getCorsHeaders(req)

  try {
    // Validate apikey header (publishable/secret key - non-JWT based)
    const apikey = req.headers.get('apikey')
    const expectedKey = Deno.env.get('PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    if (!apikey || apikey !== expectedKey) {
      throw new Error('Invalid API key')
    }

    // Create Supabase client with user's auth
    // Note: Authorization header still contains user JWT for authentication
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      expectedKey,
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Parse request body
    const { organizationId, returnUrl } = await req.json()

    // Verify user is member of organization with admin rights
    const { data: membership, error: membershipError } = await supabaseClient
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership || !['owner', 'admin'].includes(membership.role)) {
      throw new Error('Unauthorized: Only owners and admins can manage billing')
    }

    // Get Stripe customer ID from organization
    const { data: org, error: orgError } = await supabaseClient
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', organizationId)
      .single()

    if (orgError || !org || !org.stripe_customer_id) {
      throw new Error('No Stripe customer found. Please subscribe to a plan first.')
    }

    // Create billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: returnUrl || `${req.headers.get('origin')}/dashboard/billing`,
    })

    return jsonResponse({ url: session.url }, corsHeaders)
  } catch (error) {
    return handleError(error, corsHeaders)
  }
})
