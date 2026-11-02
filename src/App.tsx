import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowRight, CalendarDays, CheckCircle2, Clock3, Copy, LogOut,
  Menu, Plus, Scissors, Settings, Share2, ShieldCheck, Users, Wallet,
  X, LoaderCircle, ExternalLink, Link as LinkIcon, LayoutDashboard, CalendarCheck,
  Store, Sparkles, ImagePlus, ChevronLeft, ChevronRight, Package, Tags, ReceiptText, TrendingUp
} from 'lucide-react'
import { supabase } from './lib/supabase'

type Shop = { id: string; name: string; slug: string; phone?: string | null; timezone?: string; description?: string | null; address?: string | null; logo_url?: string | null; cover_url?: string | null; theme_color?: string | null }
type Barber = { id: string; name: string; active: boolean; photo_url?: string | null; commission_percent?: number }
type Service = { id: string; name: string; description?: string | null; price: number; duration_minutes: number; active: boolean; photo_url?: string | null }
type Appointment = {
  id: string; client_name: string; client_phone: string; starts_at: string; ends_at: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  barber_id: string; service_id: string; notes?: string | null; price_at_booking?: number | null
}
type ProductCategory = { id: string; name: string }
type Product = { id: string; name: string; category_id: string | null; price: number; cost_price: number; stock_quantity: number; min_stock: number; active: boolean }
type ProductSale = { id: string; product_name: string; quantity: number; unit_price: number; cost_at_sale: number; total: number; created_at: string }
type ShopExpense = { id: string; description: string; category: string; amount: number; expense_date: string }
type PublicShop = Shop & { services: Service[]; barbers: Barber[] }\ntype PublicProduct = { id: string; name: string; description?: string | null; price: number; photo_url?: string | null; category?: string | null }\ntype CrmCustomer = { id: string; full_name: string; phone: string; notes: string; preferred_services: string[]; total_visits: number; no_show_count: number; loyalty_points: number; last_visit_at?: string | null }\ntype ShopPlan = { plan_code: 'inicio' | 'premium' | 'definitivo'; status: string; trial_ends_at: string }
type Tab = 'overview' | 'appointments' | 'crm' | 'barbers' | 'services' | 'products' | 'accounting' | 'plan' | 'settings'
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
  const [appointments, setAppointments] = useState<Appointment[]>([])\n  const [crmCustomers, setCrmCustomers] = useState<CrmCustomer[]>([])\n  const [shopPlan, setShopPlan] = useState<ShopPlan | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [publicShop, setPublicShop] = useState<PublicShop | null>(null)\n  const [publicProducts, setPublicProducts] = useState<PublicProduct[]>([])
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
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [productSales, setProductSales] = useState<ProductSale[]>([])
  const [expenses, setExpenses] = useState<ShopExpense[]>([])
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newProductName, setNewProductName] = useState('')
  const [newProductCategory, setNewProductCategory] = useState('')
  const [newProductPrice, setNewProductPrice] = useState('0')
  const [newProductCost, setNewProductCost] = useState('0')
  const [newProductStock, setNewProductStock] = useState('0')
  const [newProductMinStock, setNewProductMinStock] = useState('0')
  const [saleProductId, setSaleProductId] = useState('')
  const [saleQuantity, setSaleQuantity] = useState('1')
  const [expenseDescription, setExpenseDescription] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('Geral')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(today())
  const [accountingMonth, setAccountingMonth] = useState(today().slice(0, 7))
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
      setPublicShop(data as PublicShop)\n      const { data: catalog } = await supabase.rpc('get_public_products', { p_slug: slug })\n      setPublicProducts((catalog || []) as PublicProduct[])
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
      supabase.from('barbers').select('id,name,active,photo_url,commission_percent').eq('barbershop_id', owned.id).order('name'),
      supabase.from('services').select('id,name,description,price,duration_minutes,active,photo_url').eq('barbershop_id', owned.id).order('name'),
      supabase.from('appointments').select('id,client_name,client_phone,starts_at,ends_at,status,barber_id,service_id,notes,price_at_booking').eq('barbershop_id', owned.id).order('starts_at', { ascending: true }).limit(1000),
    ])
    const [categoriesResult, productsResult, salesResult, expensesResult] = await Promise.all([
      supabase.from('product_categories').select('id,name').eq('barbershop_id', owned.id).order('name'),
      supabase.from('products').select('id,name,category_id,price,cost_price,stock_quantity,min_stock,active').eq('barbershop_id', owned.id).order('name'),
      supabase.from('product_sales').select('id,product_name,quantity,unit_price,cost_at_sale,total,created_at').eq('barbershop_id', owned.id).order('created_at', { ascending: false }).limit(1000),
      supabase.from('shop_expenses').select('id,description,category,amount,expense_date').eq('barbershop_id', owned.id).order('expense_date', { ascending: false }).limit(1000),
    ])
    if (b.error || s.error || a.error || categoriesResult.error || productsResult.error || salesResult.error || expensesResult.error) setError(b.error?.message || s.error?.message || a.error?.message || categoriesResult.error?.message || productsResult.error?.message || salesResult.error?.message || expensesResult.error?.message || 'Não foi possível carregar os dados.')
    setBarbers((b.data || []) as Barber[])
    setServices((s.data || []) as Service[])
    setAppointments((a.data || []) as Appointment[])
    setProductCategories((categoriesResult.data || []) as ProductCategory[])
    setProducts((productsResult.data || []) as Product[])
    setProductSales((salesResult.data || []) as ProductSale[])
    setExpenses((expensesResult.data || []) as ShopExpense[])
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: 'barbershop_id=eq.' + shopId }, () => { void loadDashboard(userId) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: 'barbershop_id=eq.' + shopId }, () => { void loadDashboard(userId) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_categories', filter: 'barbershop_id=eq.' + shopId }, () => { void loadDashboard(userId) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_sales', filter: 'barbershop_id=eq.' + shopId }, () => { void loadDashboard(userId) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_expenses', filter: 'barbershop_id=eq.' + shopId }, () => { void loadDashboard(userId) })
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

  const addCategory = async (event: FormEvent) => {
    event.preventDefault()
    if (!shop || !newCategoryName.trim()) return
    setBusy(true); setError('')
    const { error: e } = await supabase.from('product_categories').insert({ barbershop_id: shop.id, name: newCategoryName.trim() })
    if (e) setError(e.code === '23505' ? 'Esta categoria já existe.' : e.message)
    else { setNewCategoryName(''); setNotice('Categoria criada.'); await refreshDashboard() }
    setBusy(false)
  }

  const addProduct = async (event: FormEvent) => {
    event.preventDefault()
    if (!shop || !newProductName.trim()) return
    setBusy(true); setError('')
    const { error: e } = await supabase.from('products').insert({
      barbershop_id: shop.id, name: newProductName.trim(), category_id: newProductCategory || null,
      price: Number(newProductPrice), cost_price: Number(newProductCost), stock_quantity: Number(newProductStock), min_stock: Number(newProductMinStock), active: true,
    })
    if (e) setError(e.message)
    else { setNewProductName(''); setNewProductPrice('0'); setNewProductCost('0'); setNewProductStock('0'); setNewProductMinStock('0'); setNotice('Produto cadastrado.'); await refreshDashboard() }
    setBusy(false)
  }

  const registerSale = async (event: FormEvent) => {
    event.preventDefault()
    if (!shop || !saleProductId) return
    setBusy(true); setError('')
    const product = products.find(p => p.id === saleProductId)
    if (!product) { setError('Selecione um produto válido.'); setBusy(false); return }
    const { error: e } = await supabase.from('product_sales').insert({
      barbershop_id: shop.id, product_id: product.id, product_name: product.name,
      quantity: Number(saleQuantity), unit_price: product.price, sold_by: session?.user?.id || null,
    })
    if (e) setError(e.message)
    else { setNotice('Venda registrada e estoque atualizado.'); setSaleQuantity('1'); await refreshDashboard() }
    setBusy(false)
  }

  const addExpense = async (event: FormEvent) => {
    event.preventDefault()
    if (!shop || !expenseDescription.trim() || Number(expenseAmount) <= 0) return
    setBusy(true); setError('')
    const { error: e } = await supabase.from('shop_expenses').insert({
      barbershop_id: shop.id, description: expenseDescription.trim(), category: expenseCategory,
      amount: Number(expenseAmount), expense_date: expenseDate,
    })
    if (e) setError(e.message)
    else { setExpenseDescription(''); setExpenseAmount(''); setNotice('Despesa registrada.'); await refreshDashboard() }
    setBusy(false)
  }

  const saveProductStock = async (product: Product, value: string) => {
    if (!shop) return
    const quantity = Number(value)
    if (!Number.isInteger(quantity) || quantity < 0) { setError('Informe uma quantidade inteira igual ou maior que zero.'); return }
    const { error: e } = await supabase.from('products').update({ stock_quantity: quantity }).eq('id', product.id).eq('barbershop_id', shop.id)
    if (e) setError(e.message)
    else { setNotice('Estoque de ' + product.name + ' atualizado.'); await refreshDashboard() }
  }

  const saveCommission = async (barber: Barber, value: string) => {
    if (!shop) return
    const percent = Number(value)
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) { setError('A comissão deve ficar entre 0% e 100%.'); return }
    const { error: e } = await supabase.from('barbers').update({ commission_percent: percent }).eq('id', barber.id).eq('barbershop_id', shop.id)
    if (e) setError(e.message)
    else { setNotice('Comissão de ' + barber.name + ' atualizada.'); await refreshDashboard() }
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
  const revenue = appointments.filter(a => a.status === 'completed').reduce((sum, a) => sum + Number(a.price_at_booking ?? services.find(s => s.id === a.service_id)?.price ?? 0), 0)
  const monthAppointments = appointments.filter(a => a.status === 'completed' && localDate(new Date(a.starts_at)).slice(0, 7) === accountingMonth)
  const monthSales = productSales.filter(s => localDate(new Date(s.created_at)).slice(0, 7) === accountingMonth)
  const monthExpenses = expenses.filter(e => e.expense_date.slice(0, 7) === accountingMonth)
  const serviceRevenue = monthAppointments.reduce((sum, a) => sum + Number(a.price_at_booking ?? services.find(s => s.id === a.service_id)?.price ?? 0), 0)
  const productRevenue = monthSales.reduce((sum, s) => sum + Number(s.total || 0), 0)
  const productCostTotal = monthSales.reduce((sum, s) => sum + Number(s.cost_at_sale || 0) * Number(s.quantity || 0), 0)
  const expenseTotal = monthExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const commissionTotal = barbers.reduce((sum, barber) => sum + monthAppointments.filter(a => a.barber_id === barber.id).reduce((part, a) => part + Number(a.price_at_booking ?? services.find(s => s.id === a.service_id)?.price ?? 0) * Number(barber.commission_percent || 0) / 100, 0), 0)
  const lowStockProducts = products.filter(p => p.active && p.stock_quantity <= p.min_stock)\n  const trackedAppointments = appointments.filter(a => a.status !== 'cancelled')\n  const noShowCount = appointments.filter(a => a.status === 'no_show').length\n  const noShowRate = trackedAppointments.length ? Math.round(noShowCount / trackedAppointments.length * 100) : 0\n  const topService = services.map(s => ({...s, total: appointments.filter(a => a.status === 'completed' && a.service_id === s.id).length})).sort((x,y) => y.total-x.total)[0]\n  const topBarber = barbers.map(b => ({...b, total: appointments.filter(a => a.status === 'completed' && a.barber_id === b.id).reduce((n,a) => n + Number(a.price_at_booking ?? services.find(s => s.id === a.service_id)?.price ?? 0),0)})).sort((x,y) => y.total-x.total)[0]
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
  const fetchBusySlots = useCallback(async () => {
    if (!publicShop || !publicDate || !publicBarber) {
      setBusySlots([])
      return [] as { starts_at: string; ends_at: string }[]
    }
    const { data, error: queryError } = await supabase.rpc('get_public_busy_slots', {
      p_slug: publicShop.slug, p_date: publicDate, p_barber_id: publicBarber,
    })
    if (queryError) throw queryError
    const latest = (data || []) as { starts_at: string; ends_at: string }[]
    setBusySlots(latest)
    return latest
  }, [publicShop?.slug, publicDate, publicBarber])

  // Atualiza disponibilidade em outras abas/dispositivos e ao voltar para a página.
  useEffect(() => {
    if (!publicShop || !publicDate || !publicBarber) { setBusySlots([]); return }
    let active = true
    const refresh = () => {
      void fetchBusySlots().catch(() => {
        if (active) setError('Não foi possível atualizar a agenda. Atualize a página antes de tentar novamente.')
      })
    }
    refresh()
    const timer = window.setInterval(refresh, 10000)
    const onFocus = () => refresh()
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [publicShop?.slug, publicDate, publicBarber, fetchBusySlots])

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
    try {
      // Revalida no servidor imediatamente antes da tentativa de reserva.
      const latest = await fetchBusySlots()
      const startMs = new Date(publicDate + 'T' + publicTime + ':00-03:00').getTime()
      const endMs = startMs + selectedPublicService.duration_minutes * 60000
      const occupied = latest.some(item =>
        startMs < new Date(item.ends_at).getTime() && endMs > new Date(item.starts_at).getTime()
      )
      if (occupied) {
        setPublicTime('')
        setError('Esse horário acabou de ser reservado em outro dispositivo. Escolha outro horário.')
        return
      }
      const startAt = new Date(startMs).toISOString()
      const { data, error: bookingError } = await supabase.rpc('create_public_appointment', {
        p_slug: publicShop.slug, p_barber_id: publicBarber, p_service_id: selectedPublicService.id,
        p_starts_at: startAt, p_client_name: publicName.trim(), p_client_phone: publicPhone.trim(), p_notes: publicNotes.trim() || null,
      })
      if (bookingError) {
        await fetchBusySlots().catch(() => undefined)
        setPublicTime('')
        const message = bookingError.message || ''
        setError(/exclusion|overlap|reservad|ocupad|horário/i.test(message)
          ? 'Esse horário acabou de ser reservado em outro dispositivo. Escolha outro horário.'
          : message)
      } else {
        setPublicSuccess(data)
        setPublicTime('')
      }
    } catch (e) {
      setError(messageOf(e))
    } finally {
      setBusy(false)
    }
  }

  if (publicSlug) {
    if (busy && !publicShop && !error) return <LoadingScreen />
    if (publicSuccess) return <main className="booking-page"><section className="booking-card booking-success"><div className="success-icon"><CheckCircle2 size={36} /></div><span className="eyebrow">HORÁRIO RESERVADO</span><h1>Agendamento confirmado!</h1><p>Seu horário na <strong>{publicSuccess.shop_name}</strong> foi registrado.</p><div className="booking-summary"><span><CalendarDays size={17} /> {formatDate(publicSuccess.starts_at)}</span><span><Clock3 size={17} /> {formatTime(publicSuccess.starts_at)}</span></div><p className="muted">Guarde as informações do seu horário. Em caso de necessidade, entre em contato diretamente com a barbearia.</p><a className="btn btn-primary btn-full" href="/">Conhecer AgendaKopcode <ArrowRight size={16} /></a></section></main>
    return <main className="booking-page"><div className="booking-shell"><div className="booking-brand"><Brand /><span>AGENDAMENTO ONLINE</span></div>{publicShop ? <><header className="booking-heading" style={{ '--shop-accent': publicShop.theme_color || '#d9b77b' } as React.CSSProperties}><div className="booking-hero" style={publicShop.cover_url ? { backgroundImage: `linear-gradient(180deg, rgba(12,12,11,.36), rgba(12,12,11,.94)), url("${publicShop.cover_url}")` } : undefined}><div className="booking-hero-content">{publicShop.logo_url ? <img className="public-logo" src={publicShop.logo_url} alt={'Logo de ' + publicShop.name} /> : <div className="public-logo public-logo-fallback">{publicShop.name.slice(0, 1).toUpperCase()}</div>}<span className="eyebrow">AGENDA ONLINE</span><h1>{publicShop.name}</h1><p>{publicShop.description || 'Escolha o serviço, o profissional e o melhor horário para você.'}</p>{publicShop.address && <p className="public-address">{publicShop.address}</p>}</div></div></header>{galleryImages.length > 0 && <section className="photo-gallery" aria-label="Fotos da barbearia"><div className="gallery-heading"><span className="eyebrow">UM POUCO DO NOSSO TRABALHO</span><span className="gallery-counter">{galleryIndex + 1} / {galleryImages.length}</span></div><div className="gallery-stage"><img key={galleryImages[galleryIndex]?.url} src={galleryImages[galleryIndex]?.url} alt={galleryImages[galleryIndex]?.title || 'Foto da barbearia'} /><div className="gallery-shade" /><div className="gallery-caption"><span>{galleryImages[galleryIndex]?.type}</span><strong>{galleryImages[galleryIndex]?.title}</strong></div>{galleryImages.length > 1 && <><button className="gallery-arrow gallery-prev" type="button" aria-label="Foto anterior" onClick={() => setGalleryIndex(index => (index - 1 + galleryImages.length) % galleryImages.length)}><ChevronLeft size={20} /></button><button className="gallery-arrow gallery-next" type="button" aria-label="Próxima foto" onClick={() => setGalleryIndex(index => (index + 1) % galleryImages.length)}><ChevronRight size={20} /></button></>}</div>{galleryImages.length > 1 && <div className="gallery-dots">{galleryImages.map((image, index) => <button key={image.url} type="button" aria-label={'Ver foto ' + (index + 1)} className={index === galleryIndex ? 'gallery-dot active' : 'gallery-dot'} onClick={() => setGalleryIndex(index)} />)}</div>}</section>}{error && <div className="alert alert-error">{error}</div>}{publicProducts.length > 0 && <section className="public-products"><div className="panel-title"><div><span className="eyebrow">PRODUTOS DISPONÍVEIS</span><h3>Produtos da barbearia</h3><p>Confira os produtos disponíveis para compra no estabelecimento.</p></div><Package /></div><div className="public-product-grid">{publicProducts.map(product => <article className="public-product-card" key={product.id}>{product.photo_url ? <img src={product.photo_url} alt={product.name} /> : <div className="public-product-placeholder"><Package size={26} /></div>}<div><small>{product.category || 'Produto'}</small><strong>{product.name}</strong>{product.description && <p>{product.description}</p>}<b>{money(product.price)}</b></div></article>)}</div></section>}{publicShop.services.length === 0 || publicShop.barbers.length === 0 ? <div className="empty-state"><Scissors size={28} /><h3>Agenda sendo preparada</h3><p>Esta barbearia ainda não cadastrou profissionais e serviços disponíveis.</p></div> : <form className="booking-card" onSubmit={bookPublic}><label>1. Escolha o serviço<select required value={publicService} onChange={e => { setPublicService(e.target.value); setPublicTime('') }}><option value="">Selecione</option>{publicShop.services.map(s => <option key={s.id} value={s.id}>{s.name} · {money(s.price)} · {s.duration_minutes} min</option>)}</select>{selectedPublicService?.photo_url && <img className="public-option-photo" src={selectedPublicService.photo_url} alt={selectedPublicService.name} />}</label><label>2. Escolha o profissional<select required value={publicBarber} onChange={e => { setPublicBarber(e.target.value); setPublicTime('') }}><option value="">Selecione</option>{publicShop.barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>{selectedPublicBarber?.photo_url && <img className="public-option-photo barber-option-photo" src={selectedPublicBarber.photo_url} alt={selectedPublicBarber.name} />}</label><label>3. Escolha o dia<input required type="date" min={today()} value={publicDate} onChange={e => { setPublicDate(e.target.value); setPublicTime('') }} /></label><div className="slot-section"><div className="label-row"><span>4. Horários disponíveis</span><small>{availableSlots.length} opções</small></div>{availableSlots.length ? <div className="slots-grid">{availableSlots.map(slot => <button type="button" key={slot} className={publicTime === slot ? 'slot selected' : 'slot'} onClick={() => setPublicTime(slot)}>{slot}</button>)}</div> : <p className="muted slot-empty">Nenhum horário disponível para esta seleção. Tente outro dia ou profissional.</p>}</div><div className="form-divider" /><label>Seu nome<input required minLength={2} value={publicName} onChange={e => setPublicName(e.target.value)} placeholder="Nome completo" /></label><label>WhatsApp<input required value={publicPhone} onChange={e => setPublicPhone(e.target.value)} placeholder="(00) 00000-0000" /></label><label>Observação (opcional)<textarea value={publicNotes} onChange={e => setPublicNotes(e.target.value)} placeholder="Algum detalhe para o profissional?" rows={2} /></label>{selectedPublicService && <div className="booking-total"><span>{selectedPublicService.name}<small>{selectedPublicService.duration_minutes} minutos</small></span><strong>{money(selectedPublicService.price)}</strong></div>}<button className="btn btn-primary btn-full" disabled={busy || !publicTime} type="submit">{busy ? <LoaderCircle className="spin" size={18} /> : <CalendarCheck size={18} />} Confirmar agendamento</button><p className="form-footnote"><ShieldCheck size={14} /> Seus dados são enviados somente para esta barbearia.</p></form>}</> : !busy && <div className="booking-card"><h2>Barbearia não encontrada</h2><p>Confira se o link está correto ou entre em contato com o estabelecimento.</p></div>}<footer className="booking-footer">Agendamento online com <strong>AgendaKopcode</strong></footer></div></main>
  }

  if (!authReady) return <LoadingScreen />

  if (!session) return <main className="auth-page"><div className="auth-decoration auth-decoration-one" /><div className="auth-decoration auth-decoration-two" /><div className="auth-layout"><section className="auth-intro"><Brand /><span className="eyebrow">GESTÃO FEITA PARA BARBEARIAS</span><h1>Sua agenda em dia.<br /><span>Sua barbearia em outro nível.</span></h1><p>Organize horários, profissionais, serviços e clientes em um único espaço, com um link de agendamento para compartilhar.</p><div className="auth-benefits"><span><CalendarDays /> Agenda online para seus clientes</span><span><Users /> Gestão de profissionais e serviços</span><span><ShieldCheck /> Dados separados por barbearia</span></div><small>Sem integração de pagamento nesta versão. Comece a organizar sua rotina.</small></section><section className="auth-panel"><div className="auth-panel-top"><span className="eyebrow">{authMode === 'signup' ? 'COMECE AGORA' : 'BEM-VINDO DE VOLTA'}</span><h2>{authMode === 'signup' ? 'Crie seu espaço.' : 'Entre na sua conta.'}</h2><p>{authMode === 'signup' ? 'Configure sua barbearia em poucos passos.' : 'Acesse o painel da sua barbearia.'}</p></div>{error && <div className="alert alert-error">{error}</div>}{notice && <div className="alert alert-success">{notice}</div>}<form onSubmit={doAuth} className="form-stack">{authMode === 'signup' && <><label>Seu nome<input required value={authName} onChange={e => setAuthName(e.target.value)} placeholder="Como podemos chamar você?" /></label><label>Nome da barbearia<input required value={authShopName} onChange={e => setAuthShopName(e.target.value)} placeholder="Ex.: Barbearia Central" /></label></>}<label>E-mail<input type="email" required autoComplete="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="voce@email.com" /></label><label>Senha<input type="password" required minLength={8} autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" /></label><button className="btn btn-primary btn-full" disabled={busy} type="submit">{busy ? <LoaderCircle className="spin" size={18} /> : authMode === 'signup' ? <Sparkles size={18} /> : <ArrowRight size={18} />}{authMode === 'signup' ? 'Criar conta grátis' : 'Entrar no painel'}</button></form><p className="auth-switch">{authMode === 'signup' ? 'Já tem uma conta?' : 'Ainda não tem conta?'} <button onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setError(''); setNotice('') }}>{authMode === 'signup' ? 'Fazer login' : 'Criar conta'}</button></p><div className="auth-trial"><CheckCircle2 size={16} /> Cadastro gratuito. Pagamentos não ativados.</div></section></div><footer className="auth-footer">© {new Date().getFullYear()} AgendaKopcode · Organização para quem vive da barbearia.</footer></main>

  if (busy && !shop && !error) return <LoadingScreen />

  if (!shop) return <main className="auth-page"><div className="shop-setup-card"><Brand /><span className="eyebrow">QUASE PRONTO</span><h1>Configure sua barbearia</h1><p>Defina o nome e o link que seus clientes usarão para agendar.</p>{error && <div className="alert alert-error">{error}</div>}{notice && <div className="alert alert-success">{notice}</div>}<form onSubmit={createShop} className="form-stack"><label>Nome da barbearia<input required value={shopNameInput || authShopName} onChange={e => setShopNameInput(e.target.value)} placeholder="Ex.: Barbearia Central" /></label><label>Link personalizado<input required value={shopSlugInput} onChange={e => setShopSlugInput(slugify(e.target.value))} placeholder="barbearia-central" /><small>Seu link será {window.location.origin}/b/{slugify(shopSlugInput || shopNameInput) || 'seu-link'}</small></label><label>WhatsApp da barbearia<input value={shopPhoneInput} onChange={e => setShopPhoneInput(e.target.value)} placeholder="(00) 00000-0000" /></label><button className="btn btn-primary btn-full" disabled={busy} type="submit">{busy ? <LoaderCircle className="spin" /> : <Store size={18} />} Criar minha barbearia</button></form><button className="link-button" onClick={() => supabase.auth.signOut()}><LogOut size={15} /> Sair da conta</button></div></main>

  const navItems: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
    { id: 'appointments', label: 'Agendamentos', icon: CalendarDays },\n    { id: 'crm', label: 'Clientes e fidelidade', icon: Users },
    { id: 'barbers', label: 'Profissionais', icon: Users },
    { id: 'services', label: 'Serviços', icon: Scissors },
    { id: 'products', label: 'Produtos e estoque', icon: Package },
    { id: 'accounting', label: 'Contabilidade', icon: Wallet },\n    { id: 'plan', label: 'Planos', icon: Sparkles },
    { id: 'settings', label: 'Minha barbearia', icon: Settings },
  ]

  return <main className="app-shell"><aside className={mobileNav ? 'sidebar sidebar-open' : 'sidebar'}><div className="sidebar-brand"><Brand /><button className="icon-button sidebar-close" onClick={() => setMobileNav(false)}><X size={18} /></button></div><div className="sidebar-shop"><div className="shop-avatar">{shop.name.slice(0, 1).toUpperCase()}</div><div><strong>{shop.name}</strong><small>{shopPlan?.plan_code ? 'Plano ' + shopPlan.plan_code.toUpperCase() : 'Plano Início'}</small></div></div><nav className="side-nav">{navItems.map(item => <button key={item.id} className={tab === item.id ? 'side-link active' : 'side-link'} onClick={() => { setTab(item.id); setMobileNav(false) }}><item.icon size={18} />{item.label}</button>)}</nav><div className="sidebar-bottom"><div className="privacy-note"><ShieldCheck size={17} /><span>Seus dados são separados por barbearia.</span></div><button className="side-link" onClick={() => supabase.auth.signOut()}><LogOut size={18} /> Sair da conta</button></div></aside><div className="dashboard-area"><header className="dashboard-header"><button className="icon-button mobile-nav-trigger" onClick={() => setMobileNav(true)}><Menu /></button><div><span className="eyebrow">PAINEL DA BARBEARIA</span><h1>{navItems.find(i => i.id === tab)?.label}</h1></div><div className="header-actions"><a className="btn btn-outline btn-sm" href={'/b/' + shop.slug} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Ver agenda</a><button className="btn btn-primary btn-sm" onClick={copyLink}><Share2 size={15} /> Compartilhar link</button></div></header>{error && <div className="alert alert-error dashboard-alert">{error}</div>}{notice && <div className="alert alert-success dashboard-alert"><CheckCircle2 size={16} />{notice}<button onClick={() => setNotice('')}><X size={14} /></button></div>}
    {tab === 'overview' && <section className="content-section"><div className="welcome-row"><div><h2>Bem-vindo à {shop.name}! 👋</h2><p>Olá, {session.user.user_metadata?.full_name || session.user.email?.split('@')[0]}. Aqui está o resumo da sua barbearia.</p></div><span className="date-chip"><CalendarDays size={16} /> {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date())}</span></div><div className="metric-grid"><article className="metric-card"><div><span>Atendimentos hoje</span><CalendarCheck size={18} /></div><strong>{todayAppointments.length}</strong><small>Agendamentos não cancelados</small></article><article className="metric-card"><div><span>Profissionais ativos</span><Users size={18} /></div><strong>{barbers.filter(b => b.active).length}</strong><small>Na sua equipe</small></article><article className="metric-card"><div><span>Serviços ativos</span><Scissors size={18} /></div><strong>{services.filter(s => s.active).length}</strong><small>Disponíveis para reserva</small></article><article className="metric-card"><div><span>Faturamento concluído</span><Wallet size={18} /></div><strong>{money(revenue)}</strong><small>Somente atendimentos concluídos</small></article></div><section className="panel business-insights"><div className="panel-title"><div><h3>Indicadores do negócio</h3><p>Resumo atualizado com os dados da agenda.</p></div><TrendingUp/></div><div className="insight-grid"><div><small>Taxa de faltas</small><strong>{noShowRate}%</strong><span>{noShowCount} falta(s) em {trackedAppointments.length} agendamento(s)</span></div><div><small>Serviço mais realizado</small><strong>{topService?.name || '—'}</strong><span>{topService?.total || 0} atendimento(s) concluído(s)</span></div><div><small>Maior faturamento por barbeiro</small><strong>{topBarber?.name || '—'}</strong><span>{money(topBarber?.total || 0)} em serviços concluídos</span></div></div></section><div className="content-grid"><section className="panel appointments-panel"><div className="panel-title"><div><h3>Próximos atendimentos</h3><p>Os próximos horários da agenda</p></div><button className="text-action" onClick={() => setTab('appointments')}>Ver agenda <ArrowRight size={15} /></button></div>{appointments.filter(a => a.status !== 'cancelled' && new Date(a.starts_at).getTime() >= Date.now()).slice(0, 5).map(a => <AppointmentRow key={a.id} a={a} barbers={barbers} services={services} onStatus={updateAppointmentStatus} />)}{appointments.filter(a => a.status !== 'cancelled' && new Date(a.starts_at).getTime() >= Date.now()).length === 0 && <div className="empty-state"><CalendarDays size={26} /><h3>Nenhum atendimento próximo</h3><p>Compartilhe seu link para começar a receber agendamentos.</p><button className="btn btn-outline" onClick={copyLink}><Copy size={15} /> Copiar link</button></div>}</section><section className="panel quick-panel"><div className="panel-title"><div><h3>Comece por aqui</h3><p>Deixe sua agenda pronta</p></div><Sparkles size={18} /></div><button className="quick-action" onClick={() => setTab('services')}><span><Scissors /></span><div><strong>Cadastre seus serviços</strong><small>Preço e duração de cada atendimento</small></div><ArrowRight /></button><button className="quick-action" onClick={() => setTab('barbers')}><span><Users /></span><div><strong>Adicione profissionais</strong><small>Organize sua equipe</small></div><ArrowRight /></button><button className="quick-action" onClick={copyLink}><span><LinkIcon /></span><div><strong>Compartilhe sua agenda</strong><small>Envie o link aos seus clientes</small></div><ArrowRight /></button><div className="share-box"><span>SEU LINK PÚBLICO</span><code>{window.location.host}/b/{shop.slug}</code><button className="btn btn-primary btn-full" onClick={copyLink}><Copy size={15} /> Copiar link de agendamento</button></div></section></div></section>}
    {tab === 'crm' && <section className="content-section"><div className="page-intro"><div><h2>Relacionamento e fidelização</h2><p>Histórico, preferências e frequência dos seus clientes.</p></div></div><div className="metric-grid"><article className="metric-card"><div><span>Clientes</span><Users size={18}/></div><strong>{crmCustomers.length}</strong><small>Cadastros identificados</small></article><article className="metric-card"><div><span>Recorrentes</span><TrendingUp size={18}/></div><strong>{crmCustomers.filter(c => c.total_visits > 1).length}</strong><small>Mais de uma visita concluída</small></article><article className="metric-card"><div><span>Faltas</span><CalendarDays size={18}/></div><strong>{crmCustomers.reduce((n,c) => n + c.no_show_count, 0)}</strong><small>Registros de no-show</small></article><article className="metric-card"><div><span>Pontos</span><Sparkles size={18}/></div><strong>{crmCustomers.reduce((n,c) => n + c.loyalty_points, 0)}</strong><small>1 ponto por corte concluído</small></article></div><section className="panel"><h3>Histórico dos clientes</h3><p className="muted">Edite as observações para guardar preferências, cuidados e detalhes importantes.</p>{crmCustomers.map(c => <div className="manage-row crm-row" key={c.id}><span className="manage-avatar"><Users size={17}/></span><div className="manage-main"><strong>{c.full_name}</strong><small>{c.phone} · {c.total_visits} visita(s) · {c.no_show_count} falta(s)</small><small>Preferências: {c.preferred_services?.join(', ') || 'Ainda sem histórico'}</small><label className="crm-notes">Observações<textarea rows={2} defaultValue={c.notes || ''} placeholder="Ex.: pele sensível; prefere tesoura mais alta no topo..." onBlur={async e => { const value=e.currentTarget.value; if(value!==c.notes){const {error:err}=await supabase.from('crm_customers').update({notes:value,updated_at:new Date().toISOString()}).eq('id',c.id).eq('barbershop_id',shop.id); if(err)setError(err.message); else {setCrmCustomers(old=>old.map(x=>x.id===c.id?{...x,notes:value}:x));setNotice('Observações atualizadas.')}}}} /></label></div><div className="crm-points"><strong>{c.loyalty_points}/10</strong><small>pontos</small><div className="loyalty-track"><span style={{width:(c.loyalty_points%10*10)+'%'}}/></div><small>{Math.floor(c.loyalty_points/10)} recompensa(s)</small><a href={'https://wa.me/'+c.phone.replace(/\\D/g,'')} target="_blank" rel="noreferrer">WhatsApp</a></div></div>)}{crmCustomers.length===0 && <div className="empty-state"><Users size={28}/><h3>Seus clientes aparecerão aqui</h3><p>Os clientes serão cadastrados automaticamente quando agendarem pelo link público.</p></div>}</section><p className="muted">Fidelidade: cada atendimento concluído soma 1 ponto. A cada 10 pontos, o cliente fica elegível a uma recompensa, concedida manualmente pela barbearia.</p></section>}\n    {tab === 'appointments' && <section className="content-section"><div className="page-intro"><div><h2>Agenda de atendimentos</h2><p>Consulte e atualize o status dos agendamentos recebidos.</p></div><label className="date-filter">Filtrar dia<input type="date" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} /></label></div><section className="panel"><div className="panel-title"><div><h3>{shopAppointments.length} atendimento(s)</h3><p>{formatDate(appointmentDate + 'T12:00:00-03:00')}</p></div><CalendarDays /></div>{shopAppointments.map(a => <AppointmentRow key={a.id} a={a} barbers={barbers} services={services} onStatus={updateAppointmentStatus} />)}{shopAppointments.length === 0 && <div className="empty-state"><CalendarDays size={28} /><h3>Dia sem agendamentos</h3><p>Os novos horários aparecerão aqui automaticamente.</p></div>}</section></section>}
    {tab === 'barbers' && <section className="content-section"><div className="page-intro"><div><h2>Profissionais</h2><p>Cadastre a equipe que atenderá os clientes.</p></div></div><section className="panel"><h3>Adicionar profissional</h3><form className="inline-form" onSubmit={addBarber}><input required value={newBarberName} onChange={e => setNewBarberName(e.target.value)} placeholder="Nome do profissional" /><button className="btn btn-primary" disabled={busy}><Plus size={16} /> Adicionar</button></form><div className="manage-list">{barbers.map(b => <div className="manage-row" key={b.id}><span className="manage-avatar">{b.photo_url ? <img className="mini-photo" src={b.photo_url} alt={b.name} /> : <Scissors size={17} />}</span><div className="manage-main"><strong>{b.name}</strong><small>{b.active ? 'Visível na agenda pública' : 'Inativo — não recebe reservas'}</small><label className="photo-upload"><ImagePlus size={14} /> {b.photo_url ? 'Trocar foto' : 'Adicionar foto'}<input type="file" accept="image/*" onChange={e => { void updateProfilePhoto('barbers', b, e.target.files?.[0]); e.currentTarget.value = '' }} /></label></div><button className={b.active ? 'btn btn-outline btn-sm' : 'btn btn-primary btn-sm'} onClick={() => toggleActive('barbers', b)}>{b.active ? 'Desativar' : 'Ativar'}</button></div>)}{barbers.length === 0 && <div className="empty-state"><Users size={28} /><p>Nenhum profissional cadastrado ainda.</p></div>}</div></section></section>}
    {tab === 'services' && <section className="content-section"><div className="page-intro"><div><h2>Serviços e preços</h2><p>Defina o que seus clientes podem reservar.</p></div></div><section className="panel"><h3>Adicionar serviço</h3><form className="service-form" onSubmit={addService}><label>Nome do serviço<input required value={newServiceName} onChange={e => setNewServiceName(e.target.value)} placeholder="Ex.: Corte tradicional" /></label><label>Preço (R$)<input required type="number" min="0" step="0.01" value={newServicePrice} onChange={e => setNewServicePrice(e.target.value)} /></label><label>Duração<select value={newServiceDuration} onChange={e => setNewServiceDuration(e.target.value)}>{[10,15,20,30,40,45,60,75,90,120].map(n => <option key={n} value={n}>{n} minutos</option>)}</select></label><button className="btn btn-primary" disabled={busy}><Plus size={16} /> Cadastrar serviço</button></form><div className="manage-list">{services.map(s => <div className="manage-row" key={s.id}><span className="manage-avatar">{s.photo_url ? <img className="mini-photo" src={s.photo_url} alt={s.name} /> : <Scissors size={17} />}</span><div className="manage-main"><strong>{s.name}</strong><small>{s.duration_minutes} minutos · {money(s.price)} · {s.active ? 'Ativo' : 'Inativo'}</small><label className="photo-upload"><ImagePlus size={14} /> {s.photo_url ? 'Trocar foto' : 'Adicionar foto'}<input type="file" accept="image/*" onChange={e => { void updateProfilePhoto('services', s, e.target.files?.[0]); e.currentTarget.value = '' }} /></label></div><button className={s.active ? 'btn btn-outline btn-sm' : 'btn btn-primary btn-sm'} onClick={() => toggleActive('services', s)}>{s.active ? 'Desativar' : 'Ativar'}</button></div>)}{services.length === 0 && <div className="empty-state"><Scissors size={28} /><p>Nenhum serviço cadastrado ainda.</p></div>}</div></section></section>}
    {tab === 'products' && <section className="content-section"><div className="page-intro"><div><h2>Produtos e estoque</h2><p>Organize categorias, cadastre produtos e registre vendas com baixa automática do estoque.</p></div>{lowStockProducts.length > 0 ? <span className="date-chip"><Package size={16} /> {lowStockProducts.length} produto(s) com estoque baixo</span> : <span className="date-chip"><Package size={16} /> {products.length} produto(s) cadastrados</span>}</div><div className="content-grid"><section className="panel"><h3>Nova categoria</h3><form className="inline-form" onSubmit={addCategory}><input required value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Ex.: Pomadas, shampoos, bebidas" /><button className="btn btn-primary" disabled={busy}><Plus size={16} /> Criar</button></form><div className="manage-list">{productCategories.map(category => <div className="manage-row" key={category.id}><span className="manage-avatar"><Tags size={17} /></span><div className="manage-main"><strong>{category.name}</strong><small>{products.filter(p => p.category_id === category.id).length} produto(s)</small></div></div>)}</div></section><section className="panel"><h3>Cadastrar produto</h3><form className="form-stack" onSubmit={addProduct}><label>Nome do produto<input required value={newProductName} onChange={e => setNewProductName(e.target.value)} placeholder="Ex.: Pomada modeladora" /></label><label>Categoria<select value={newProductCategory} onChange={e => setNewProductCategory(e.target.value)}><option value="">Sem categoria</option>{productCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="service-form"><label>Preço de venda<input type="number" min="0" step="0.01" value={newProductPrice} onChange={e => setNewProductPrice(e.target.value)} /></label><label>Custo<input type="number" min="0" step="0.01" value={newProductCost} onChange={e => setNewProductCost(e.target.value)} /></label><label>Estoque inicial<input type="number" min="0" step="1" value={newProductStock} onChange={e => setNewProductStock(e.target.value)} /></label><label>Alerta de estoque baixo<input type="number" min="0" step="1" value={newProductMinStock} onChange={e => setNewProductMinStock(e.target.value)} /></label></div><button className="btn btn-primary" disabled={busy}><Plus size={16} /> Salvar produto</button></form></section></div><section className="panel"><div className="panel-title"><div><h3>Produtos cadastrados</h3><p>Itens com estoque baixo aparecem destacados.</p></div><Package /></div><div className="manage-list">{products.map(p => <div className="manage-row" key={p.id}><span className="manage-avatar"><Package size={17} /></span><div className="manage-main"><strong>{p.name}</strong><small>{productCategories.find(c => c.id === p.category_id)?.name || 'Sem categoria'} · {money(p.price)} · Custo {money(p.cost_price)}</small></div><label className="stock-field">Estoque<input aria-label={'Estoque de ' + p.name} type="number" min="0" step="1" defaultValue={p.stock_quantity} onBlur={e => { if (Number(e.currentTarget.value) !== p.stock_quantity) void saveProductStock(p, e.currentTarget.value) }} /></label><span className={p.stock_quantity <= p.min_stock ? 'status-pill status-pending' : 'status-pill status-completed'}>{p.stock_quantity <= p.min_stock ? 'Estoque baixo' : 'Em estoque'}</span></div>)}{products.length === 0 && <div className="empty-state"><Package size={28} /><p>Cadastre sua primeira categoria e produto.</p></div>}</div></section><section className="panel"><h3>Registrar venda de produto</h3><form className="service-form" onSubmit={registerSale}><label>Produto<select required value={saleProductId} onChange={e => setSaleProductId(e.target.value)}><option value="">Selecione</option>{products.filter(p => p.active && p.stock_quantity > 0).map(p => <option key={p.id} value={p.id}>{p.name} · {money(p.price)} · estoque {p.stock_quantity}</option>)}</select></label><label>Quantidade<input type="number" min="1" step="1" value={saleQuantity} onChange={e => setSaleQuantity(e.target.value)} /></label><button className="btn btn-primary" disabled={busy || !saleProductId}><ReceiptText size={16} /> Registrar venda</button></form></section></section>}
    {tab === 'accounting' && <section className="content-section"><div className="page-intro"><div><h2>Contabilidade</h2><p>Faturamento, comissões individuais, vendas e despesas da barbearia.</p></div><label className="date-filter">Competência<input type="month" value={accountingMonth} onChange={e => setAccountingMonth(e.target.value)} /></label></div><div className="metric-grid"><article className="metric-card"><div><span>Serviços concluídos</span><CalendarCheck size={18} /></div><strong>{money(serviceRevenue)}</strong><small>{monthAppointments.length} atendimento(s)</small></article><article className="metric-card"><div><span>Venda de produtos</span><Package size={18} /></div><strong>{money(productRevenue)}</strong><small>{monthSales.length} venda(s)</small></article><article className="metric-card"><div><span>Comissões calculadas</span><Users size={18} /></div><strong>{money(commissionTotal)}</strong><small>Conforme percentual de cada barbeiro</small></article><article className="metric-card"><div><span>Despesas</span><TrendingUp size={18} /></div><strong>{money(expenseTotal)}</strong><small>Custo dos produtos: {money(productCostTotal)} · Resultado estimado: {money(serviceRevenue + productRevenue - productCostTotal - commissionTotal - expenseTotal)}</small></article></div><section className="panel"><div className="panel-title"><div><h3>Equipe e comissões</h3><p>Defina o percentual de cada profissional e acompanhe quanto ele tem a receber no mês.</p></div><Users /></div><div className="manage-list">{barbers.map(b => { const total = monthAppointments.filter(a => a.barber_id === b.id).reduce((sum, a) => sum + Number(a.price_at_booking ?? services.find(s => s.id === a.service_id)?.price ?? 0), 0); const commission = total * Number(b.commission_percent || 0) / 100; return <div className="manage-row" key={b.id}><span className="manage-avatar"><Users size={17} /></span><div className="manage-main"><strong>{b.name}</strong><small>Serviços concluídos: {money(total)} · Comissão a pagar: {money(commission)}</small></div><label className="commission-field">Comissão %<input aria-label={'Comissão de ' + b.name} type="number" min="0" max="100" step="0.5" defaultValue={b.commission_percent || 0} onBlur={e => { if (Number(e.currentTarget.value) !== Number(b.commission_percent || 0)) void saveCommission(b, e.currentTarget.value) }} /></label></div>})}{barbers.length === 0 && <p className="muted">Cadastre profissionais para configurar comissões.</p>}</div></section><div className="content-grid accounting-lower"><section className="panel"><h3>Registrar despesa</h3><form className="form-stack" onSubmit={addExpense}><label>Descrição<input required value={expenseDescription} onChange={e => setExpenseDescription(e.target.value)} placeholder="Ex.: Aluguel, energia, materiais" /></label><div className="service-form"><label>Categoria<select value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)}>{['Geral','Aluguel','Água e energia','Produtos e materiais','Salários e comissões','Marketing','Manutenção','Impostos','Outros'].map(v => <option key={v}>{v}</option>)}</select></label><label>Valor<input required type="number" min="0.01" step="0.01" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} /></label><label>Data<input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} /></label></div><button className="btn btn-primary" disabled={busy}><Plus size={16} /> Lançar despesa</button></form></section><section className="panel"><h3>Despesas do mês</h3><div className="manage-list">{monthExpenses.map(e => <div className="manage-row" key={e.id}><span className="manage-avatar"><ReceiptText size={17} /></span><div className="manage-main"><strong>{e.description}</strong><small>{e.category} · {formatDate(e.expense_date + 'T12:00:00-03:00')}</small></div><strong>{money(e.amount)}</strong></div>)}{monthExpenses.length === 0 && <p className="muted">Nenhuma despesa lançada nesta competência.</p>}</div></section></div><section className="panel"><h3>Vendas recentes de produtos</h3><div className="manage-list">{monthSales.map(s => <div className="manage-row" key={s.id}><span className="manage-avatar"><Package size={17} /></span><div className="manage-main"><strong>{s.product_name}</strong><small>{s.quantity} unidade(s) · {formatDate(s.created_at)}</small></div><strong>{money(s.total)}</strong></div>)}{monthSales.length === 0 && <p className="muted">Nenhuma venda neste mês.</p>}</div></section></section>}
    {tab === 'plan' && <section className="content-section"><div className="page-intro"><div><h2>Planos da plataforma</h2><p>Os pagamentos serão integrados posteriormente. Nenhuma cobrança é realizada nesta versão.</p></div></div><div className="trial-banner"><Sparkles/><div><strong>{shopPlan?.status === 'trialing' ? 'Teste grátis do plano Início ativo' : 'Plano atual: ' + (shopPlan?.plan_code || 'inicio').toUpperCase()}</strong><p>{shopPlan?.status === 'trialing' ? 'Seu teste termina em ' + new Date(shopPlan.trial_ends_at).toLocaleString('pt-BR') + '. Você não será cobrado.' : 'A contratação online será habilitada futuramente.'}</p></div></div><div className="plan-grid"><article className="plan-card"><span className="eyebrow">PARA COMEÇAR</span><h3>Início</h3><strong>Até 2 barbeiros</strong><ul><li>Agenda online e gestão básica</li><li>Serviços, produtos e estoque</li><li>Contabilidade essencial</li><li>CRM e pontos básicos</li><li>5 dias grátis para testar</li></ul><span className="plan-current">{shopPlan?.plan_code==='inicio'?'Seu plano atual':'Plano de entrada'}</span></article><article className="plan-card plan-featured"><span className="eyebrow">CRESCIMENTO</span><h3>Premium</h3><strong>Até 4 barbeiros</strong><ul><li>Todas as funções do Início</li><li>Chat para WhatsApp*</li><li>Repescagem de clientes antigos*</li><li>Campanhas de relacionamento*</li></ul><span className="plan-current">{shopPlan?.plan_code==='premium'?'Seu plano atual':'Upgrade futuro'}</span></article><article className="plan-card"><span className="eyebrow">OPERAÇÃO COMPLETA</span><h3>Definitivo</h3><strong>Barbeiros ilimitados</strong><ul><li>Tudo do Premium</li><li>Chatbot com repescagem*</li><li>Avisos de promoções*</li><li>Suporte exclusivo</li></ul><span className="plan-current">{shopPlan?.plan_code==='definitivo'?'Seu plano atual':'Upgrade futuro'}</span></article></div><p className="muted">* WhatsApp, chatbot e campanhas exigem integração com provedores externos e não ficam ativos automaticamente nesta etapa.</p></section>}\n    {tab === 'settings' && <section className="content-section"><div className="page-intro"><div><h2>Minha barbearia</h2><p>Atualize os dados públicos do estabelecimento.</p></div></div><section className="panel settings-panel"><form className="form-stack" onSubmit={saveShop}><label>Nome da barbearia<input required value={shopNameInput} onChange={e => setShopNameInput(e.target.value)} /></label><label>Descrição para os clientes<textarea value={shopDescriptionInput} onChange={e => setShopDescriptionInput(e.target.value)} placeholder="Conte um pouco sobre sua barbearia" rows={3} /></label><label>Endereço (opcional)<input value={shopAddressInput} onChange={e => setShopAddressInput(e.target.value)} placeholder="Rua, número, bairro e cidade" /></label><label>Endereço do link<input required value={shopSlugInput} onChange={e => setShopSlugInput(slugify(e.target.value))} /><small>Link público: {window.location.origin}/b/{slugify(shopSlugInput)}</small></label><label>WhatsApp para contato<input value={shopPhoneInput} onChange={e => setShopPhoneInput(e.target.value)} placeholder="(00) 00000-0000" /></label><label>Cor de destaque<input type="color" value={shopThemeInput} onChange={e => setShopThemeInput(e.target.value)} /><small>Usada nos detalhes da página pública.</small></label><div className="upload-grid"><div><strong>Logo da barbearia</strong>{shopLogoUrlInput && <img className="upload-preview logo-preview" src={shopLogoUrlInput} alt="Prévia do logo" />}<label className="photo-upload"><ImagePlus size={16} /> Escolher logo do aparelho<input type="file" accept="image/*" onChange={e => { void handleShopImage(e.target.files?.[0], 'logo'); e.currentTarget.value = '' }} /></label></div><div><strong>Foto de capa</strong>{shopCoverUrlInput && <img className="upload-preview cover-preview" src={shopCoverUrlInput} alt="Prévia da capa" />}<label className="photo-upload"><ImagePlus size={16} /> Escolher capa do aparelho<input type="file" accept="image/*" onChange={e => { void handleShopImage(e.target.files?.[0], 'cover'); e.currentTarget.value = '' }} /></label></div></div><p className="muted">Imagens de até 8 MB. Depois de enviar, salve as configurações para publicar a identidade visual.</p><button className="btn btn-primary" disabled={busy}><Settings size={16} /> Salvar configurações</button></form><div className="settings-share"><h3>Link de agendamento</h3><p>Compartilhe nas redes sociais ou envie diretamente aos clientes.</p><code>{window.location.origin}/b/{shop.slug}</code><button className="btn btn-outline" onClick={copyLink}><Copy size={15} /> Copiar link</button></div></section><div className="privacy-banner"><ShieldCheck /><div><strong>Separação de dados</strong><p>O banco valida a associação dos profissionais, serviços e atendimentos à mesma barbearia.</p></div></div></section>}
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
