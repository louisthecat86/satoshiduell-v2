const LNBITS_URL = Deno.env.get('LNBITS_URL') || '';
const LNBITS_ADMIN_KEY = Deno.env.get('LNBITS_ADMIN_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const jsonResponse = (body: Record<string, unknown>, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!LNBITS_URL || !LNBITS_ADMIN_KEY) {
    return jsonResponse({ ok: false, error: 'Missing LNBITS_URL or LNBITS_ADMIN_KEY' }, 500);
  }

  let payload: { amount?: number; gameId?: string | number; linkId?: string } = {};
  try {
    payload = await req.json();
  } catch (_e) {
    payload = {};
  }

  if (payload.linkId) {
    try {
      const response = await fetch(`${LNBITS_URL}/withdraw/api/v1/links/${payload.linkId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': LNBITS_ADMIN_KEY
        }
      });

      if (!response.ok) {
        return jsonResponse({ ok: false, error: 'Failed to fetch withdraw link status' }, 500);
      }

      const data = await response.json();
      return jsonResponse({ ok: true, used: data.used >= 1 });
    } catch (_e) {
      return jsonResponse({ ok: false, error: 'Withdraw status request failed' }, 500);
    }
  }

  const amount = Math.floor(Number(payload.amount || 0));
  const gameId = payload.gameId ? String(payload.gameId) : '';

  if (!amount || amount <= 0) {
    return jsonResponse({ ok: false, error: 'Invalid amount' }, 400);
  }

  try {
    const response = await fetch(`${LNBITS_URL}/withdraw/api/v1/links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': LNBITS_ADMIN_KEY
      },
      body: JSON.stringify({
        title: gameId ? `SatoshiDuell Win #${gameId}` : 'SatoshiDuell Win',
        min_withdrawable: amount,
        max_withdrawable: amount,
        uses: 1,
        wait_time: 1,
        is_unique: false
      })
    });

    if (!response.ok) {
      return jsonResponse({ ok: false, error: 'Konnte Auszahlung nicht erstellen' }, 500);
    }

    const data = await response.json();
    return jsonResponse({ ok: true, lnurl: data.lnurl, id: data.id });
  } catch (_e) {
    return jsonResponse({ ok: false, error: 'Withdraw request failed' }, 500);
  }
});
