import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    // 1. Riceve il payload JSON dal provider email (es. Resend / SendGrid / Mailgun)
    const payload = await req.json()
    
    // Estrae mittente, oggetto e testo (compatibile con i formati standard Webhook)
    const senderRaw = payload.from || payload.sender || payload.envelope?.from || ""
    const emailMittente = senderRaw.match(/<(.+)>/)?.[1] || senderRaw.trim().toLowerCase()
    const oggetto = (payload.subject || "").toLowerCase()
    const testo = payload.text || payload.plain || ""

    // 2. Connessione a Supabase con chiave Service Role (bypassa RLS per scrittura automatica)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. Cerca il dipendente tramite la sua email
    const { data: dipendente, error: errDip } = await supabase
      .from('profiles')
      .select('id, nome')
      .ilike('email', emailMittente)
      .single()

    if (errDip || !dipendente) {
      return new Response(JSON.stringify({ error: `Dipendente non trovato per email: ${emailMittente}` }), { status: 404 })
    }

    // 4. Riconosce automaticamente la tipologia dall'oggetto o dal testo
    let tipo = 'ferie'
    if (oggetto.includes('permesso') || oggetto.includes('rol')) tipo = 'permesso'
    else if (oggetto.includes('malattia')) tipo = 'malattia'
    else if (oggetto.includes('siem')) tipo = 'siem'
    else if (oggetto.includes('maternit')) tipo = 'maternita'

    // 5. Estrae le date dal testo (formato atteso: GG/MM/AAAA oppure AAAA-MM-GG)
    const dateTrovate = testo.match(/(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/g) || []
    
    const formattaDataISO = (dataStr: string) => {
      if (dataStr.includes('/')) {
        const [g, m, a] = dataStr.split('/')
        return `${a}-${m}-${g}`
      }
      return dataStr
    }

    const oggiISO = new Date().toISOString().split('T')[0]
    const dataInizio = dateTrovate[0] ? formattaDataISO(dateTrovate[0]) : oggiISO
    const dataFine = dateTrovate[1] ? formattaDataISO(dateTrovate[1]) : dataInizio

    // 6. Inserisce la richiesta nella tabella assenze in stato "in_attesa"
    const { error: errIns } = await supabase.from('assenze').insert([{
      dipendente_id: dipendente.id,
      tipo,
      data_inizio: dataInizio,
      data_fine: dataFine,
      stato: 'in_attesa',
      email_richiedente: emailMittente,
      note: `[Via Email] ${payload.subject || ''} - ${testo.slice(0, 150)}`
    }])

    if (errIns) throw errIns

    return new Response(JSON.stringify({ success: true, dipendente: dipendente.nome }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400 })
  }
})