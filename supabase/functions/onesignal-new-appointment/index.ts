import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://agenda.kopcode.com.br",
  "Access-Control-Allow-Headers": "content-type, x-agenda-webhook-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const webhookSecret = Deno.env.get("AGENDA_WEBHOOK_SECRET");
  const suppliedSecret = req.headers.get("x-agenda-webhook-secret");
  if (!webhookSecret || !suppliedSecret || suppliedSecret !== webhookSecret) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const oneSignalApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
  const oneSignalAppId = "6f5236f9-abb1-41d6-ba45-99c7870e1d50";

  if (!supabaseUrl || !serviceRoleKey || !oneSignalApiKey) {
    return new Response("Missing server configuration", { status: 500, headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const appointmentId = payload?.record?.id;
    const barbershopId = payload?.record?.barbershop_id;

    if (!appointmentId || !barbershopId) {
      return new Response("Missing appointment identifiers", { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Always re-read trusted data from Supabase; never trust names or owner IDs
    // supplied in the database webhook body.
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("id, barbershop_id, client_name, starts_at, status, service_id, barber_id")
      .eq("id", appointmentId)
      .eq("barbershop_id", barbershopId)
      .maybeSingle();

    if (appointmentError) throw appointmentError;
    if (!appointment || !["pending", "confirmed"].includes(appointment.status)) {
      return new Response(JSON.stringify({ skipped: "Appointment missing or inactive" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: shop, error: shopError } = await supabase
      .from("barbershops")
      .select("id, name, owner_id")
      .eq("id", appointment.barbershop_id)
      .maybeSingle();

    if (shopError) throw shopError;
    if (!shop?.owner_id) {
      return new Response(JSON.stringify({ skipped: "Shop owner not found" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: service }, { data: barber }] = await Promise.all([
      supabase.from("services").select("name").eq("id", appointment.service_id).eq("barbershop_id", shop.id).maybeSingle(),
      supabase.from("barbers").select("name").eq("id", appointment.barber_id).eq("barbershop_id", shop.id).maybeSingle(),
    ]);

    const date = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
    }).format(new Date(appointment.starts_at));

    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${oneSignalApiKey}`,
      },
      body: JSON.stringify({
        app_id: oneSignalAppId,
        headings: { pt: "Novo agendamento" },
        contents: {
          pt: `${appointment.client_name} marcou ${service?.name || "um serviço"} em ${date} com ${barber?.name || "seu profissional"}.`,
        },
        include_aliases: { external_id: [shop.owner_id] },
        target_channel: "push",
        url: "https://agenda.kopcode.com.br/",
        idempotency_key: `agenda-appointment-${appointment.id}`,
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("OneSignal API error", response.status, result);
      return new Response(JSON.stringify({ error: "OneSignal rejected notification", details: result }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, onesignal: result }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Notification function failed", error);
    return new Response("Internal server error", { status: 500, headers: corsHeaders });
  }
});
