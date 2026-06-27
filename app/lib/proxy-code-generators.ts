import type { ProxyFunction, SecretMapping } from '~/types/proxy.types'

export type Platform = 'vercel' | 'netlify' | 'cloudflare' | 'aws-lambda'

/**
 * Map of variable_id -> variable key/name.
 * Used to resolve UUIDs in secret_mappings to human-readable env var names.
 */
export type VariableNameMap = Record<string, string>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveVarName(variableId: string, variables: VariableNameMap): string {
  return variables[variableId] || `UNKNOWN_VAR_${variableId.slice(0, 8)}`
}

/** Escape single quotes for use inside single-quoted JS string literals */
function escapeForSingleQuote(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/** Validate that a key is safe for use as a JS property key in bracket notation */
function sanitizeKey(key: string): string {
  return escapeForSingleQuote(key)
}

/** Strip newlines/carriage returns to prevent comment injection in generated code */
function sanitizeForComment(str: string): string {
  return str.replace(/[\r\n]/g, ' ')
}

function buildEnvVarComment(mappings: SecretMapping[], variables: VariableNameMap): string {
  if (mappings.length === 0) return '// No environment variables required.'
  const lines = ['// Required environment variables:']
  for (const m of mappings) {
    const name = resolveVarName(m.variable_id, variables)
    const target = m.inject_as === 'header' ? `header: ${m.key}` : `${m.inject_as}: ${m.key}`
    lines.push(`// - ${name} (injected as ${target})`)
  }
  return lines.join('\n')
}

function buildAllowedOriginsArray(origins: string[]): string {
  if (origins.length === 0) return '["*"]'
  return JSON.stringify(origins)
}

function buildCorsCheckCode(origins: string[], indent: string): string {
  return [
    `${indent}const allowedOrigins = ${buildAllowedOriginsArray(origins)};`,
    `${indent}const origin = requestOrigin || '';`,
    `${indent}const isAllowed = allowedOrigins.includes('*') || allowedOrigins.includes(origin);`,
    `${indent}const corsHeaders = {`,
    `${indent}  'Access-Control-Allow-Origin': isAllowed ? origin : '',`,
    `${indent}  'Access-Control-Allow-Methods': '${['OPTIONS'].join(', ')}, __METHOD__',`,
    `${indent}  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Proxy-Token',`,
    `${indent}};`,
  ].join('\n')
}

function buildSecretInjectionCode(
  mappings: SecretMapping[],
  variables: VariableNameMap,
  envAccessor: (varName: string) => string,
  indent: string
): string {
  const headerMappings = mappings.filter(m => m.inject_as === 'header')
  const queryMappings = mappings.filter(m => m.inject_as === 'query')
  const bodyMappings = mappings.filter(m => m.inject_as === 'body')

  const lines: string[] = []

  // Headers
  if (headerMappings.length > 0) {
    lines.push(`${indent}// Inject secrets into headers`)
    for (const m of headerMappings) {
      const name = resolveVarName(m.variable_id, variables)
      const accessor = envAccessor(name)
      const safeKey = sanitizeKey(m.key)
      if (m.template) {
        const templateStr = escapeForSingleQuote(m.template).replace('${value}', `\${${accessor}}`)
        lines.push(`${indent}headers['${safeKey}'] = \`${templateStr}\`;`)
      } else {
        lines.push(`${indent}headers['${safeKey}'] = ${accessor};`)
      }
    }
  }

  // Query params
  if (queryMappings.length > 0) {
    lines.push(`${indent}// Inject secrets into query parameters`)
    lines.push(`${indent}const url = new URL(targetUrl);`)
    for (const m of queryMappings) {
      const name = resolveVarName(m.variable_id, variables)
      const accessor = envAccessor(name)
      const safeKey = sanitizeKey(m.key)
      if (m.template) {
        const templateStr = escapeForSingleQuote(m.template).replace('${value}', `\${${accessor}}`)
        lines.push(`${indent}url.searchParams.set('${safeKey}', \`${templateStr}\`);`)
      } else {
        lines.push(`${indent}url.searchParams.set('${safeKey}', ${accessor});`)
      }
    }
    lines.push(`${indent}targetUrl = url.toString();`)
  }

  // Body
  if (bodyMappings.length > 0) {
    lines.push(`${indent}// Inject secrets into request body`)
    lines.push(`${indent}if (body && typeof body === 'object') {`)
    for (const m of bodyMappings) {
      const name = resolveVarName(m.variable_id, variables)
      const accessor = envAccessor(name)
      const safeKey = sanitizeKey(m.key)
      if (m.template) {
        const templateStr = escapeForSingleQuote(m.template).replace('${value}', `\${${accessor}}`)
        lines.push(`${indent}  body['${safeKey}'] = \`${templateStr}\`;`)
      } else {
        lines.push(`${indent}  body['${safeKey}'] = ${accessor};`)
      }
    }
    lines.push(`${indent}}`)
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Vercel Edge
// ---------------------------------------------------------------------------

export function generateVercelEdge(config: ProxyFunction, variables: VariableNameMap): string {
  const hasQueryMappings = config.secret_mappings.some(m => m.inject_as === 'query')

  const cors = buildCorsCheckCode(config.allowed_origins, '  ')
    .replace('__METHOD__', config.http_method)
    .replace('requestOrigin', 'req.headers.get("origin")')

  const secrets = buildSecretInjectionCode(
    config.secret_mappings,
    variables,
    (name) => `process.env.${name}`,
    '  '
  )

  return `${buildEnvVarComment(config.secret_mappings, variables)}
//
// Proxy: ${sanitizeForComment(config.name)}
// Target: ${sanitizeForComment(config.target_url)}
// Method: ${config.http_method}
// Platform: Vercel Edge Function

export const config = { runtime: 'edge' };

export default async function handler(req) {
  ${cors}

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Validate HTTP method
  if (req.method !== '${config.http_method}') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Build request to target
    let targetUrl = '${escapeForSingleQuote(config.target_url)}';
    const headers = ${JSON.stringify(config.target_headers || {}, null, 2).replace(/\n/g, '\n    ')};
${secrets ? '\n' + secrets : ''}
${config.pass_through_body && config.http_method !== 'GET' ? `
    // Forward request body
    let body = null;
    if (req.body) {
      body = await req.json();
    }` : `    let body = null;`}

    // Forward request
    const response = await fetch(${hasQueryMappings ? 'targetUrl' : 'targetUrl'}, {
      method: '${config.http_method}',
      headers,
      ${config.http_method !== 'GET' ? 'body: body ? JSON.stringify(body) : undefined,' : ''}
    });

    // Passthrough response
    const responseBody = await response.text();
    return new Response(responseBody, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Proxy request failed' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
`
}

// ---------------------------------------------------------------------------
// Netlify Functions
// ---------------------------------------------------------------------------

export function generateNetlifyFunction(config: ProxyFunction, variables: VariableNameMap): string {
  const secrets = buildSecretInjectionCode(
    config.secret_mappings,
    variables,
    (name) => `process.env.${name}`,
    '    '
  )

  return `${buildEnvVarComment(config.secret_mappings, variables)}
//
// Proxy: ${sanitizeForComment(config.name)}
// Target: ${sanitizeForComment(config.target_url)}
// Method: ${config.http_method}
// Platform: Netlify Function

const allowedOrigins = ${buildAllowedOriginsArray(config.allowed_origins)};

exports.handler = async function handler(event, context) {
  const origin = event.headers.origin || event.headers.Origin || '';
  const isAllowed = allowedOrigins.includes('*') || allowedOrigins.includes(origin);

  const corsHeaders = {
    'Access-Control-Allow-Origin': isAllowed ? origin : '',
    'Access-Control-Allow-Methods': 'OPTIONS, ${config.http_method}',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Proxy-Token',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  // Validate HTTP method
  if (event.httpMethod !== '${config.http_method}') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Build request to target
    let targetUrl = '${escapeForSingleQuote(config.target_url)}';
    const headers = ${JSON.stringify(config.target_headers || {}, null, 2).replace(/\n/g, '\n    ')};
${secrets ? '\n' + secrets : ''}
${config.pass_through_body && config.http_method !== 'GET' ? `
    // Forward request body
    let body = event.body ? JSON.parse(event.body) : null;` : `    let body = null;`}

    // Forward request
    const response = await fetch(targetUrl, {
      method: '${config.http_method}',
      headers,
      ${config.http_method !== 'GET' ? 'body: body ? JSON.stringify(body) : undefined,' : ''}
    });

    // Passthrough response
    const responseBody = await response.text();
    return {
      statusCode: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
      body: responseBody,
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Proxy request failed' }),
    };
  }
};
`
}

// ---------------------------------------------------------------------------
// Cloudflare Workers
// ---------------------------------------------------------------------------

export function generateCloudflareWorker(config: ProxyFunction, variables: VariableNameMap): string {
  const secrets = buildSecretInjectionCode(
    config.secret_mappings,
    variables,
    (name) => `env.${name}`,
    '    '
  )

  return `${buildEnvVarComment(config.secret_mappings, variables)}
//
// Proxy: ${sanitizeForComment(config.name)}
// Target: ${sanitizeForComment(config.target_url)}
// Method: ${config.http_method}
// Platform: Cloudflare Worker

const allowedOrigins = ${buildAllowedOriginsArray(config.allowed_origins)};

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('origin') || '';
    const isAllowed = allowedOrigins.includes('*') || allowedOrigins.includes(origin);

    const corsHeaders = {
      'Access-Control-Allow-Origin': isAllowed ? origin : '',
      'Access-Control-Allow-Methods': 'OPTIONS, ${config.http_method}',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Proxy-Token',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Validate HTTP method
    if (request.method !== '${config.http_method}') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      // Build request to target
      let targetUrl = '${escapeForSingleQuote(config.target_url)}';
      const headers = ${JSON.stringify(config.target_headers || {}, null, 2).replace(/\n/g, '\n      ')};
${secrets ? '\n' + secrets : ''}
${config.pass_through_body && config.http_method !== 'GET' ? `
      // Forward request body
      let body = null;
      if (request.body) {
        body = await request.json();
      }` : `      let body = null;`}

      // Forward request
      const response = await fetch(targetUrl, {
        method: '${config.http_method}',
        headers,
        ${config.http_method !== 'GET' ? 'body: body ? JSON.stringify(body) : undefined,' : ''}
      });

      // Passthrough response
      const responseBody = await response.text();
      return new Response(responseBody, {
        status: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': response.headers.get('Content-Type') || 'application/json',
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Proxy request failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
`
}

// ---------------------------------------------------------------------------
// AWS Lambda
// ---------------------------------------------------------------------------

export function generateAWSLambda(config: ProxyFunction, variables: VariableNameMap): string {
  const secrets = buildSecretInjectionCode(
    config.secret_mappings,
    variables,
    (name) => `process.env.${name}`,
    '    '
  )

  return `${buildEnvVarComment(config.secret_mappings, variables)}
//
// Proxy: ${sanitizeForComment(config.name)}
// Target: ${sanitizeForComment(config.target_url)}
// Method: ${config.http_method}
// Platform: AWS Lambda

const allowedOrigins = ${buildAllowedOriginsArray(config.allowed_origins)};

exports.handler = async (event) => {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const isAllowed = allowedOrigins.includes('*') || allowedOrigins.includes(origin);

  const corsHeaders = {
    'Access-Control-Allow-Origin': isAllowed ? origin : '',
    'Access-Control-Allow-Methods': 'OPTIONS, ${config.http_method}',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Proxy-Token',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  // Validate HTTP method
  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method !== '${config.http_method}') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Build request to target
    let targetUrl = '${escapeForSingleQuote(config.target_url)}';
    const headers = ${JSON.stringify(config.target_headers || {}, null, 2).replace(/\n/g, '\n    ')};
${secrets ? '\n' + secrets : ''}
${config.pass_through_body && config.http_method !== 'GET' ? `
    // Forward request body
    let body = event.body ? JSON.parse(event.body) : null;` : `    let body = null;`}

    // Forward request
    const response = await fetch(targetUrl, {
      method: '${config.http_method}',
      headers,
      ${config.http_method !== 'GET' ? 'body: body ? JSON.stringify(body) : undefined,' : ''}
    });

    // Passthrough response
    const responseBody = await response.text();
    return {
      statusCode: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
      body: responseBody,
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Proxy request failed' }),
    };
  }
};
`
}

// ---------------------------------------------------------------------------
// Unified generator
// ---------------------------------------------------------------------------

export function generateProxyCode(
  platform: Platform,
  config: ProxyFunction,
  variables: VariableNameMap
): string {
  switch (platform) {
    case 'vercel':
      return generateVercelEdge(config, variables)
    case 'netlify':
      return generateNetlifyFunction(config, variables)
    case 'cloudflare':
      return generateCloudflareWorker(config, variables)
    case 'aws-lambda':
      return generateAWSLambda(config, variables)
  }
}

export function getFileExtension(platform: Platform): string {
  switch (platform) {
    case 'vercel':
    case 'cloudflare':
      return '.ts'
    case 'netlify':
    case 'aws-lambda':
      return '.js'
  }
}

export function getFileName(platform: Platform, slug: string): string {
  return `proxy-${slug}${getFileExtension(platform)}`
}

export function getDeploymentInstructions(platform: Platform, slug: string): string {
  switch (platform) {
    case 'vercel':
      return `Save to \`api/proxy-${slug}.ts\` in your Vercel project`
    case 'netlify':
      return `Save to \`netlify/functions/proxy-${slug}.js\` in your Netlify project`
    case 'cloudflare':
      return `Deploy with \`wrangler deploy proxy-${slug}.ts\``
    case 'aws-lambda':
      return `Upload to AWS Lambda or save to your SAM/CDK project as \`proxy-${slug}.js\``
  }
}
