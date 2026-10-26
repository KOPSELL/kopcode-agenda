import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowRight, CalendarDays, CheckCircle2, Clock3, Copy, LogOut,
  Menu, Plus, Scissors, Settings, Share2, ShieldCheck, Users, Wallet,
  X, LoaderCircle, ExternalLink, Link as LinkIcon, LayoutDashboard, CalendarCheck,
  Store, Sparkles, ImagePlus, ChevronLeft, ChevronRight
} from 'lucide-react'
import { supabase } from './lib/supabase'

type Shop = { id: string; name: string; slug: string; phone?: string | null; timezone?: string; description?: string | null; address?: string | null; logo_url?: string | null; cover_url?: string | null; theme_color?: string | null }
type Barber = { id: string; name: string; active: boolean; photo_url?: string | null }
type Service = { id: string; name: string; description?: string | null; price: number; duration_minutes: number; active: boolean; photo_url?: string | null }
type Appointment = {
  id: string; client_name: string; client_phone: string; starts_at: string; ends_at: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  barber_id: string; service_id: string; notes?: string | null
}
type PublicShop = Shop & { services: Service[]; barbers: Barber[] }
type Tab = 'overview' | 'appointments' | 'barbers' | 'services' | 'settings'
const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
const localDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
const formatDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value))
const formatTime = (value: string) => new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(value))
const slugify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Ocorreu um erro. Tente novamente.'
const today = () => localDate(new Date())

function Brand({ light = false }: { light?: boolean }) {
  return <div className={light ? 'brand brand-light' : 'brand'}><span className="brand-mark"><Scissors size={19} /></span><span>agenda<span className="brand-accent">kopcode</span></span></div>
}

