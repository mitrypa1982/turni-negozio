import React, { useEffect, useState } from 'react'
import { supabase } from './supabase'
import Login from './Login'
import { startOfWeek, addDays, format, isSameDay, parseISO, getDay, isWithinInterval, differenceInWeeks, addWeeks } from 'date-fns'
import { it } from 'date-fns/locale'
import ExcelJS from 'exceljs'

const getStileTurno = (inizio: string, fine: string) => {
  const hInizio = parseInt(inizio.split(':')[0]);
  const mInizio = parseInt(inizio.split(':')[1]);
  const hFine = parseInt(fine.split(':')[0]);
  const mFine = parseInt(fine.split(':')[1]);
  
  const oraInizioDec = hInizio + (mInizio / 60);
  const oraFineDec = hFine + (mFine / 60);

  if (oraFineDec >= 20.5) return 'bg-indigo-50/80 text-indigo-700 border-indigo-200/60 shadow-sm'; 
  if (oraInizioDec <= 9.5 && oraFineDec <= 14.5) return 'bg-emerald-50/80 text-emerald-700 border-emerald-200/60 shadow-sm'; 
  if (oraInizioDec >= 13.5 && oraFineDec <= 17.5) return 'bg-purple-50/80 text-purple-700 border-purple-200/60 shadow-sm'; 
  if (oraInizioDec >= 10.0 && oraFineDec <= 12) return 'bg-amber-50/80 text-amber-700 border-amber-200/60 shadow-sm'; 
  return 'bg-blue-50/80 text-blue-700 border-blue-200/60 shadow-sm';
}

