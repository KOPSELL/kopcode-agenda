import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://agenda.kopcode.com.br",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) {
    return new Response(JSON.stringify({ error: "Configuração do Supabase incompleta." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token) return new Response(JSON.stringify({ error: "Faça login novamente." }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const caller = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await caller.auth.getUser(token);
    if (authError || !authData.user) return new Response(JSON.stringify({ error: "Sessão inválida." }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const body = await req.json();
    const barberId = String(body?.barber_id || "");
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    if (!barberId || !email || password.length < 8) {
      return new Response(JSON.stringify({ error: "Informe barbeiro, e-mail e senha com pelo menos 8 caracteres." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: barber, error: barberError } = await admin
      .from("barbers")
      .select("id,name,barbershop_id,user_id,active")
      .eq("id", barberId)
      .maybeSingle();

    if (barberError) throw barberError;
    if (!barber || !barber.active) return new Response(JSON.stringify({ error: "Profissional não encontrado ou inativo." }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    if (barber.user_id) return new Response(JSON.stringify({ error: "Este profissional já possui acesso. Use a opção de redefinir senha." }), {
      status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const { data: shop, error: shopError } = await admin
      .from("barbershops")
      .select("id,owner_id")
      .eq("id", barber.barbershop_id)
      .maybeSingle();
    if (shopError) throw shopError;
    if (!shop || shop.owner_id !== authData.user.id) {
      return new Response(JSON.stringify({ error: "Você não tem permissão para criar acesso nesta barbearia." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: barber.name, account_type: "barber", barbershop_id: barber.barbershop_id },
    });
    if (createError) throw createError;

    const { error: linkError } = await admin.from("barbers")
      .update({ user_id: created.user.id })
      .eq("id", barber.id)
      .eq("barbershop_id", barber.barbershop_id)
      .is("user_id", null);

    if (linkError) {
      await admin.auth.admin.deleteUser(created.user.id);
      throw linkError;
    }

    return new Response(JSON.stringify({
      success: true,
      barber: barber.name,
      email,
      login_url: "https://agenda.kopcode.com.br/barber",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("create-barber-user:", error);
    const message = error instanceof Error ? error.message : "Não foi possível criar o acesso.";
    return new Response(JSON.stringify({ error: message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