function App() {
  const pathParts = window.location.pathname.split('/').filter(Boolean)
  const publicSlug = pathParts[0] === 'b' ? pathParts[1] : null
  const [session, setSession] = useState<any>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [authShopName, setAuthShopName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [shop, setShop] = useState<Shop | null>(null)
  const [shopNameInput, setShopNameInput] = useState('')
  const [shopPhoneInput, setShopPhoneInput] = useState('')
  const [shopSlugInput, setShopSlugInput] = useState('')
  const [shopDescriptionInput, setShopDescriptionInput] = useState('')
  const [shopAddressInput, setShopAddressInput] = useState('')
  const [shopLogoUrlInput, setShopLogoUrlInput] = useState('')
  const [shopCoverUrlInput, setShopCoverUrlInput] = useState('')
  const [shopThemeInput, setShopThemeInput] = useState('#d9b77b')
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [tab, setTab] = useState<Tab>('overview')
  const [publicShop, setPublicShop] = useState<PublicShop | null>(null)
  const [publicService, setPublicService] = useState('')
  const [publicBarber, setPublicBarber] = useState('')
  const [publicDate, setPublicDate] = useState(today())
  const [publicTime, setPublicTime] = useState('')
  const [publicName, setPublicName] = useState('')
  const [publicPhone, setPublicPhone] = useState('')
  const [publicNotes, setPublicNotes] = useState('')
  const [publicSuccess, setPublicSuccess] = useState<any>(null)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [newBarberName, setNewBarberName] = useState('')
  const [newServiceName, setNewServiceName] = useState('')
  const [newServicePrice, setNewServicePrice] = useState('35')
  const [newServiceDuration, setNewServiceDuration] = useState('30')
  const [appointmentDate, setAppointmentDate] = useState(today())
  const [mobileNav, setMobileNav] = useState(false)

  useEffect(() => {
    if (publicSlug) {
      void loadPublicShop(publicSlug)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    }).catch(() => setAuthReady(true))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthReady(true)
    })
    return () => listener.subscription.unsubscribe()
  }, [publicSlug])

  const loadPublicShop = async (slug: string) => {
    setBusy(true)
    setError('')
    const { data, error: queryError } = await supabase.rpc('get_public_shop', { p_slug: slug })
    if (queryError) setError('Não foi possível carregar a agenda. Confirme se a migração SQL de agendamento público já foi executada.')
    else if (!data) setError('Esta barbearia não foi encontrada ou está temporariamente indisponível.')
    else {
      setPublicShop(data as PublicShop)
      if (data.services?.length) setPublicService(data.services[0].id)
      if (data.barbers?.length) setPublicBarber(data.barbers[0].id)
    }
    setBusy(false)
  }

  const loadDashboard = useCallback(async (userId: string) => {
    setBusy(true)
    setError('')
    const { data: owned, error: ownedError } = await supabase
      .from('barbershops').select('id,name,slug,phone,timezone,description,address,logo_url,cover_url,theme_color').eq('owner_id', userId).limit(1).maybeSingle()
    if (ownedError) {
      setError(ownedError.message)
      setBusy(false)
      return
    }
    if (!owned) {
      setShop(null)
      setBusy(false)
      return
    }
    setShop(owned as Shop)
    setShopNameInput(owned.name)
    setShopPhoneInput(owned.phone || '')
    setShopSlugInput(owned.slug)
    setShopDescriptionInput(owned.description || '')
    setShopAddressInput(owned.address || '')
    setShopLogoUrlInput(owned.logo_url || '')
    setShopCoverUrlInput(owned.cover_url || '')
    setShopThemeInput(owned.theme_color || '#d9b77b')
    const [b, s, a] = await Promise.all([
      supabase.from('barbers').select('id,name,active,photo_url').eq('barbershop_id', owned.id).order('name'),
      supabase.from('services').select('id,name,description,price,duration_minutes,active,photo_url').eq('barbershop_id', owned.id).order('name'),
      supabase.from('appointments').select('id,client_name,client_phone,starts_at,ends_at,status,barber_id,service_id,notes').eq('barbershop_id', owned.id).order('starts_at', { ascending: true }).limit(500),
    ])
    if (b.error || s.error || a.error) setError(b.error?.message || s.error?.message || a.error?.message || 'Não foi possível carregar os dados.')
    setBarbers((b.data || []) as Barber[])
    setServices((s.data || []) as Service[])
    setAppointments((a.data || []) as Appointment[])
    setBusy(false)
  }, [])

  useEffect(() => {
    if (session?.user?.id && !publicSlug) {
      setAuthShopName(session.user.user_metadata?.shop_name || '')
      if (session.user.user_metadata?.shop_name && !shopNameInput) setShopNameInput(session.user.user_metadata.shop_name)
      void loadDashboard(session.user.id)
    }
  }, [session?.user?.id, publicSlug, loadDashboard])

  const refreshDashboard = async () => {
    if (session?.user?.id) await loadDashboard(session.user.id)
  }

  // Atualiza o painel quando um agendamento é criado ou alterado no banco.
  useEffect(() => {
    const userId = session?.user?.id
    const shopId = shop?.id
    if (!shopId || !userId || publicSlug) return

    const channel = supabase
      .channel('agenda-appointments-' + shopId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: 'barbershop_id=eq.' + shopId,
        },
        () => { void loadDashboard(userId) },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [shop?.id, session?.user?.id, publicSlug, loadDashboard])

  const doAuth = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      if (authMode === 'signup') {
        if (authPassword.length < 8) throw new Error('Use uma senha com pelo menos 8 caracteres.')
        if (authShopName.trim().length < 2) throw new Error('Informe o nome da barbearia.')
        const { data, error: authError } = await supabase.auth.signUp({
          email: authEmail.trim(), password: authPassword,
          options: { data: { full_name: authName.trim(), shop_name: authShopName.trim() } },
        })
        if (authError) throw authError
        if (data.session && data.user) {
          const { error: shopError } = await supabase.from('barbershops').insert({
            owner_id: data.user.id, name: authShopName.trim(), slug: slugify(authShopName) + '-' + data.user.id.slice(0, 5),
          })
          if (shopError) throw shopError
          await loadDashboard(data.user.id)
          setNotice('Conta criada! Sua barbearia está pronta para configurar.')
        } else {
          setNotice('Conta criada. Confira seu e-mail para confirmar o cadastro; depois entre com sua senha. Se a confirmação estiver desativada no Supabase, você entrará automaticamente.')
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword })
        if (authError) throw authError
        setNotice('Login realizado.')
      }
    } catch (e) { setError(messageOf(e)) }
    finally { setBusy(false) }
  }

  const createShop = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!session?.user?.id) return
    setBusy(true); setError('')
    const finalShopName = (shopNameInput || authShopName).trim()
    const slug = slugify(shopSlugInput || finalShopName)
    if (!finalShopName) { setError('Informe o nome da barbearia.'); setBusy(false); return }
    if (!slug) { setError('Informe um endereço válido para a barbearia.'); setBusy(false); return }
    const { error: createError } = await supabase.from('barbershops').insert({
      owner_id: session.user.id, name: finalShopName, slug,
      phone: shopPhoneInput.trim() || null, timezone: 'America/Sao_Paulo',
    })
    if (createError) setError(createError.code === '23505' ? 'Esse endereço já está sendo usado. Tente acrescentar seu bairro ou cidade.' : createError.message)
    else { setNotice('Barbearia criada com sucesso!'); await refreshDashboard() }
    setBusy(false)
  }

  const uploadImage = async (file: File, category: string) => {
    if (!shop) throw new Error('Crie sua barbearia antes de enviar imagens.')
    if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.')
    if (file.size > 8 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 8 MB.')
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const path = shop.id + '/' + category + '-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext
    const { error: uploadError } = await supabase.storage.from('agenda-photos').upload(path, file, { upsert: false, contentType: file.type })
    if (uploadError) throw uploadError
    const { data } = supabase.storage.from('agenda-photos').getPublicUrl(path)
    return data.publicUrl
  }

  const handleShopImage = async (file: File | undefined, kind: 'logo' | 'cover') => {
    if (!file) return
    setBusy(true); setError(''); setNotice('')
    try {
      const url = await uploadImage(file, kind)
      if (kind === 'logo') setShopLogoUrlInput(url)
      else setShopCoverUrlInput(url)
      setNotice('Imagem enviada. Clique em salvar configurações para publicar as alterações.')
    } catch (e) { setError(messageOf(e)) }
    finally { setBusy(false) }
  }

  const updateProfilePhoto = async (table: 'barbers' | 'services', item: Barber | Service, file: File | undefined) => {
    if (!shop || !file) return
    setBusy(true); setError(''); setNotice('')
    try {
      const category = (table === 'barbers' ? 'barber-' : 'service-') + item.id
      const url = await uploadImage(file, category)
      const { error: updateError } = await supabase.from(table).update({ photo_url: url }).eq('id', item.id).eq('barbershop_id', shop.id)
      if (updateError) throw updateError
      setNotice('Foto atualizada.')
      await refreshDashboard()
    } catch (e) { setError(messageOf(e)) }
    finally { setBusy(false) }
  }

  const saveShop = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!shop) return
    setBusy(true); setError('')
    const { error: saveError } = await supabase.from('barbershops').update({
      name: shopNameInput.trim(), slug: slugify(shopSlugInput), phone: shopPhoneInput.trim() || null,
      description: shopDescriptionInput.trim() || null, address: shopAddressInput.trim() || null,
      logo_url: shopLogoUrlInput || null, cover_url: shopCoverUrlInput || null, theme_color: shopThemeInput || '#d9b77b',
    }).eq('id', shop.id)
    if (saveError) setError(saveError.code === '23505' ? 'Esse link já está sendo usado por outra barbearia.' : saveError.message)
    else { setNotice('Configurações salvas.'); await refreshDashboard() }
    setBusy(false)
  }

  const addBarber = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!shop || !newBarberName.trim()) return
    setBusy(true); setError('')
    const { error: e } = await supabase.from('barbers').insert({ barbershop_id: shop.id, name: newBarberName.trim(), active: true })
    if (e) setError(e.message)
    else { setNewBarberName(''); setNotice('Profissional cadastrado.'); await refreshDashboard() }
    setBusy(false)
  }

  const addService = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!shop || !newServiceName.trim()) return
    setBusy(true); setError('')
    const { error: e } = await supabase.from('services').insert({
      barbershop_id: shop.id, name: newServiceName.trim(),
      price: Number(newServicePrice), duration_minutes: Number(newServiceDuration), active: true,
    })
    if (e) setError(e.message)
    else { setNewServiceName(''); setNotice('Serviço cadastrado.'); await refreshDashboard() }
    setBusy(false)
  }

  const toggleActive = async (table: 'barbers' | 'services', item: Barber | Service) => {
    const { error: e } = await supabase.from(table).update({ active: !item.active }).eq('id', item.id).eq('barbershop_id', shop?.id)
    if (e) setError(e.message)
    else await refreshDashboard()
  }

  const updateAppointmentStatus = async (appointment: Appointment, status: Appointment['status']) => {
    setError('')
    const { error: e } = await supabase.from('appointments').update({ status }).eq('id', appointment.id).eq('barbershop_id', shop?.id)
    if (e) setError(e.message)
    else { setNotice('Status do atendimento atualizado.'); await refreshDashboard() }
  }

  const copyLink = async () => {
    if (!shop) return
    const link = window.location.origin + '/b/' + shop.slug
    try { await navigator.clipboard.writeText(link); setNotice('Link copiado! Envie aos seus clientes.') }
    catch { setNotice('Copie o link: ' + link) }
  }

  const shopAppointments = useMemo(() => appointments.filter(a => localDate(new Date(a.starts_at)) === appointmentDate), [appointments, appointmentDate])
  const todayAppointments = useMemo(() => appointments.filter(a => localDate(new Date(a.starts_at)) === today() && a.status !== 'cancelled'), [appointments])
  const revenue = appointments.filter(a => a.status === 'completed').reduce((sum, a) => sum + Number(services.find(s => s.id === a.service_id)?.price || 0), 0)
  const selectedPublicService = publicShop?.services.find(s => s.id === publicService)
  const selectedPublicBarber = publicShop?.barbers.find(b => b.id === publicBarber)
  const galleryImages = useMemo(() => {
    if (!publicShop) return []
    const candidates = [
      publicShop.cover_url ? { url: publicShop.cover_url, title: 'Conheça nosso espaço', type: 'Nossa barbearia' } : null,
      ...publicShop.services.filter(s => s.photo_url).map(s => ({ url: s.photo_url as string, title: s.name, type: 'Nosso trabalho' })),
      ...publicShop.barbers.filter(b => b.photo_url).map(b => ({ url: b.photo_url as string, title: b.name, type: 'Nossa equipe' })),
    ].filter((item): item is { url: string; title: string; type: string } => Boolean(item?.url))
    return candidates.filter((item, index, all) => all.findIndex(other => other.url === item.url) === index)
  }, [publicShop])

  useEffect(() => {
    setGalleryIndex(0)
    if (galleryImages.length < 2) return
    const timer = window.setInterval(() => setGalleryIndex(index => (index + 1) % galleryImages.length), 5000)
    return () => window.clearInterval(timer)
  }, [galleryImages])
  const publicSlots = useMemo(() => {
    if (!publicShop || !publicDate || !selectedPublicService || !publicBarber) return []
    const slots: string[] = []
    // A função do banco também bloqueia domingos; não mostre opções que serão recusadas.
    if (new Date(publicDate + 'T12:00:00-03:00').getDay() === 0) return slots
    const now = Date.now()
    for (let minutes = 8 * 60; minutes <= 20 * 60; minutes += 30) {
      const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
      const mm = String(minutes % 60).padStart(2, '0')
      const start = new Date(publicDate + 'T' + hh + ':' + mm + ':00-03:00')
      const endsWithinHours = minutes + selectedPublicService.duration_minutes <= 21 * 60
      if (start.getTime() <= now || !endsWithinHours) continue
      slots.push(hh + ':' + mm)
    }
    return slots
  }, [publicShop, publicDate, selectedPublicService, publicBarber])

  const [busySlots, setBusySlots] = useState<{ starts_at: string; ends_at: string }[]>([])
  useEffect(() => {
    if (!publicShop || !publicDate || !publicBarber) { setBusySlots([]); return }
    let alive = true
    supabase.rpc('get_public_busy_slots', { p_slug: publicShop.slug, p_date: publicDate, p_barber_id: publicBarber })
      .then(({ data, error: e }) => {
        if (!alive) return
        if (e) setError('Não foi possível consultar os horários ocupados. Execute a migração SQL de agendamento público.')
        else setBusySlots((data || []) as { starts_at: string; ends_at: string }[])
      })
    return () => { alive = false }
  }, [publicShop, publicDate, publicBarber])

  const availableSlots = publicSlots.filter(slot => {
    if (!selectedPublicService) return false
    const start = new Date(publicDate + 'T' + slot + ':00-03:00').getTime()
    const end = start + selectedPublicService.duration_minutes * 60000
    return !busySlots.some(item => start < new Date(item.ends_at).getTime() && end > new Date(item.starts_at).getTime())
  })

  const bookPublic = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!publicShop || !selectedPublicService || !publicBarber || !publicTime) return
    setBusy(true); setError('')
    const startAt = new Date(publicDate + 'T' + publicTime + ':00-03:00').toISOString()
    const { data, error: e } = await supabase.rpc('create_public_appointment', {
      p_slug: publicShop.slug, p_barber_id: publicBarber, p_service_id: selectedPublicService.id,
      p_starts_at: startAt, p_client_name: publicName.trim(), p_client_phone: publicPhone.trim(), p_notes: publicNotes.trim() || null,
    })
    if (e) setError(e.message)
    else { setPublicSuccess(data); setPublicTime('') }
    setBusy(false)
  }

  if (publicSlug) {
    if (busy && !publicShop && !error) return <LoadingScreen />
    if (publicSuccess) return <main className="booking-page"><section className="booking-card booking-success"><div className="success-icon"><CheckCircle2 size={36} /></div><span className="eyebrow">HORÁRIO RESERVADO</span><h1>Agendamento confirmado!</h1><p>Seu horário na <strong>{publicSuccess.shop_name}</strong> foi registrado.</p><div className="booking-summary"><span><CalendarDays size={17} /> {formatDate(publicSuccess.starts_at)}</span><span><Clock3 size={17} /> {formatTime(publicSuccess.starts_at)}</span></div><p className="muted">Guarde as informações do seu horário. Em caso de necessidade, entre em contato diretamente com a barbearia.</p><a className="btn btn-primary btn-full" href="/">Conhecer AgendaKopcode <ArrowRight size={16} /></a></section></main>
    return <main className="booking-page"><div className="booking-shell"><div className="booking-brand"><Brand /><span>AGENDAMENTO ONLINE</span></div>{publicShop ? <><header className="booking-heading" style={{ '--shop-accent': publicShop.theme_color || '#d9b77b' } as React.CSSProperties}><div className="booking-hero" style={publicShop.cover_url ? { backgroundImage: `linear-gradient(180deg, rgba(12,12,11,.36), rgba(12,12,11,.94)), url("${publicShop.cover_url}")` } : undefined}><div className="booking-hero-content">{publicShop.logo_url ? <img className="public-logo" src={publicShop.logo_url} alt={'Logo de ' + publicShop.name} /> : <div className="public-logo public-logo-fallback">{publicShop.name.slice(0, 1).toUpperCase()}</div>}<span className="eyebrow">AGENDA ONLINE</span><h1>{publicShop.name}</h1><p>{publicShop.description || 'Escolha o serviço, o profissional e o melhor horário para você.'}</p>{publicShop.address && <p className="public-address">{publicShop.address}</p>}</div></div></header>{galleryImages.length > 0 && <section className="photo-gallery" aria-label="Fotos da barbearia"><div className="gallery-heading"><span className="eyebrow">UM POUCO DO NOSSO TRABALHO</span><span className="gallery-counter">{galleryIndex + 1} / {galleryImages.length}</span></div><div className="gallery-stage"><img key={galleryImages[galleryIndex]?.url} src={galleryImages[galleryIndex]?.url} alt={galleryImages[galleryIndex]?.title || 'Foto da barbearia'} /><div className="gallery-shade" /><div className="gallery-caption"><span>{galleryImages[galleryIndex]?.type}</span><strong>{galleryImages[galleryIndex]?.title}</strong></div>{galleryImages.length > 1 && <><button className="gallery-arrow gallery-prev" type="button" aria-label="Foto anterior" onClick={() => setGalleryIndex(index => (index - 1 + galleryImages.length) % galleryImages.length)}><ChevronLeft size={20} /></button><button className="gallery-arrow gallery-next" type="button" aria-label="Próxima foto" onClick={() => setGalleryIndex(index => (index + 1) % galleryImages.length)}><ChevronRight size={20} /></button></>}</div>{galleryImages.length > 1 && <div className="gallery-dots">{galleryImages.map((image, index) => <button key={image.url} type="button" aria-label={'Ver foto ' + (index + 1)} className={index === galleryIndex ? 'gallery-dot active' : 'gallery-dot'} onClick={() => setGalleryIndex(index)} />)}</div></section>}{error && <div className="alert alert-error">{error}</div>}{publicShop.services.length === 0 || publicShop.barbers.length === 0 ? <div className="empty-state"><Scissors size={28} /><h3>Agenda sendo preparada</h3><p>Esta barbearia ainda não cadastrou profissionais e serviços disponíveis.</p></div> : <form className="booking-card" onSubmit={bookPublic}><label>1. Escolha o serviço<select required value={publicService} onChange={e => { setPublicService(e.target.value); setPublicTime('') }}><option value="">Selecione</option>{publicShop.services.map(s => <option key={s.id} value={s.id}>{s.name} · {money(s.price)} · {s.duration_minutes} min</option>)}</select>{selectedPublicService?.photo_url && <img className="public-option-photo" src={selectedPublicService.photo_url} alt={selectedPublicService.name} />}</label><label>2. Escolha o profissional<select required value={publicBarber} onChange={e => { setPublicBarber(e.target.value); setPublicTime('') }}><option value="">Selecione</option>{publicShop.barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>{selectedPublicBarber?.photo_url && <img className="public-option-photo barber-option-photo" src={selectedPublicBarber.photo_url} alt={selectedPublicBarber.name} />}</label><label>3. Escolha o dia<input required type="date" min={today()} value={publicDate} onChange={e => { setPublicDate(e.target.value); setPublicTime('') }} /></label><div className="slot-section"><div className="label-row"><span>4. Horários disponíveis</span><small>{availableSlots.length} opções</small></div>{availableSlots.length ? <div className="slots-grid">{availableSlots.map(slot => <button type="button" key={slot} className={publicTime === slot ? 'slot selected' : 'slot'} onClick={() => setPublicTime(slot)}>{slot}</button>)}</div> : <p className="muted slot-empty">Nenhum horário disponível para esta seleção. Tente outro dia ou profissional.</p>}</div><div className="form-divider" /><label>Seu nome<input required minLength={2} value={publicName} onChange={e => setPublicName(e.target.value)} placeholder="Nome completo" /></label><label>WhatsApp<input required value={publicPhone} onChange={e => setPublicPhone(e.target.value)} placeholder="(00) 00000-0000" /></label><label>Observação (opcional)<textarea value={publicNotes} onChange={e => setPublicNotes(e.target.value)} placeholder="Algum detalhe para o profissional?" rows={2} /></label>{selectedPublicService && <div className="booking-total"><span>{selectedPublicService.name}<small>{selectedPublicService.duration_minutes} minutos</small></span><strong>{money(selectedPublicService.price)}</strong></div>}<button className="btn btn-primary btn-full" disabled={busy || !publicTime} type="submit">{busy ? <LoaderCircle className="spin" size={18} /> : <CalendarCheck size={18} />} Confirmar agendamento</button><p className="form-footnote"><ShieldCheck size={14} /> Seus dados são enviados somente para esta barbearia.</p></form>}</> : !busy && <div className="booking-card"><h2>Barbearia não encontrada</h2><p>Confira se o link está correto ou entre em contato com o estabelecimento.</p></div>}<footer className="booking-footer">Agendamento online com <strong>AgendaKopcode</strong></footer></div></main>
  }

  if (!authReady) return <LoadingScreen />

  if (!session) return <main className="auth-page"><div className="auth-decoration auth-decoration-one" /><div className="auth-decoration auth-decoration-two" /><div className="auth-layout"><section className="auth-intro"><Brand /><span className="eyebrow">GESTÃO FEITA PARA BARBEARIAS</span><h1>Sua agenda em dia.<br /><span>Sua barbearia em outro nível.</span></h1><p>Organize horários, profissionais, serviços e clientes em um único espaço, com um link de agendamento para compartilhar.</p><div className="auth-benefits"><span><CalendarDays /> Agenda online para seus clientes</span><span><Users /> Gestão de profissionais e serviços</span><span><ShieldCheck /> Dados separados por barbearia</span></div><small>Sem integração de pagamento nesta versão. Comece a organizar sua rotina.</small></section><section className="auth-panel"><div className="auth-panel-top"><span className="eyebrow">{authMode === 'signup' ? 'COMECE AGORA' : 'BEM-VINDO DE VOLTA'}</span><h2>{authMode === 'signup' ? 'Crie seu espaço.' : 'Entre na sua conta.'}</h2><p>{authMode === 'signup' ? 'Configure sua barbearia em poucos passos.' : 'Acesse o painel da sua barbearia.'}</p></div>{error && <div className="alert alert-error">{error}</div>}{notice && <div className="alert alert-success">{notice}</div>}<form onSubmit={doAuth} className="form-stack">{authMode === 'signup' && <><label>Seu nome<input required value={authName} onChange={e => setAuthName(e.target.value)} placeholder="Como podemos chamar você?" /></label><label>Nome da barbearia<input required value={authShopName} onChange={e => setAuthShopName(e.target.value)} placeholder="Ex.: Barbearia Central" /></label></>}<label>E-mail<input type="email" required autoComplete="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="voce@email.com" /></label><label>Senha<input type="password" required minLength={8} autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" /></label><button className="btn btn-primary btn-full" disabled={busy} type="submit">{busy ? <LoaderCircle className="spin" size={18} /> : authMode === 'signup' ? <Sparkles size={18} /> : <ArrowRight size={18} />}{authMode === 'signup' ? 'Criar conta grátis' : 'Entrar no painel'}</button></form><p className="auth-switch">{authMode === 'signup' ? 'Já tem uma conta?' : 'Ainda não tem conta?'} <button onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setError(''); setNotice('') }}>{authMode === 'signup' ? 'Fazer login' : 'Criar conta'}</button></p><div className="auth-trial"><CheckCircle2 size={16} /> Cadastro gratuito. Pagamentos não ativados.</div></section></div><footer className="auth-footer">© {new Date().getFullYear()} AgendaKopcode · Organização para quem vive da barbearia.</footer></main>

  if (busy && !shop && !error) return <LoadingScreen />

  if (!shop) return <main className="auth-page"><div className="shop-setup-card"><Brand /><span className="eyebrow">QUASE PRONTO</span><h1>Configure sua barbearia</h1><p>Defina o nome e o link que seus clientes usarão para agendar.</p>{error && <div className="alert alert-error">{error}</div>}{notice && <div className="alert alert-success">{notice}</div>}<form onSubmit={createShop} className="form-stack"><label>Nome da barbearia<input required value={shopNameInput || authShopName} onChange={e => setShopNameInput(e.target.value)} placeholder="Ex.: Barbearia Central" /></label><label>Link personalizado<input required value={shopSlugInput} onChange={e => setShopSlugInput(slugify(e.target.value))} placeholder="barbearia-central" /><small>Seu link será {window.location.origin}/b/{slugify(shopSlugInput || shopNameInput) || 'seu-link'}</small></label><label>WhatsApp da barbearia<input value={shopPhoneInput} onChange={e => setShopPhoneInput(e.target.value)} placeholder="(00) 00000-0000" /></label><button className="btn btn-primary btn-full" disabled={busy} type="submit">{busy ? <LoaderCircle className="spin" /> : <Store size={18} />} Criar minha barbearia</button></form><button className="link-button" onClick={() => supabase.auth.signOut()}><LogOut size={15} /> Sair da conta</button></div></main>

  const navItems: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
    { id: 'appointments', label: 'Agendamentos', icon: CalendarDays },
    { id: 'barbers', label: 'Profissionais', icon: Users },
    { id: 'services', label: 'Serviços', icon: Scissors },
    { id: 'settings', label: 'Minha barbearia', icon: Settings },
  ]

  return <main className="app-shell"><aside className={mobileNav ? 'sidebar sidebar-open' : 'sidebar'}><div className="sidebar-brand"><Brand /><button className="icon-button sidebar-close" onClick={() => setMobileNav(false)}><X size={18} /></button></div><div className="sidebar-shop"><div className="shop-avatar">{shop.name.slice(0, 1).toUpperCase()}</div><div><strong>{shop.name}</strong><small>Plano gratuito</small></div></div><nav className="side-nav">{navItems.map(item => <button key={item.id} className={tab === item.id ? 'side-link active' : 'side-link'} onClick={() => { setTab(item.id); setMobileNav(false) }}><item.icon size={18} />{item.label}</button>)}</nav><div className="sidebar-bottom"><div className="privacy-note"><ShieldCheck size={17} /><span>Seus dados são separados por barbearia.</span></div><button className="side-link" onClick={() => supabase.auth.signOut()}><LogOut size={18} /> Sair da conta</button></div></aside><div className="dashboard-area"><header className="dashboard-header"><button className="icon-button mobile-nav-trigger" onClick={() => setMobileNav(true)}><Menu /></button><div><span className="eyebrow">PAINEL DA BARBEARIA</span><h1>{navItems.find(i => i.id === tab)?.label}</h1></div><div className="header-actions"><a className="btn btn-outline btn-sm" href={'/b/' + shop.slug} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Ver agenda</a><button className="btn btn-primary btn-sm" onClick={copyLink}><Share2 size={15} /> Compartilhar link</button></div></header>{error && <div className="alert alert-error dashboard-alert">{error}</div>}{notice && <div className="alert alert-success dashboard-alert"><CheckCircle2 size={16} />{notice}<button onClick={() => setNotice('')}><X size={14} /></button></div>}
    {tab === 'overview' && <section className="content-section"><div className="welcome-row"><div><h2>Olá, {session.user.user_metadata?.full_name || session.user.email?.split('@')[0]} 👋</h2><p>Veja como está a rotina da sua barbearia.</p></div><span className="date-chip"><CalendarDays size={16} /> {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date())}</span></div><div className="metric-grid"><article className="metric-card"><div><span>Atendimentos hoje</span><CalendarCheck size={18} /></div><strong>{todayAppointments.length}</strong><small>Agendamentos não cancelados</small></article><article className="metric-card"><div><span>Profissionais ativos</span><Users size={18} /></div><strong>{barbers.filter(b => b.active).length}</strong><small>Na sua equipe</small></article><article className="metric-card"><div><span>Serviços ativos</span><Scissors size={18} /></div><strong>{services.filter(s => s.active).length}</strong><small>Disponíveis para reserva</small></article><article className="metric-card"><div><span>Faturamento concluído</span><Wallet size={18} /></div><strong>{money(revenue)}</strong><small>Somente atendimentos concluídos</small></article></div><div className="content-grid"><section className="panel appointments-panel"><div className="panel-title"><div><h3>Próximos atendimentos</h3><p>Os próximos horários da agenda</p></div><button className="text-action" onClick={() => setTab('appointments')}>Ver agenda <ArrowRight size={15} /></button></div>{appointments.filter(a => a.status !== 'cancelled' && new Date(a.starts_at).getTime() >= Date.now()).slice(0, 5).map(a => <AppointmentRow key={a.id} a={a} barbers={barbers} services={services} onStatus={updateAppointmentStatus} />)}{appointments.filter(a => a.status !== 'cancelled' && new Date(a.starts_at).getTime() >= Date.now()).length === 0 && <div className="empty-state"><CalendarDays size={26} /><h3>Nenhum atendimento próximo</h3><p>Compartilhe seu link para começar a receber agendamentos.</p><button className="btn btn-outline" onClick={copyLink}><Copy size={15} /> Copiar link</button></div>}</section><section className="panel quick-panel"><div className="panel-title"><div><h3>Comece por aqui</h3><p>Deixe sua agenda pronta</p></div><Sparkles size={18} /></div><button className="quick-action" onClick={() => setTab('services')}><span><Scissors /></span><div><strong>Cadastre seus serviços</strong><small>Preço e duração de cada atendimento</small></div><ArrowRight /></button><button className="quick-action" onClick={() => setTab('barbers')}><span><Users /></span><div><strong>Adicione profissionais</strong><small>Organize sua equipe</small></div><ArrowRight /></button><button className="quick-action" onClick={copyLink}><span><LinkIcon /></span><div><strong>Compartilhe sua agenda</strong><small>Envie o link aos seus clientes</small></div><ArrowRight /></button><div className="share-box"><span>SEU LINK PÚBLICO</span><code>{window.location.host}/b/{shop.slug}</code><button className="btn btn-primary btn-full" onClick={copyLink}><Copy size={15} /> Copiar link de agendamento</button></div></section></div></section>}
    {tab === 'appointments' && <section className="content-section"><div className="page-intro"><div><h2>Agenda de atendimentos</h2><p>Consulte e atualize o status dos agendamentos recebidos.</p></div><label className="date-filter">Filtrar dia<input type="date" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} /></label></div><section className="panel"><div className="panel-title"><div><h3>{shopAppointments.length} atendimento(s)</h3><p>{formatDate(appointmentDate + 'T12:00:00-03:00')}</p></div><CalendarDays /></div>{shopAppointments.map(a => <AppointmentRow key={a.id} a={a} barbers={barbers} services={services} onStatus={updateAppointmentStatus} />)}{shopAppointments.length === 0 && <div className="empty-state"><CalendarDays size={28} /><h3>Dia sem agendamentos</h3><p>Os novos horários aparecerão aqui automaticamente.</p></div>}</section></section>}
    {tab === 'barbers' && <section className="content-section"><div className="page-intro"><div><h2>Profissionais</h2><p>Cadastre a equipe que atenderá os clientes.</p></div></div><section className="panel"><h3>Adicionar profissional</h3><form className="inline-form" onSubmit={addBarber}><input required value={newBarberName} onChange={e => setNewBarberName(e.target.value)} placeholder="Nome do profissional" /><button className="btn btn-primary" disabled={busy}><Plus size={16} /> Adicionar</button></form><div className="manage-list">{barbers.map(b => <div className="manage-row" key={b.id}><span className="manage-avatar">{b.photo_url ? <img className="mini-photo" src={b.photo_url} alt={b.name} /> : <Scissors size={17} />}</span><div className="manage-main"><strong>{b.name}</strong><small>{b.active ? 'Visível na agenda pública' : 'Inativo — não recebe reservas'}</small><label className="photo-upload"><ImagePlus size={14} /> {b.photo_url ? 'Trocar foto' : 'Adicionar foto'}<input type="file" accept="image/*" onChange={e => { void updateProfilePhoto('barbers', b, e.target.files?.[0]); e.currentTarget.value = '' }} /></label></div><button className={b.active ? 'btn btn-outline btn-sm' : 'btn btn-primary btn-sm'} onClick={() => toggleActive('barbers', b)}>{b.active ? 'Desativar' : 'Ativar'}</button></div>)}{barbers.length === 0 && <div className="empty-state"><Users size={28} /><p>Nenhum profissional cadastrado ainda.</p></div>}</div></section></section>}
    {tab === 'services' && <section className="content-section"><div className="page-intro"><div><h2>Serviços e preços</h2><p>Defina o que seus clientes podem reservar.</p></div></div><section className="panel"><h3>Adicionar serviço</h3><form className="service-form" onSubmit={addService}><label>Nome do serviço<input required value={newServiceName} onChange={e => setNewServiceName(e.target.value)} placeholder="Ex.: Corte tradicional" /></label><label>Preço (R$)<input required type="number" min="0" step="0.01" value={newServicePrice} onChange={e => setNewServicePrice(e.target.value)} /></label><label>Duração<select value={newServiceDuration} onChange={e => setNewServiceDuration(e.target.value)}>{[10,15,20,30,40,45,60,75,90,120].map(n => <option key={n} value={n}>{n} minutos</option>)}</select></label><button className="btn btn-primary" disabled={busy}><Plus size={16} /> Cadastrar serviço</button></form><div className="manage-list">{services.map(s => <div className="manage-row" key={s.id}><span className="manage-avatar">{s.photo_url ? <img className="mini-photo" src={s.photo_url} alt={s.name} /> : <Scissors size={17} />}</span><div className="manage-main"><strong>{s.name}</strong><small>{s.duration_minutes} minutos · {money(s.price)} · {s.active ? 'Ativo' : 'Inativo'}</small><label className="photo-upload"><ImagePlus size={14} /> {s.photo_url ? 'Trocar foto' : 'Adicionar foto'}<input type="file" accept="image/*" onChange={e => { void updateProfilePhoto('services', s, e.target.files?.[0]); e.currentTarget.value = '' }} /></label></div><button className={s.active ? 'btn btn-outline btn-sm' : 'btn btn-primary btn-sm'} onClick={() => toggleActive('services', s)}>{s.active ? 'Desativar' : 'Ativar'}</button></div>)}{services.length === 0 && <div className="empty-state"><Scissors size={28} /><p>Nenhum serviço cadastrado ainda.</p></div>}</div></section></section>}
    {tab === 'settings' && <section className="content-section"><div className="page-intro"><div><h2>Minha barbearia</h2><p>Atualize os dados públicos do estabelecimento.</p></div></div><section className="panel settings-panel"><form className="form-stack" onSubmit={saveShop}><label>Nome da barbearia<input required value={shopNameInput} onChange={e => setShopNameInput(e.target.value)} /></label><label>Descrição para os clientes<textarea value={shopDescriptionInput} onChange={e => setShopDescriptionInput(e.target.value)} placeholder="Conte um pouco sobre sua barbearia" rows={3} /></label><label>Endereço (opcional)<input value={shopAddressInput} onChange={e => setShopAddressInput(e.target.value)} placeholder="Rua, número, bairro e cidade" /></label><label>Endereço do link<input required value={shopSlugInput} onChange={e => setShopSlugInput(slugify(e.target.value))} /><small>Link público: {window.location.origin}/b/{slugify(shopSlugInput)}</small></label><label>WhatsApp para contato<input value={shopPhoneInput} onChange={e => setShopPhoneInput(e.target.value)} placeholder="(00) 00000-0000" /></label><label>Cor de destaque<input type="color" value={shopThemeInput} onChange={e => setShopThemeInput(e.target.value)} /><small>Usada nos detalhes da página pública.</small></label><div className="upload-grid"><div><strong>Logo da barbearia</strong>{shopLogoUrlInput && <img className="upload-preview logo-preview" src={shopLogoUrlInput} alt="Prévia do logo" />}<label className="photo-upload"><ImagePlus size={16} /> Escolher logo do aparelho<input type="file" accept="image/*" onChange={e => { void handleShopImage(e.target.files?.[0], 'logo'); e.currentTarget.value = '' }} /></label></div><div><strong>Foto de capa</strong>{shopCoverUrlInput && <img className="upload-preview cover-preview" src={shopCoverUrlInput} alt="Prévia da capa" />}<label className="photo-upload"><ImagePlus size={16} /> Escolher capa do aparelho<input type="file" accept="image/*" onChange={e => { void handleShopImage(e.target.files?.[0], 'cover'); e.currentTarget.value = '' }} /></label></div></div><p className="muted">Imagens de até 8 MB. Depois de enviar, salve as configurações para publicar a identidade visual.</p><button className="btn btn-primary" disabled={busy}><Settings size={16} /> Salvar configurações</button></form><div className="settings-share"><h3>Link de agendamento</h3><p>Compartilhe nas redes sociais ou envie diretamente aos clientes.</p><code>{window.location.origin}/b/{shop.slug}</code><button className="btn btn-outline" onClick={copyLink}><Copy size={15} /> Copiar link</button></div></section><div className="privacy-banner"><ShieldCheck /><div><strong>Separação de dados</strong><p>O banco valida a associação dos profissionais, serviços e atendimentos à mesma barbearia.</p></div></div></section>}
    <footer className="dashboard-footer">© {new Date().getFullYear()} AgendaKopcode <span>·</span> Sua agenda, seu negócio.</footer></div></main>
}