const shuffleArray = (array: any[]) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function App() {
  const [utente, setUtente] = useState<any>(null)
  const [caricamento, setCaricamento] = useState(true)
  const [turni, setTurni] = useState<any[]>([])
  const [dipendenti, setDipendenti] = useState<any[]>([])
  const [assenze, setAssenze] = useState<any[]>([])
  const [impostazioni, setImpostazioni] = useState<any>(null)
  const [giorniChiusura, setGiorniChiusura] = useState<any[]>([])
  
  const [vistaCorrente, setVistaCorrente] = useState<'turni' | 'stats' | 'assenze' | 'dipendenti' | 'impostazioni'>('turni')
  const [dataInizio, setDataInizio] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  
  const [settimaneDaGenerare, setSettimaneDaGenerare] = useState(1)
  const [repartoFiltro, setRepartoFiltro] = useState('TUTTI')
  const [repartoFiltroStats, setRepartoFiltroStats] = useState('TUTTI')

  const [dipendenteSelezionato, setDipendenteSelezionato] = useState('')
  const [dataTurno, setDataTurno] = useState('')
  const [oraInizio, setOraInizio] = useState('')
  const [oraFine, setOraFine] = useState('')

  // Stato modale modifica turno esistente
  const [turnoInModifica, setTurnoInModifica] = useState<any>(null)
  const [modOraInizio, setModOraInizio] = useState('')
  const [modOraFine, setModOraFine] = useState('')
  const [modNote, setModNote] = useState('')

  const [assDipendente, setAssDipendente] = useState('')
  const [assEmail, setAssEmail] = useState('')
  const [assInizio, setAssInizio] = useState('')
  const [assFine, setAssFine] = useState('')
  const [assTipo, setAssTipo] = useState('ferie')
  const [assNote, setAssNote] = useState('')
  const [filtroStatoRichieste, setFiltroStatoRichieste] = useState<'TUTTE' | 'in_attesa' | 'approvato' | 'rifiutato'>('TUTTE')

  // Form nuovo dipendente
  const [nuovoNome, setNuovoNome] = useState('')
  const [nuovoReparto, setNuovoReparto] = useState('TELEFONIA')
  const [nuoveOre, setNuoveOre] = useState(40)
  const [nuoviRepartiExtra, setNuoviRepartiExtra] = useState('')

  // Form nuova chiusura negozio
  const [nuovaDataChiusura, setNuovaDataChiusura] = useState('')
  const [nuovaMotivazioneChiusura, setNuovaMotivazioneChiusura] = useState('Chiusura Festiva')

  const [generazioneInCorso, setGenerazioneInCorso] = useState(false)
  const [anomalieModalAperto, setAnomalieModalAperto] = useState(false)
  const [listaAnomalie, setListaAnomalie] = useState<any[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUtente(session?.user || null)
      setCaricamento(false)
    })
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => setUtente(session?.user || null))
    return () => authListener.subscription.unsubscribe()
  }, [])

  const caricaDati = async () => {
    const { data: turniData } = await supabase.from('turni').select(`*, profiles (nome, reparto)`).order('data', { ascending: true })
    if (turniData) setTurni(turniData)
    
    const { data: dipData } = await supabase.from('profiles').select('*').neq('nome', 'Admin').order('nome', { ascending: true })
    if (dipData) setDipendenti(dipData)
    
    const { data: impData } = await supabase.from('impostazioni').select('*').single()
    if (impData) setImpostazioni(impData)

    const { data: assData } = await supabase.from('assenze').select('*').order('data_inizio', { ascending: false })
    if (assData) setAssenze(assData)

    const { data: chiusureData } = await supabase.from('giorni_chiusura').select('*').order('data', { ascending: true })
    if (chiusureData) setGiorniChiusura(chiusureData)
  }

  useEffect(() => { if (utente) caricaDati() }, [utente])

  const salvaImpostazioni = async () => {
    await supabase.from('impostazioni').update(impostazioni).eq('id', 1)
    alert("Regole orarie salvate con successo!")
  }

  const aggiungiChiusura = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuovaDataChiusura) return alert("Seleziona una data!")
    const { error } = await supabase.from('giorni_chiusura').insert([{ data: nuovaDataChiusura, motivazione: nuovaMotivazioneChiusura || 'Chiusura Festiva' }])
    if (error) return alert("Errore: " + error.message)
    setNuovaDataChiusura('')
    caricaDati()
    alert("Giorno di chiusura aggiunto con successo al calendario!")
  }

  const eliminaChiusura = async (id: string) => {
    const { error } = await supabase.from('giorni_chiusura').delete().eq('id', id)
    if (error) return alert("Errore: " + error.message)
    caricaDati()
  }

  const aggiungiDipendente = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuovoNome) return alert("Inserisci il nome del dipendente!")
    const { error } = await supabase.from('profiles').insert([{
      nome: nuovoNome.toUpperCase(),
      reparto: nuovoReparto,
      ore_settimanali: Number(nuoveOre),
      reparti_extra: nuoviRepartiExtra
    }])
    if (error) return alert("Errore inserimento dipendente: " + error.message)
    setNuovoNome(''); setNuoveOre(40); setNuoviRepartiExtra('')
    caricaDati()
    alert("Dipendente aggiunto con successo!")
  }

  const eliminaDipendente = async (id: string, nome: string) => {
    if (window.confirm(`Sei sicuro di voler eliminare ${nome} dal database?`)) {
      const { error } = await supabase.from('profiles').delete().eq('id', id)
      if (error) return alert("Errore eliminazione: " + error.message)
      caricaDati()
    }
  }

  const aggiornaDipendenteDB = async (dip: any) => {
    const { error } = await supabase.from('profiles').update({
      reparto: dip.reparto,
      ore_settimanali: dip.ore_settimanali,
      reparti_extra: dip.reparti_extra
    }).eq('id', dip.id)
    if (error) alert("Errore aggiornamento: " + error.message)
    else alert(`Modifiche salvate per ${dip.nome}!`)
    caricaDati()
  }

  const salvaAssenza = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assDipendente || !assInizio || !assFine) return alert("Compila tutti i campi obbligatori!")
    
    const dip = dipendenti.find(d => d.id === assDipendente)
    const emailFinale = assEmail || dip?.email || utente?.email || ''

    const { error } = await supabase.from('assenze').insert([{ 
      dipendente_id: assDipendente, 
      data_inizio: assInizio, 
      data_fine: assFine, 
      tipo: assTipo, 
      stato: 'in_attesa',
      email_richiedente: emailFinale,
      note: assNote
    }])

    if (error) return alert("Errore nel salvataggio: " + error.message)

    setAssDipendente(''); setAssEmail(''); setAssInizio(''); setAssFine(''); setAssNote('')
    caricaDati()
    alert("Richiesta inviata con successo! È ora visibile nel pannello di approvazione.")
  }

  const approvaAssenza = async (idRichiesta: string, nuovoStato: 'approvato' | 'rifiutato') => {
    const { error } = await supabase.from('assenze').update({ stato: nuovoStato }).eq('id', idRichiesta)
    if (error) {
      alert("Errore aggiornamento stato: " + error.message)
      return
    }
    setAssenze(prev => prev.map(a => a.id === idRichiesta ? { ...a, stato: nuovoStato } : a))
    caricaDati()
  }

  const eliminaAssenza = async (id: string) => {
    if (window.confirm("Eliminare questa richiesta?")) { 
      const { error } = await supabase.from('assenze').delete().eq('id', id); 
      if (error) {
        alert("Errore eliminazione: " + error.message);
        return;
      }
      caricaDati() 
    }
  }

  const analizzaEControlloAnomalie = (turniGenerati: any[], giorniRiferimento: Date[]) => {
    const anomalie: any[] = [];
    dipendenti.forEach(dip => {
      const turniDip = turniGenerati.filter(t => t.dipendente_id === dip.id && isWithinInterval(parseISO(t.data), { start: giorniRiferimento[0], end: giorniRiferimento[6] }));
      const oreAssegnate = turniDip.reduce((tot, t) => {
        const [hIn, mIn] = t.ora_inizio.split(':').map(Number);
        const [hFin, mFin] = t.ora_fine.split(':').map(Number);
        let durata = (hFin + (mFin/60)) - (hIn + (mIn/60));
        if (durata < 0) durata = 0;
        return tot + durata;
      }, 0);

      const differenza = dip.ore_settimanali - oreAssegnate;
      if (Math.abs(differenza) > 0.1) {
        anomalie.push({
          dipendenteId: dip.id,
          nome: dip.nome,
          reparto: dip.reparto,
          orePreviste: dip.ore_settimanali,
          oreAttuali: oreAssegnate,
          differenza: differenza, 
          turniDip: turniDip
        });
      }
    });
    return anomalie;
  };

  const formatOra = (oraDecimale: number) => {
    const h = Math.floor(oraDecimale);
    const m = Math.round((oraDecimale - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const trovaTurnoIdealePerModifica = (turniDip: any[], differenza: number) => {
    if (!turniDip || turniDip.length === 0) return null;
    
    const turniValidi = turniDip.filter(t => !t.note?.includes('Spezzato Sera'));
    const listaDaUsare = turniValidi.length > 0 ? turniValidi : turniDip;

    const turniConDurata = listaDaUsare.map(t => {
      const [hIn, mIn] = t.ora_inizio.split(':').map(Number);
      const [hFin, mFin] = t.ora_fine.split(':').map(Number);
      let durata = (hFin + (mFin/60)) - (hIn + (mIn/60));
      if (durata < 0) durata = 6;
      return { ...t, durata };
    });

    if (differenza < 0) {
      turniConDurata.sort((a, b) => b.durata - a.durata);
    } else {
      turniConDurata.sort((a, b) => a.durata - b.durata);
    }

    return turniConDurata[0];
  };

  const applicaSoluzioneAnomalia = async (anomalia: any) => {
    const turnoScelto = trovaTurnoIdealePerModifica(anomalia.turniDip, anomalia.differenza);
    
    if (turnoScelto) {
      const [hIn, mIn] = turnoScelto.ora_inizio.split(':').map(Number);
      const [hFin, mFin] = turnoScelto.ora_fine.split(':').map(Number);
      const inizioDec = hIn + (mIn / 60);
      let fineDec = hFin + (mFin / 60);
      if (fineDec < inizioDec) fineDec = inizioDec + 5;

      let nuovaFineDec = fineDec + anomalia.differenza;
      if (nuovaFineDec > 21.0) nuovaFineDec = 21.0;
      if (nuovaFineDec < inizioDec + 2) nuovaFineDec = inizioDec + 2;
      
      await supabase
        .from('turni')
        .update({ ora_fine: formatOra(nuovaFineDec) })
        .eq('id', turnoScelto.id);
    }

    const nuovaLista = listaAnomalie.filter(a => a.dipendenteId !== anomalia.dipendenteId);
    setListaAnomalie(nuovaLista);
    if (nuovaLista.length === 0) {
      setAnomalieModalAperto(false);
      await caricaDati();
      alert("Tutte le anomalie sono state corrette con successo!");
    }
  };

  const risolviTutteLeAnomalie = async () => {
    try {
      for (const anom of listaAnomalie) {
        const turnoScelto = trovaTurnoIdealePerModifica(anom.turniDip, anom.differenza);
        if (turnoScelto) {
          const [hIn, mIn] = turnoScelto.ora_inizio.split(':').map(Number);
          const [hFin, mFin] = turnoScelto.ora_fine.split(':').map(Number);
          const inizioDec = hIn + (mIn / 60);
          let fineDec = hFin + (mFin / 60);
          if (fineDec < inizioDec) fineDec = inizioDec + 5;

          let nuovaFineDec = fineDec + anom.differenza;
          if (nuovaFineDec > 21.0) nuovaFineDec = 21.0;
          if (nuovaFineDec < inizioDec + 2) nuovaFineDec = inizioDec + 2;
          
          await supabase
            .from('turni')
            .update({ ora_fine: formatOra(nuovaFineDec) })
            .eq('id', turnoScelto.id);
        }
      }
      
      setListaAnomalie([]);
      setAnomalieModalAperto(false);
      await caricaDati();
      alert("Tutte le anomalie sono state corrette e salvate con successo nel database!");
    } catch (error: any) {
      alert("Errore durante la correzione massiva: " + error.message);
    }
  };

  const generaTurni = async () => {
    const etichettaPeriodo = settimaneDaGenerare >= 4 ? `1 Mese (${settimaneDaGenerare} settimane)` : `${settimaneDaGenerare} settimana/e`;

    if (!window.confirm(`Vuoi generare i turni per ${etichettaPeriodo} a partire da questa settimana?\nI turni esistenti in questo periodo verranno sovrascritti.`)) return;
    setGenerazioneInCorso(true);
    
    try {
      const tutteLeDate: Date[] = [];
      for (let w = 0; w < settimaneDaGenerare; w++) {
        const inizioSettimana = addWeeks(dataInizio, w);
        for (let d = 0; d < 7; d++) {
          tutteLeDate.push(addDays(inizioSettimana, d));
        }
      }
      
      const dateString = tutteLeDate.map(g => format(g, 'yyyy-MM-dd'));
      for (let i = 0; i < dateString.length; i += 30) {
        const chunk = dateString.slice(i, i + 30);
        await supabase.from('turni').delete().in('data', chunk);
      }
      
      const nuoviTurni: any[] = [];
      const dateChiusuraSet = new Set(giorniChiusura.map(c => c.data));

      const isInAssenza = (dipId: string, data: Date) => assenze.some(a => 
        a.dipendente_id === dipId && 
        a.stato === 'approvato' && 
        isWithinInterval(data, { start: parseISO(a.data_inizio), end: parseISO(a.data_fine) })
      );

      const storicoTurni: Record<string, { mattine: number, pomeriggi: number, sere: number, spezzati: number, scarichi: number, uscite2030: number }> = {};
      dipendenti.forEach(d => storicoTurni[d.id] = { mattine: 0, pomeriggi: 0, sere: 0, spezzati: 0, scarichi: 0, uscite2030: 0 });

      for (let w = 0; w < settimaneDaGenerare; w++) {
        const inizioSettimana = addWeeks(dataInizio, w);
        const giorniSettimana = Array.from({ length: 7 }).map((_, i) => addDays(inizioSettimana, i));
        const settimaneTrascorse = differenceInWeeks(inizioSettimana, new Date('2026-11-16'));
        
        const giornoRiposoPerDipendente: Record<string, number> = {};
        const repartiUnici = [...new Set(dipendenti.map(d => d.reparto))];

        repartiUnici.forEach(reparto => {
          const dipRep = dipendenti.filter(d => d.reparto === reparto);
          dipRep.forEach((dItem, index) => {
            const offsetIniziale = index % 7;
            let giorno = (offsetIniziale - settimaneTrascorse) % 7;
            if (giorno < 0) giorno += 7;
            giornoRiposoPerDipendente[dItem.id] = giorno;
          });
        });

        const oreSettimanaliAssegnate: Record<string, number> = {};
        dipendenti.forEach(d => oreSettimanaliAssegnate[d.id] = 0);
        const ultimoTipoTurno: Record<string, string> = {};

        for (let i = 0; i < 7; i++) {
          const giornoCorrente = giorniSettimana[i];
          const dataStr = format(giornoCorrente, 'yyyy-MM-dd');
          const dayOfWeek = getDay(giornoCorrente); 

          if (dateChiusuraSet.has(dataStr)) {
            continue;
          }

          const occupatiOggi = new Set<string>();
          const oraAperturaDef = dayOfWeek === 0 ? 10.0 : 9.0;
          const oraChiusuraDef = 21.0;

          if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            const magazzinieri = dipendenti.filter(d => d.reparto === 'MAGAZZINO' && !isInAssenza(d.id, giornoCorrente) && giornoRiposoPerDipendente[d.id] !== i);
            if (magazzinieri.length > 0) {
              magazzinieri.sort((a, b) => storicoTurni[a.id].scarichi - storicoTurni[b.id].scarichi);
              const mg = magazzinieri[0];
              nuoviTurni.push({ dipendente_id: mg.id, data: dataStr, ora_inizio: '07:30', ora_fine: '12:30', note: 'Scarico merci' });
              oreSettimanaliAssegnate[mg.id] += 5;
              occupatiOggi.add(mg.id);
              storicoTurni[mg.id].scarichi++;
              ultimoTipoTurno[mg.id] = 'mattina';
            }

            const candidatiScarico = dipendenti.filter(d => ['DE NISI', 'SPEZZATI', 'BRUNO', 'FRAZZANO'].some(nome => d.nome.includes(nome)) && !isInAssenza(d.id, giornoCorrente) && giornoRiposoPerDipendente[d.id] !== i);
            if (candidatiScarico.length > 0) {
              candidatiScarico.sort((a, b) => storicoTurni[a.id].scarichi - storicoTurni[b.id].scarichi);
              const dipRot = candidatiScarico[0];
              nuoviTurni.push({ dipendente_id: dipRot.id, data: dataStr, ora_inizio: '07:30', ora_fine: '14:30', note: 'Scarico merci' });
              oreSettimanaliAssegnate[dipRot.id] += 7;
              occupatiOggi.add(dipRot.id);
              storicoTurni[dipRot.id].scarichi++;
              ultimoTipoTurno[dipRot.id] = 'mattina';
            }
          }

          const bruno = dipendenti.find(d => d.nome === 'BRUNO');
          const frazzano = dipendenti.find(d => d.nome === 'FRAZZANO');
          [bruno, frazzano].forEach((dir, idx) => {
            if (dir && !isInAssenza(dir.id, giornoCorrente) && giornoRiposoPerDipendente[dir.id] !== i && !occupatiOggi.has(dir.id)) {
              const oreResidue = dir.ore_settimanali - oreSettimanaliAssegnate[dir.id];
              if (oreResidue > 0) {
                const giorniLavorativiRimasti = giorniSettimana.slice(i).filter(g => {
                  const idxGiorno = giorniSettimana.indexOf(g);
                  return giornoRiposoPerDipendente[dir.id] !== idxGiorno && !isInAssenza(dir.id, g);
                });

                const isUltimoGiornoLavorativo = giorniLavorativiRimasti.length <= 1;
                let oreDaFareOGGI = isUltimoGiornoLavorativo ? oreResidue : Math.round((oreResidue / giorniLavorativiRimasti.length) * 2) / 2;
                const maxOreGiorno = impostazioni?.max_ore_giornaliere || 7.5;
                if (!isUltimoGiornoLavorativo && oreDaFareOGGI > maxOreGiorno) oreDaFareOGGI = maxOreGiorno;

                const inizioDir = idx === 0 ? 9.0 : 10.0;
                nuoviTurni.push({ dipendente_id: dir.id, data: dataStr, ora_inizio: formatOra(inizioDir), ora_fine: formatOra(inizioDir + oreDaFareOGGI), note: 'Direzione' });
                oreSettimanaliAssegnate[dir.id] += oreDaFareOGGI;
                occupatiOggi.add(dir.id);
                storicoTurni[dir.id].pomeriggi++;
              }
            }
          });

          for (const reparto of repartiUnici) {
            let dipReparto = dipendenti.filter(d => 
              (d.reparto === reparto || (d.reparti_extra && d.reparti_extra.toUpperCase().includes(reparto))) && 
              d.nome !== 'BRUNO' && d.nome !== 'FRAZZANO' &&
              !isInAssenza(d.id, giornoCorrente) &&
              giornoRiposoPerDipendente[d.id] !== i &&
              !occupatiOggi.has(d.id)
            );
            
            if (dipReparto.length === 0) continue;
            dipReparto = shuffleArray(dipReparto);

            let maxAperture = 2;
            let maxChiusure = 2;
            let apertureAssegnate = 0;
            let chiusureAssegnate = 0;

            const chiusureRepartoOggi: any[] = [];

            for (const dip of dipReparto) {
              const oreResidue = dip.ore_settimanali - (oreSettimanaliAssegnate[dip.id] || 0);
              if (oreResidue <= 0) continue;

              const giorniLavorativiRimasti = giorniSettimana.slice(i).filter(g => {
                const idxGiorno = giorniSettimana.indexOf(g);
                return giornoRiposoPerDipendente[dip.id] !== idxGiorno && !isInAssenza(dip.id, g);
              });

              const isUltimoGiornoLavorativo = giorniLavorativiRimasti.length <= 1;
              let oreOggi = 0;
              if (isUltimoGiornoLavorativo) {
                oreOggi = oreResidue;
              } else {
                oreOggi = Math.round((oreResidue / giorniLavorativiRimasti.length) * 2) / 2;
                const maxOreGiorno = impostazioni?.max_ore_giornaliere || 7.5;
                if (oreOggi > maxOreGiorno) oreOggi = maxOreGiorno;
              }

              const storico = storicoTurni[dip.id];
              const ultimoTurno = ultimoTipoTurno[dip.id] || '';

              const deveFareSpezzato = dip.ore_settimanali >= 40 && storico.spezzati < 2 && (7 - i <= 2 || storico.spezzati === 0);

              let tipoTurno = 'centrale';
              if (deveFareSpezzato && oreOggi >= 7) {
                tipoTurno = 'spezzato';
              } else if (apertureAssegnate < maxAperture && ultimoTurno !== 'mattina' && storico.mattine <= storico.sere) {
                tipoTurno = 'mattina';
                apertureAssegnate++;
              } else if (chiusureAssegnate < maxChiusure && ultimoTurno !== 'chiusura' && storico.sere <= storico.mattine) {
                tipoTurno = 'chiusura';
                chiusureAssegnate++;
              }

              if (tipoTurno === 'chiusura') {
                const turnoObj = { dipendente_id: dip.id, data: dataStr, ora_inizio: formatOra(oraChiusuraDef - oreOggi), ora_fine: formatOra(oraChiusuraDef), note: 'Chiusura', dipObj: dip, oreOggi };
                chiusureRepartoOggi.push(turnoObj);
                oreSettimanaliAssegnate[dip.id] += oreOggi;
                storico.sere++;
                ultimoTipoTurno[dip.id] = 'chiusura';
              } else if (tipoTurno === 'mattina') {
                nuoviTurni.push({ dipendente_id: dip.id, data: dataStr, ora_inizio: formatOra(oraAperturaDef), ora_fine: formatOra(oraAperturaDef + oreOggi), note: 'Apertura' });
                oreSettimanaliAssegnate[dip.id] += oreOggi;
                storico.mattine++;
                ultimoTipoTurno[dip.id] = 'mattina';
              } else if (tipoTurno === 'spezzato') {
                const meta = Math.round((oreOggi / 2) * 2) / 2;
                nuoviTurni.push({ dipendente_id: dip.id, data: dataStr, ora_inizio: '09:00', ora_fine: formatOra(9 + meta), note: 'Spezzato Mattina' });
                nuoviTurni.push({ dipendente_id: dip.id, data: dataStr, ora_inizio: formatOra(21 - meta), ora_fine: '21:00', note: 'Spezzato Sera' });
                oreSettimanaliAssegnate[dip.id] += oreOggi;
                storico.spezzati++;
                ultimoTipoTurno[dip.id] = 'spezzato';
              } else {
                const possibiliInizi = dayOfWeek === 0 ? [10.0, 10.5] : [10.0, 10.5, 11.0, 11.5];
                const inizioScelto = possibiliInizi[Math.floor(Math.random() * possibiliInizi.length)];
                nuoviTurni.push({ dipendente_id: dip.id, data: dataStr, ora_inizio: formatOra(inizioScelto), ora_fine: formatOra(inizioScelto + oreOggi), note: 'Centrale' });
                oreSettimanaliAssegnate[dip.id] += oreOggi;
                storico.pomeriggi++;
                ultimoTipoTurno[dip.id] = 'centrale';
              }
            }

            if (chiusureRepartoOggi.length > 0) {
              const isCasseOTelefonia = reparto.toUpperCase().includes('CASSE') || reparto.toUpperCase().includes('TELEFONIA');

              if (!isCasseOTelefonia && chiusureRepartoOggi.length === 2) {
                chiusureRepartoOggi.sort((a, b) => storicoTurni[a.dipendente_id].uscite2030 - storicoTurni[b.dipendente_id].uscite2030);
                
                const anticipato = chiusureRepartoOggi[0];
                const [hIn] = anticipato.ora_inizio.split(':').map(Number);
                const nuoveOreOggi = 20.5 - hIn;
                
                oreSettimanaliAssegnate[anticipato.dipendente_id] -= (anticipato.oreOggi - nuoveOreOggi);
                anticipato.ora_fine = '20:30';
                storicoTurni[anticipato.dipendente_id].uscite2030++;

                nuoviTurni.push({ dipendente_id: anticipato.dipendente_id, data: anticipato.data, ora_inizio: anticipato.ora_inizio, ora_fine: anticipato.ora_fine, note: 'Chiusura 20:30' });
                nuoviTurni.push({ dipendente_id: chiusureRepartoOggi[1].dipendente_id, data: chiusureRepartoOggi[1].data, ora_inizio: chiusureRepartoOggi[1].ora_inizio, ora_fine: chiusureRepartoOggi[1].ora_fine, note: 'Chiusura' });
              } else {
                chiusureRepartoOggi.forEach(c => {
                  nuoviTurni.push({ dipendente_id: c.dipendente_id, data: c.data, ora_inizio: c.ora_inizio, ora_fine: c.ora_fine, note: c.note });
                });
              }
            }
          }
        }
      }
      
      for (let i = 0; i < nuoviTurni.length; i += 50) {
        const chunk = nuoviTurni.slice(i, i + 50);
        await supabase.from('turni').insert(chunk);
      }

      await caricaDati();
      const giorniPrimaSettimana = Array.from({ length: 7 }).map((_, i) => addDays(dataInizio, i));
      const anom = analizzaEControlloAnomalie(nuoviTurni, giorniPrimaSettimana);
      
      if (anom.length > 0) {
        setListaAnomalie(anom);
        setAnomalieModalAperto(true);
      } else {
        alert(`Turni generati con successo per ${etichettaPeriodo} senza alcuna anomalia di monte ore!`);
      }
    } catch (error: any) { 
      alert("Errore: " + error.message); 
    } finally { 
      setGenerazioneInCorso(false); 
    }
  }

  const salvaTurno = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dipendenteSelezionato || !dataTurno || !oraInizio || !oraFine) return alert("Compila tutti i campi!")
    await supabase.from('turni').insert([{ data: dataTurno, ora_inizio: oraInizio, ora_fine: oraFine, dipendente_id: dipendenteSelezionato }])
    setDataTurno(''); setOraInizio(''); setOraFine(''); setDipendenteSelezionato(''); caricaDati()
  }

  const apriModificaTurno = (t: any) => {
    setTurnoInModifica(t)
    setModOraInizio(t.ora_inizio.slice(0,5))
    setModOraFine(t.ora_fine.slice(0,5))
    setModNote(t.note || '')
  }

  const salvaModificaTurno = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!turnoInModifica || !modOraInizio || !modOraFine) return alert("Compila gli orari!")
    
    const { error } = await supabase
      .from('turni')
      .update({ ora_inizio: modOraInizio, ora_fine: modOraFine, note: modNote })
      .eq('id', turnoInModifica.id)

    if (error) return alert("Errore durante la modifica: " + error.message)

    setTurnoInModifica(null)
    caricaDati()
    alert("Turno modificato con successo!")
  }

  const eliminaTurno = async (id: string) => {
    if (window.confirm("Eliminare questo turno?")) { await supabase.from('turni').delete().eq('id', id); caricaDati() }
  }

  const esportaExcelModelloUfficiale = async () => {
    const workbook = new ExcelJS.Workbook();
    const orariSlots = [
      "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
      "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00",
      "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30"
    ];

    const repartiList = [...new Set(dipendenti.map(d => d.reparto))];
    const nomiGiorni = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];

    repartiList.forEach(reparto => {
      const dipRep = dipendenti.filter(d => d.reparto === reparto);
      if (dipRep.length === 0) return;

      const ws = workbook.addWorksheet(reparto);

      giorniSettimana.forEach((giorno, giornoIndex) => {
        const rigaData = ws.addRow([format(giorno, 'yyyy-MM-dd')]);
        const cellaGiorno = rigaData.getCell(13);
        cellaGiorno.value = nomiGiorni[giornoIndex];
        cellaGiorno.font = { name: 'Calibri', size: 12, bold: true };

        const headerValues = [reparto, ...orariSlots, "", "CONTEGGIO ORE", "C", "", "", "", ""];
        const headerRow = ws.addRow(headerValues);

        headerRow.eachCell((cell) => {
          cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F4E78' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'D9D9D9' } },
            bottom: { style: 'thin', color: { argb: 'D9D9D9' } },
            left: { style: 'thin', color: { argb: 'D9D9D9' } },
            right: { style: 'thin', color: { argb: 'D9D9D9' } }
          };
        });

        ws.addRow([]);
        ws.addRow([]);

        dipRep.forEach(dip => {
          const turniGiorno = turni.filter(t => t.dipendente_id === dip.id && isSameDay(parseISO(t.data), giorno));
          
          const rowData: any[] = [`${dip.nome} ${dip.ore_settimanali}`];
          
          orariSlots.forEach(slot => {
            const slotTime = slot + ":00";
            const lavora = turniGiorno.some(t => {
              const inizio = t.ora_inizio.length === 5 ? t.ora_inizio + ":00" : t.ora_inizio;
              const fine = t.ora_fine.length === 5 ? t.ora_fine + ":00" : t.ora_fine;
              return slotTime >= inizio && slotTime <= fine;
            });
            rowData.push(lavora ? "X" : "");
          });

          const oreGiorno = turniGiorno.reduce((tot, t) => {
            const [hIn, mIn] = t.ora_inizio.split(':').map(Number);
            const [hFin, mFin] = t.ora_fine.split(':').map(Number);
            let d = (hFin + (mFin/60)) - (hIn + (mIn/60));
            return tot + (d > 0 ? d : 0);
          }, 0);

          rowData.push("", oreGiorno > 0 ? oreGiorno : 0, turniGiorno.length > 0 ? "C" : "R", "", "", "", "");
          const r = ws.addRow(rowData);

          r.eachCell((cell, colNumber) => {
            cell.font = { name: 'Calibri', size: 11, bold: colNumber === 1 || cell.value === "X" };
            cell.alignment = { horizontal: colNumber === 1 ? 'left' : 'center', vertical: 'middle' };
            cell.border = {
              top: { style: 'thin', color: { argb: 'D9D9D9' } },
              bottom: { style: 'thin', color: { argb: 'D9D9D9' } },
              left: { style: 'thin', color: { argb: 'D9D9D9' } },
              right: { style: 'thin', color: { argb: 'D9D9D9' } }
            };
          });
        });

        ws.addRow([]);
        ws.addRow([]);
      });

      ws.columns.forEach(column => {
        let maxLength = 10;
        column.eachCell?.({ includeEmpty: true }, cell => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = Math.max(maxLength + 2, 12);
      });
      ws.getColumn(1).width = 25;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `turni_negozio_ufficiale_${format(dataInizio, 'yyyy-MM-dd')}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  if (caricamento) return <div className="min-h-screen flex items-center justify-center font-medium text-gray-500 bg-slate-50">Caricamento in corso...</div>
  if (!utente) return <Login />

  const giorniSettimana = Array.from({ length: 7 }).map((_, i) => addDays(dataInizio, i))
  const cambiaSettimana = (direzione: number) => setDataInizio(addDays(dataInizio, direzione * 7))
  const repartiUnici = [...new Set(dipendenti.map(d => d.reparto))]
  const dipendentiFiltrati = repartoFiltro === 'TUTTI' ? dipendenti : dipendenti.filter(d => d.reparto === repartoFiltro || (d.reparti_extra && d.reparti_extra.toUpperCase().includes(repartoFiltro)))
  
  const richiesteInAttesaCount = assenze.filter(a => a.stato === 'in_attesa').length
  const assenzeFiltrate = filtroStatoRichieste === 'TUTTE' ? assenze : assenze.filter(a => a.stato === filtroStatoRichieste)

  return (
    <div className="min-h-screen bg-slate-100/70 font-sans text-slate-800 antialiased">
      <nav className="bg-slate-900 text-white px-6 py-3 shadow-md flex justify-between items-center flex-wrap gap-4 sticky top-0 z-50 border-b border-slate-800">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setVistaCorrente('turni')}>
          <div className="bg-white p-1 rounded-xl shadow-sm flex items-center justify-center">
            <img src="/logoeruronics.jpg" alt="Gruppo Siem Logo" className="h-9 w-auto rounded-lg object-contain" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight leading-tight text-white">GESTIONE TURNI</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Punto Vendita</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setVistaCorrente('turni')} className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm ${vistaCorrente === 'turni' ? 'bg-amber-400 text-slate-900 font-bold shadow' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}>📅 Tabella Turni</button>
          <button onClick={() => setVistaCorrente('stats')} className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm ${vistaCorrente === 'stats' ? 'bg-amber-400 text-slate-900 font-bold shadow' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}>📊 Stats Dettagliate</button>
          <button onClick={() => setVistaCorrente('dipendenti')} className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm ${vistaCorrente === 'dipendenti' ? 'bg-amber-400 text-slate-900 font-bold shadow' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}>👥 Dipendenti</button>
          <button onClick={() => setVistaCorrente('assenze')} className={`relative px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm ${vistaCorrente === 'assenze' ? 'bg-amber-400 text-slate-900 font-bold shadow' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}>
            🌴 Richieste & Assenze
            {richiesteInAttesaCount > 0 && (
              <span className="ml-2 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                {richiesteInAttesaCount}
              </span>
            )}
          </button>
          <button onClick={() => setVistaCorrente('impostazioni')} className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm ${vistaCorrente === 'impostazioni' ? 'bg-amber-400 text-slate-900 font-bold shadow' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}>⚙️ Regole</button>
          
          <button onClick={() => supabase.auth.signOut()} className="bg-rose-600/90 hover:bg-rose-600 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm ml-2">Esci</button>
        </div>
      </nav>

      {turnoInModifica && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
              <div>
                <span className="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-widest">Modifica Turno</span>
                <h3 className="text-base font-bold text-slate-900 mt-1">Aggiorna Orari Turno</h3>
              </div>
              <button onClick={() => setTurnoInModifica(null)} className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full flex items-center justify-center font-bold text-xs">✕</button>
            </div>

            <form onSubmit={salvaModificaTurno} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ora Inizio</label>
                <input type="time" value={modOraInizio} onChange={e => setModOraInizio(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-slate-900" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ora Fine (Max 21:00)</label>
                <input type="time" value={modOraFine} onChange={e => setModOraFine(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-slate-900" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Note / Etichetta</label>
                <input type="text" value={modNote} onChange={e => setModNote(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-slate-900" />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setTurnoInModifica(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs">Annulla</button>
                <button type="submit" className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-sm">Salva Modifiche</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {anomalieModalAperto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 max-w-2xl w-full p-6 md:p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-5 border-b border-slate-100 pb-4">
              <div>
                <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-widest">Controllo Qualità Turni</span>
                <h2 className="text-xl font-bold text-slate-900 mt-2">Anomalie Monte Ore Rilevate</h2>
                <p className="text-xs text-slate-500 mt-0.5">Sono stati trovati dipendenti con scarti orari rispetto al contratto stabilito.</p>
              </div>
              <button onClick={() => setAnomalieModalAperto(false)} className="w-8 h-8 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full flex items-center justify-center font-bold text-sm transition-colors">✕</button>
            </div>

            {listaAnomalie.length > 0 && (
              <div className="mb-5 bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex justify-between items-center">
                <div>
                  <div className="text-xs font-bold text-emerald-900">Risoluzione Rapida Massiva</div>
                  <div className="text-[11px] text-emerald-700">Allinea automaticamente tutti gli scarti modificando i turni ottimali (entro le 21:00).</div>
                </div>
                <button 
                  onClick={risolviTutteLeAnomalie}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  ⚡ Risolvi Tutte ({listaAnomalie.length})
                </button>
              </div>
            )}

            <div className="space-y-4 mb-6">
              {listaAnomalie.map((anom, idx) => (
                <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{anom.nome} <span className="text-xs font-normal text-slate-500">({anom.reparto})</span></div>
                    <div className="text-xs text-amber-700 font-semibold mt-1">
                      Assegnate: <strong>{anom.oreAttuali.toFixed(1)}h</strong> / Previste: <strong>{anom.orePreviste}h</strong> 
                      <span className="ml-2 bg-amber-100 px-2 py-0.5 rounded text-[10px]">Scarto: {anom.differenza > 0 ? `+${anom.differenza}h` : `${anom.differenza}h`}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <button 
                      onClick={() => applicaSoluzioneAnomalia(anom)}
                      className="flex-1 md:flex-none bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-sm transition-all text-center"
                    >
                      🛠️ Risolvi ({anom.differenza > 0 ? `+${anom.differenza}h` : `${anom.differenza}h`})
                    </button>
                  </div>
                </div>
              ))}

              {listaAnomalie.length === 0 && (
                <div className="py-8 text-center text-emerald-600 font-bold text-sm">
                  🎉 Tutte le anomalie sono state corrette! Il monte ore è perfetto.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button 
                onClick={() => { setAnomalieModalAperto(false); caricaDati(); }}
                className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Chiudi e Visualizza Tabella
              </button>
            </div>
          </div>
        </div>
      )}

      {vistaCorrente === 'dipendenti' && (
        <div className="max-w-[1500px] mx-auto p-6 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 md:p-8 mb-6">
            <h2 className="text-lg font-bold uppercase tracking-wide text-slate-900 mb-1">Aggiungi Nuovo Dipendente</h2>
            <p className="text-xs text-slate-500 mb-5">Inserisci un nuovo membro nello staff definendo contratto e reparti.</p>
            <form onSubmit={aggiungiDipendente} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nome e Cognome</label>
                <input type="text" placeholder="Mario Rossi" value={nuovoNome} onChange={e => setNuovoNome(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-slate-900" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Reparto Principale</label>
                <select value={nuovoReparto} onChange={e => setNuovoReparto(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-slate-900">
                  {repartiUnici.map(r => <option key={r} value={r}>{r}</option>)}
                  <option value="MAGAZZINO">MAGAZZINO</option>
                  <option value="CASSE">CASSE</option>
                  <option value="TELEFONIA">TELEFONIA</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Ore Settimanali</label>
                <input type="number" value={nuoveOre} onChange={e => setNuoveOre(Number(e.target.value))} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-slate-900" />
              </div>
              <button type="submit" className="bg-slate-900 text-white font-bold py-2.5 px-4 rounded-xl text-xs hover:bg-slate-800 shadow-sm transition-all h-[38px]">
                ➕ Aggiungi Dipendente
              </button>
              <div className="md:col-span-4">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Reparti Extra / Abilitazioni (separati da virgola)</label>
                <input type="text" placeholder="Es. CASSE, MAGAZZINO" value={nuoviRepartiExtra} onChange={e => setNuoviRepartiExtra(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-slate-900" />
              </div>
            </form>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 md:p-8">
            <h2 className="text-lg font-bold uppercase tracking-wide text-slate-900 mb-5">Elenco Dipendenti & Modifica Rapida</h2>
            <div className="space-y-4">
              {dipendenti.map(dip => (
                <div key={dip.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex-1 w-full md:w-auto">
                    <div className="font-bold text-slate-900 text-sm">{dip.nome}</div>
                    <div className="text-xs text-slate-500">ID: {dip.id.slice(0,8)}</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase">Reparto Prin.</span>
                      <select 
                        value={dip.reparto} 
                        onChange={e => {
                          const aggiornati = dipendenti.map(d => d.id === dip.id ? { ...d, reparto: e.target.value } : d);
                          setDipendenti(aggiornati);
                        }} 
                        className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                      >
                        {repartiUnici.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase">Ore Contratto</span>
                      <input 
                        type="number" 
                        value={dip.ore_settimanali} 
                        onChange={e => {
                          const val = Number(e.target.value);
                          setDipendenti(dipendenti.map(d => d.id === dip.id ? { ...d, ore_settimanali: val } : d));
                        }} 
                        className="w-20 p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-center" 
                      />
                    </div>

                    <div className="flex-1 md:flex-none">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase">Reparti Extra</span>
                      <input 
                        type="text" 
                        placeholder="Nessuno" 
                        value={dip.reparti_extra || ''} 
                        onChange={e => {
                          setDipendenti(dipendenti.map(d => d.id === dip.id ? { ...d, reparti_extra: e.target.value } : d));
                        }} 
                        className="w-40 p-2 bg-white border border-slate-200 rounded-xl text-xs" 
                      />
                    </div>

                    <button onClick={() => aggiornaDipendenteDB(dip)} className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-sm">
                      💾 Salva
                    </button>
                    <button onClick={() => eliminaDipendente(dip.id, dip.nome)} className="bg-rose-100 hover:bg-rose-200 text-rose-700 px-3 py-2 rounded-xl text-xs font-bold">
                      🗑️ Elimina
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {vistaCorrente === 'stats' && (
        <div className="max-w-[1500px] mx-auto p-6 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 md:p-8">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6 border-b border-slate-100 pb-5">
              <div>
                <h2 className="text-lg font-bold uppercase tracking-wide text-slate-900">Statistiche Dettagliate per Reparto</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Settimana di riferimento: {format(giorniSettimana[0], 'd MMM', { locale: it })} - {format(giorniSettimana[6], 'd MMM yyyy', { locale: it })}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                  <button onClick={() => cambiaSettimana(-1)} className="w-7 h-7 flex items-center justify-center bg-white hover:bg-slate-100 rounded-lg border border-slate-200 font-bold text-slate-600 shadow-sm transition-colors">←</button>
                  <button onClick={() => cambiaSettimana(1)} className="w-7 h-7 flex items-center justify-center bg-white hover:bg-slate-100 rounded-lg border border-slate-200 font-bold text-slate-600 shadow-sm transition-colors">→</button>
                </div>

                <select 
                  value={repartoFiltroStats} 
                  onChange={e => setRepartoFiltroStats(e.target.value)}
                  className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer focus:ring-2 focus:ring-slate-900 transition-all"
                >
                  <option value="TUTTI">Tutti i reparti</option>
                  {repartiUnici.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-6">
              {repartiUnici.filter(rep => repartoFiltroStats === 'TUTTI' || rep === repartoFiltroStats).map(rep => {
                const dipRep = dipendenti.filter(d => d.reparto === rep || (d.reparti_extra && d.reparti_extra.toUpperCase().includes(rep)));
                if (dipRep.length === 0) return null;
                return (
                  <div key={rep} className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/60">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 bg-slate-200/50 px-3 py-1.5 rounded-lg inline-block">{rep}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {dipRep.map(dip => {
                        const turniDip = turni.filter(t => t.dipendente_id === dip.id && isWithinInterval(parseISO(t.data), { start: giorniSettimana[0], end: giorniSettimana[6] }));
                        const aperture = turniDip.filter(t => t.note === 'Apertura' || t.ora_inizio.startsWith('09')).length;
                        const pomeriggi = turniDip.filter(t => t.note === 'Centrale' || t.note === 'Direzione').length;
                        const sere = turniDip.filter(t => t.note === 'Chiusura').length;
                        const spezzati = turniDip.filter(t => t.note?.includes('Spezzato')).length;
                        const scarichi = turniDip.filter(t => t.note === 'Scarico merci').length;

                        const oreTotali = turniDip.reduce((tot, t) => {
                          const [hIn, mIn] = t.ora_inizio.split(':').map(Number);
                          const [hFin, mFin] = t.ora_fine.split(':').map(Number);
                          let d = (hFin + (mFin/60)) - (hIn + (mIn/60));
                          return tot + (d > 0 ? d : 0);
                        }, 0);

                        return (
                          <div key={dip.id} className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm hover:shadow transition-shadow">
                            <div className="flex justify-between items-center mb-3">
                              <span className="font-bold text-slate-900 text-xs">{dip.nome}</span>
                              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md">
                                {oreTotali.toFixed(1)} / {dip.ore_settimanali}h
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                              <span>Mattine: <strong className="text-slate-900">{aperture}</strong></span>
                              <span>Centrali: <strong className="text-slate-900">{pomeriggi}</strong></span>
                              <span>Chiusure: <strong className="text-slate-900">{sere}</strong></span>
                              <span>Spezzati: <strong className="text-slate-900">{spezzati}</strong></span>
                              <span>Scarichi: <strong className="text-slate-900">{scarichi}</strong></span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {vistaCorrente === 'assenze' && (
        <div className="max-w-[1500px] mx-auto p-6 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 md:p-8 mb-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold uppercase tracking-wide text-slate-900">Invia Richiesta da parte del Dipendente</h2>
              <p className="text-xs text-slate-500 mt-1">Compila il modulo per registrare una nuova richiesta nel sistema di approvazione.</p>
            </div>
            <form onSubmit={salvaAssenza} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Dipendente</label>
                <select value={assDipendente} onChange={e => setAssDipendente(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 outline-none transition-all">
                  <option value="">Seleziona...</option>
                  {dipendenti.map(d => <option key={d.id} value={d.id}>{d.nome} ({d.reparto})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tipologia</label>
                <select value={assTipo} onChange={e => setAssTipo(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 outline-none transition-all">
                  <option value="ferie">Ferie</option>
                  <option value="permesso">Permesso / ROL</option>
                  <option value="malattia">Malattia</option>
                  <option value="siem">Siem (Aziendale)</option>
                  <option value="maternita">Maternità</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Dal</label>
                <input type="date" value={assInizio} onChange={e => setAssInizio(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Al</label>
                <input type="date" value={assFine} onChange={e => setAssFine(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Notifica</label>
                <input type="email" placeholder="mario@email.it" value={assEmail} onChange={e => setAssEmail(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 outline-none transition-all" />
              </div>
              <button type="submit" className="bg-slate-900 text-white font-bold py-2.5 px-4 rounded-xl text-xs hover:bg-slate-800 shadow-sm transition-all h-[38px]">
                📥 Invia Richiesta
              </button>
              <div className="md:col-span-3 lg:col-span-6 mt-1">
                <input type="text" placeholder="Note aggiuntive (opzionale)..." value={assNote} onChange={e => setAssNote(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 outline-none transition-all" />
              </div>
            </form>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 md:p-8">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
              <h2 className="text-lg font-bold uppercase tracking-wide text-slate-900">Approvazione Richieste (Direzione)</h2>
              <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
                {(['TUTTE', 'in_attesa', 'approvato', 'rifiutato'] as const).map(stato => (
                  <button
                    key={stato}
                    onClick={() => setFiltroStatoRichieste(stato)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                      filtroStatoRichieste === stato ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {stato === 'TUTTE' ? 'Tutte' : stato === 'in_attesa' ? 'In Attesa' : stato === 'approvato' ? 'Approvate' : 'Rifiutate'}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] text-slate-400 uppercase tracking-wider">
                    <th className="pb-3.5 font-bold">Dipendente</th>
                    <th className="pb-3.5 font-bold">Reparto</th>
                    <th className="pb-3.5 font-bold">Tipologia</th>
                    <th className="pb-3.5 font-bold">Periodo</th>
                    <th className="pb-3.5 font-bold">Note</th>
                    <th className="pb-3.5 font-bold">Stato</th>
                    <th className="pb-3.5 font-bold text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assenzeFiltrate.map(a => {
                    const dip = dipendenti.find(d => d.id === a.dipendente_id);
                    return (
                      <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 font-bold text-slate-800 text-xs">{dip?.nome}</td>
                        <td className="py-3.5 text-xs text-slate-500 font-medium">{dip?.reparto}</td>
                        <td className="py-3.5">
                          <span className={`uppercase font-bold text-[10px] px-2.5 py-1 rounded-full border ${
                            a.tipo === 'maternita' ? 'bg-pink-50 text-pink-700 border-pink-200/60' :
                            a.tipo === 'siem' ? 'bg-indigo-50 text-indigo-700 border-indigo-200/60' : 'bg-blue-50 text-blue-700 border-blue-200/60'
                          }`}>
                            {a.tipo}
                          </span>
                        </td>
                        <td className="py-3.5 text-xs text-slate-700 font-medium">{format(parseISO(a.data_inizio), 'dd/MM/yyyy')} – {format(parseISO(a.data_fine), 'dd/MM/yyyy')}</td>
                        <td className="py-3.5 text-xs text-slate-500">{a.note || '-'}</td>
                        <td className="py-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                            a.stato === 'approvato' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' :
                            a.stato === 'rifiutato' ? 'bg-rose-50 text-rose-700 border-rose-200/60' : 'bg-amber-50 text-amber-700 border-amber-200/60'
                          }`}>
                            {a.stato === 'approvato' ? 'Approvato' : a.stato === 'rifiutato' ? 'Rifiutato' : 'In Attesa'}
                          </span>
                        </td>
                        <td className="py-3.5 text-right space-x-1.5 whitespace-nowrap">
                          {a.stato !== 'approvato' && (
                            <button type="button" onClick={() => approvaAssenza(a.id, 'approvato')} className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer">Accetta</button>
                          )}
                          {a.stato !== 'rifiutato' && (
                            <button type="button" onClick={() => approvaAssenza(a.id, 'rifiutato')} className="bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer">Rifiuta</button>
                          )}
                          <button type="button" onClick={() => eliminaAssenza(a.id)} className="bg-slate-200 hover:bg-rose-600 text-slate-700 hover:text-white px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer">Elimina</button>
                        </td>
                      </tr>
                    )
                  })}
                  {assenzeFiltrate.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 text-xs italic">Nessuna richiesta trovata.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {vistaCorrente === 'impostazioni' && impostazioni && (
        <div className="max-w-[1500px] mx-auto p-6 animate-fadeIn space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 md:p-8 max-w-xl">
            <h2 className="text-lg font-bold uppercase tracking-wide text-slate-900 mb-4">Regole Orarie Negozio</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Apertura Lun-Sab</label>
                <input type="time" value={impostazioni.apertura_settimanale || '09:00'} onChange={e => setImpostazioni({...impostazioni, apertura_settimanale: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-slate-900 transition-all" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Chiusura Lun-Sab (Max 21:00)</label>
                <input type="time" value={impostazioni.chiusura_settimanale || '21:00'} onChange={e => setImpostazioni({...impostazioni, chiusura_settimanale: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-slate-900 transition-all" />
              </div>
              <button onClick={salvaImpostazioni} className="bg-slate-900 text-white font-bold py-2.5 px-6 rounded-xl text-xs hover:bg-slate-800 shadow-sm transition-all">Salva Regole</button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 md:p-8 max-w-2xl">
            <h2 className="text-lg font-bold uppercase tracking-wide text-slate-900 mb-1">📅 Calendario Giorni di Chiusura Negozio</h2>
            <p className="text-xs text-slate-500 mb-5">Aggiungi qui le date specifiche di chiusura (es. Natale, festività). Il generatore non assegnerà turni in questi giorni.</p>
            
            <form onSubmit={aggiungiChiusura} className="flex gap-3 items-end mb-6 flex-wrap">
              <div className="flex-1 min-w-[150px]">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Data Chiusura</label>
                <input type="date" value={nuovaDataChiusura} onChange={e => setNuovaDataChiusura(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none" />
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Motivazione</label>
                <input type="text" value={nuovaMotivazioneChiusura} onChange={e => setNuovaMotivazioneChiusura(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none" />
              </div>
              <button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-5 rounded-xl text-xs shadow-sm">
                ➕ Aggiungi Chiusura
              </button>
            </form>

            <div className="space-y-2">
              {giorniChiusura.map(c => (
                <div key={c.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-900 text-xs">{format(parseISO(c.data), 'dd/MM/yyyy')}</span>
                    <span className="ml-3 text-xs text-slate-600 bg-amber-100 px-2 py-0.5 rounded font-semibold">{c.motivazione}</span>
                  </div>
                  <button onClick={() => eliminaChiusura(c.id)} className="bg-rose-100 hover:bg-rose-200 text-rose-700 px-2.5 py-1 rounded-lg text-xs font-bold">
                    🗑️ Rimuovi
                  </button>
                </div>
              ))}
              {giorniChiusura.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-xs italic">Nessun giorno di chiusura straordinaria registrato.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {vistaCorrente === 'turni' && (
        <div className="max-w-[1500px] mx-auto p-4 md:p-6 animate-fadeIn">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 mb-6 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                <button onClick={() => cambiaSettimana(-1)} className="w-8 h-8 flex items-center justify-center bg-white hover:bg-slate-100 rounded-lg border border-slate-200 font-bold text-slate-600 shadow-sm transition-colors">←</button>
                <button onClick={() => cambiaSettimana(1)} className="w-8 h-8 flex items-center justify-center bg-white hover:bg-slate-100 rounded-lg border border-slate-200 font-bold text-slate-600 shadow-sm transition-colors">→</button>
              </div>
              <span className="font-bold text-slate-900 text-sm px-1">
                {format(giorniSettimana[0], 'd MMM', { locale: it })} - {format(giorniSettimana[6], 'd MMM yyyy', { locale: it })}
              </span>
              <button onClick={() => setDataInizio(startOfWeek(new Date(), { weekStartsOn: 1 }))} className="text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/60">Oggi</button>
            </div>
            
            <div className="flex gap-3 items-center flex-wrap">
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <span className="text-xs font-semibold text-slate-500">Genera per:</span>
                <select 
                  value={settimaneDaGenerare} 
                  onChange={e => setSettimaneDaGenerare(Number(e.target.value))}
                  className="bg-transparent text-xs font-bold text-slate-900 outline-none cursor-pointer"
                >
                  <option value={1}>1 Settimana</option>
                  <option value={2}>2 Settimane</option>
                  <option value={3}>3 Settimane</option>
                  <option value={4}>1 Mese (4 Settimane)</option>
                </select>
              </div>
              
              <select 
                value={repartoFiltro} 
                onChange={e => setRepartoFiltro(e.target.value)}
                className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-sm outline-none cursor-pointer"
              >
                <option value="TUTTI">Tutti i reparti</option>
                {repartiUnici.map(r => <option key={r} value={r}>{r}</option>)}
              </select>

              <button onClick={generaTurni} disabled={generazioneInCorso} className="bg-amber-400 hover:bg-amber-300 text-slate-900 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50">
                {generazioneInCorso ? 'Elaborazione...' : '✨ Genera Turni'}
              </button>

              <button onClick={esportaExcelModelloUfficiale} className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all">Scarica Excel Ufficiale</button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1100px]">
                <thead className="sticky top-0 z-20 bg-white shadow-xs">
                  <tr className="border-b border-slate-100 text-slate-400 text-[11px] uppercase tracking-wider">
                    <th className="p-4 font-bold w-52 sticky left-0 bg-white z-30 border-r border-slate-100">Dipendente</th>
                    {giorniSettimana.map((giorno, i) => (
                      <th key={i} className={`p-3 text-center font-bold border-r border-slate-100 last:border-r-0 ${i===6?'bg-amber-50/30':''}`}>
                        <div className="text-[10px] text-slate-400 mb-0.5">{format(giorno, 'EEE', { locale: it })}</div>
                        <div className={`text-xs ${isSameDay(giorno, new Date()) ? 'text-slate-900 font-black' : 'text-slate-700'}`}>{format(giorno, 'd MMM', { locale: it })}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                
                <tbody className="divide-y divide-slate-100">
                  {repartiUnici.filter(r => repartoFiltro === 'TUTTI' || r === repartoFiltro).map(reparto => {
                    const dipReparto = dipendentiFiltrati.filter(d => d.reparto === reparto || (d.reparti_extra && d.reparti_extra.toUpperCase().includes(reparto)));
                    if (dipReparto.length === 0) return null;
                    
                    return (
                      <React.Fragment key={reparto}>
                        <tr className="bg-slate-900 text-white">
                          <td colSpan={8} className="py-2 px-4 text-[11px] font-bold uppercase tracking-widest sticky left-0 z-10 bg-slate-900">
                            {reparto}
                          </td>
                        </tr>
                        
                        {dipReparto.map((dip, idx) => {
                          const oreAssegnate = turni
                            .filter(t => t.dipendente_id === dip.id && isWithinInterval(parseISO(t.data), { start: giorniSettimana[0], end: giorniSettimana[6] }))
                            .reduce((tot, t) => {
                              const [hIn, mIn] = t.ora_inizio.split(':').map(Number);
                              const [hFin, mFin] = t.ora_fine.split(':').map(Number);
                              let d = (hFin + (mFin/60)) - (hIn + (mIn/60));
                              return tot + (d > 0 ? d : 0);
                            }, 0);

                          const isOrarioCorretto = Math.abs(oreAssegnate - dip.ore_settimanali) <= 0.1;

                          return (
                            <tr key={dip.id} className={`hover:bg-slate-50/80 transition-colors group ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                              <td className="p-3.5 sticky left-0 bg-inherit border-r border-slate-100 z-10">
                                <div className="font-bold text-slate-800 text-xs whitespace-nowrap">{dip.nome}</div>
                                <div className={`text-[10px] font-bold mt-0.5 ${isOrarioCorretto ? 'text-emerald-700' : 'text-amber-700'}`}>
                                  {oreAssegnate.toFixed(1)} / {dip.ore_settimanali} h
                                </div>
                              </td>
                              
                              {giorniSettimana.map((giorno, i) => {
                                const dataStr = format(giorno, 'yyyy-MM-dd');
                                const isChiuso = giorniChiusura.some(c => c.data === dataStr);
                                const turniGiorno = turni.filter(t => t.dipendente_id === dip.id && isSameDay(parseISO(t.data), giorno));
                                turniGiorno.sort((a, b) => a.ora_inizio.localeCompare(b.ora_inizio));
                                const inFerie = assenze.find(a => a.dipendente_id === dip.id && a.stato === 'approvato' && isWithinInterval(giorno, { start: parseISO(a.data_inizio), end: parseISO(a.data_fine) }));
                                
                                return (
                                  <td key={i} className={`p-1.5 border-r border-slate-100 align-top relative group/cell ${i===6?'bg-amber-50/10':''}`}>
                                    {isChiuso ? (
                                      <div className="p-2 rounded-xl border border-slate-200 bg-slate-200 text-slate-600 text-[10px] text-center font-bold h-full flex items-center justify-center tracking-wide">
                                        CHIUSO
                                      </div>
                                    ) : inFerie ? (
                                      <div className={`p-2 rounded-xl border text-[10px] text-center font-bold h-full flex items-center justify-center tracking-wide ${
                                        inFerie.tipo === 'maternita' ? 'bg-pink-50 text-pink-700 border-pink-200/60' :
                                        inFerie.tipo === 'siem' ? 'bg-indigo-50 text-indigo-700 border-indigo-200/60' :
                                        'bg-rose-50 text-rose-700 border-rose-200/60'
                                      }`}>
                                        {inFerie.tipo === 'maternita' ? 'MATERNITÀ' : inFerie.tipo.toUpperCase()}
                                      </div>
                                    ) : turniGiorno.length > 0 ? (
                                      <div className="flex flex-col gap-1.5 h-full">
                                        {turniGiorno.map(t => {
                                          const [hIn, mIn] = t.ora_inizio.split(':').map(Number);
                                          const [hFin, mFin] = t.ora_fine.split(':').map(Number);
                                          let oreTurno = (hFin + (mFin/60)) - (hIn + (mIn/60));
                                          if (oreTurno < 0) oreTurno = 0;
                                          return (
                                            <div 
                                              key={t.id} 
                                              className={`relative p-2 rounded-xl border text-[11px] text-center font-semibold shadow-xs transition-all ${getStileTurno(t.ora_inizio, t.ora_fine)}`}
                                            >
                                              <div>{t.ora_inizio.slice(0,5)}–{t.ora_fine.slice(0,5)}</div>
                                              <div className="text-[10px] opacity-80 font-bold">({oreTurno % 1 === 0 ? oreTurno : oreTurno.toFixed(1)}h)</div>
                                              
                                              <div className="absolute -top-1.5 -right-1.5 flex gap-1 opacity-0 group-hover/cell:opacity-100 transition-all">
                                                <button onClick={() => apriModificaTurno(t)} className="w-4 h-4 bg-white border border-slate-200 text-blue-600 rounded-full flex items-center justify-center text-[9px] font-bold hover:bg-blue-600 hover:text-white shadow-xs" title="Modifica">✏️</button>
                                                <button onClick={() => eliminaTurno(t.id)} className="w-4 h-4 bg-white border border-slate-200 text-slate-500 rounded-full flex items-center justify-center text-[10px] font-bold hover:bg-rose-600 hover:text-white shadow-xs" title="Elimina">×</button>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <div className="p-2 rounded-xl text-[10px] text-center text-slate-300 bg-slate-50/40 border border-transparent h-full flex items-center justify-center italic font-medium">
                                        Riposo
                                      </div>
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="mt-6 bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-2 h-6 bg-amber-400 rounded-full"></div>
              <span className="font-bold text-slate-900 text-xs uppercase tracking-wide">Aggiungi Turno Manuale</span>
            </div>
            <form onSubmit={salvaTurno} className="flex gap-2.5 items-center flex-wrap">
              <select value={dipendenteSelezionato} onChange={(e) => setDipendenteSelezionato(e.target.value)} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-slate-900 w-48 transition-all">
                <option value="">Seleziona Dipendente...</option>
                {dipendenti.map(d => <option key={d.id} value={d.id}>{d.nome} ({d.reparto})</option>)}
              </select>
              <input type="date" value={dataTurno} onChange={(e) => setDataTurno(e.target.value)} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-slate-900 transition-all" />
              <input type="time" value={oraInizio} onChange={(e) => setOraInizio(e.target.value)} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-slate-900 transition-all" />
              <span className="text-slate-400 font-bold">–</span>
              <input type="time" value={oraFine} onChange={(e) => setOraFine(e.target.value)} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-slate-900 transition-all" />
              <button type="submit" className="bg-slate-900 text-white font-bold py-2.5 px-6 rounded-xl text-xs hover:bg-slate-800 shadow-sm transition-all">Aggiungi</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App