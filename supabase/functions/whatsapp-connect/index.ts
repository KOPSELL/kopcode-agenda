import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://agenda.kopcode.com.br",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("PROJECT_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
  const webhookUrl = Deno.env.get("N8N_WEBHOOK_URL");

  if (!supabaseUrl || !anonKey || !serviceKey || !evolutionUrl || !evolutionKey || !webhookUrl) {
    return json({ error: "Configuração da integração incompleta. Confira os Secrets do Supabase." }, 500);
  }

  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Faça login novamente." }, 401);

    const caller = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth, error: authError } = await caller.auth.getUser(token);
    if (authError || !auth.user) return json({ error: "Sua sessão expirou. Entre novamente." }, 401);

    const body = await req.json().catch(() => ({}));
    const barbershopId = String(body?.barbershop_id || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(barbershopId)) {
      return json({ error: "Barbearia inválida." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: shop, error: shopError } = await admin
      .from("barbershops")
      .select("id,owner_id,name")
      .eq("id", barbershopId)
      .maybeSingle();
    if (shopError) throw shopError;
    if (!shop || shop.owner_id !== auth.user.id) {
      return json({ error: "Você não tem permissão para conectar o WhatsApp desta barbearia." }, 403);
    }

    const { data: existing, error: existingError } = await admin
      .from("whatsapp_connections")
      .select("id,instance_name,active")
      .eq("barbershop_id", barbershopId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      return json({ error: "Esta barbearia já possui uma conexão cadastrada. Use a opção de reconectar." }, 409);
    }

    // Nome técnico gerado no servidor: o cliente nunca escolhe a instância.
    const instanceName = "ak-" + barbershopId.replace(/-/g, "").slice(0, 20);

    const createResponse = await fetch(evolutionUrl + "/instance/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evolutionKey },
      body: JSON.stringify({
        instanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
      }),
    });
    const createPayload = await createResponse.json().catch(() => ({}));
    if (!createResponse.ok) {
      console.error("Evolution create instance failed:", createResponse.status);
      return json({ error: "A Evolution API não conseguiu criar a conexão. Verifique o serviço e tente novamente." }, 502);
    }

    const webhookResponse = await fetch(evolutionUrl + "/webhook/set/" + encodeURIComponent(instanceName), {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evolutionKey },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhookByEvents: true,
          webhookBase64: false,
          events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
        },
      }),
    });

    if (!webhookResponse.ok) {
      await fetch(evolutionUrl + "/instance/delete/" + encodeURIComponent(instanceName), {
        method: "DELETE",
        headers: { apikey: evolutionKey },
      }).catch(() => undefined);
      console.error("Evolution webhook setup failed:", webhookResponse.status);
      return json({ error: "A instância foi criada, mas não foi possível configurar o webhook. Tente novamente." }, 502);
    }

    const qr = createPayload?.qrcode?.base64 || createPayload?.qrcode?.code || createPayload?.base64 || null;
    if (!qr) {
      await fetch(evolutionUrl + "/instance/delete/" + encodeURIComponent(instanceName), {
        method: "DELETE",
        headers: { apikey: evolutionKey },
      }).catch(() => undefined);
      return json({ error: "A Evolution criou a instância, mas não retornou o QR Code. Tente novamente." }, 502);
    }

    const { error: insertError } = await admin.from("whatsapp_connections").insert({
      barbershop_id: barbershopId,
      instance_name: instanceName,
      active: true,
    });
    if (insertError) {
      await fetch(evolutionUrl + "/instance/delete/" + encodeURIComponent(instanceName), {
        method: "DELETE",
        headers: { apikey: evolutionKey },
      }).catch(() => undefined);
      if (insertError.code === "23505") return json({ error: "Esta barbearia já possui uma conexão WhatsApp." }, 409);
      throw insertError;
    }

    return json({
      success: true,
      instance_name: instanceName,
      qrcode: qr,
      pairing_code: createPayload?.qrcode?.pairingCode || null,
      message: "Leia o QR Code com o WhatsApp da barbearia.",
    });
  } catch (error) {
    console.error("whatsapp-connect:", error);
    return json({ error: "Não foi possível iniciar a conexão do WhatsApp. Tente novamente." }, 500);
  }
});