function AppointmentRow({ a, barbers, services, onStatus }: { a: Appointment; barbers: Barber[]; services: Service[]; onStatus: (a: Appointment, status: Appointment['status']) => void }) {
  const barber = barbers.find(b => b.id === a.barber_id)
  const service = services.find(s => s.id === a.service_id)
  return <div className="appointment-row"><div className="appointment-time-box"><strong>{formatTime(a.starts_at)}</strong><small>{formatDate(a.starts_at)}</small></div><div className="appointment-client"><strong>{a.client_name}</strong><small>{service?.name || 'Serviço'} · {barber?.name || 'Profissional'}</small><a href={'https://wa.me/' + a.client_phone.replace(/\D/g, '')} target="_blank" rel="noreferrer">{a.client_phone}</a></div><span className={'status-pill status-' + a.status}>{({ pending: 'Pendente', confirmed: 'Confirmado', cancelled: 'Cancelado', completed: 'Concluído', no_show: 'Não compareceu' } as Record<string, string>)[a.status]}</span><select aria-label="Status do atendimento" value={a.status} onChange={e => onStatus(a, e.target.value as Appointment['status'])}><option value="pending">Pendente</option><option value="confirmed">Confirmado</option><option value="completed">Concluído</option><option value="no_show">Não compareceu</option><option value="cancelled">Cancelar</option></select></div>
}

function LoadingScreen() {
  return <main className="loading-screen"><div className="loading-brand"><Brand /><LoaderCircle className="spin" size={25} /></div><p>Preparando seu espaço...</p></main>
}

export default App
