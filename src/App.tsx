import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import {
  ArrowDownRight, ArrowRight, Bell, CalendarDays, Check, CheckCircle2,
  ChevronDown, Clock3, Menu, Scissors, ShieldCheck,
  Sparkles, TrendingUp, Users, Wallet, X, Zap
} from 'lucide-react'

const plans = [
  { name: 'Essencial', price: '29,90', note: 'Para começar com organização', features: ['Link de agendamento próprio', 'Agenda online', 'Cadastro de serviços', 'Lembretes básicos'], featured: false },
  { name: 'Profissional', price: '49,90', note: 'Para barbearias em crescimento', features: ['Tudo do Essencial', 'Equipe e múltiplos barbeiros', 'Gestão de clientes', 'Relatórios financeiros', 'Notificações de agendamento'], featured: true },
  { name: 'Premium', price: '89,90', note: 'Mais controle para sua operação', features: ['Tudo do Profissional', 'Indicadores avançados', 'Gestão de despesas', 'Mais opções de personalização', 'Suporte prioritário'], featured: false },
]

function DashboardPreview() {
  return (
    <div className="dashboard-wrap" aria-label="Prévia ilustrativa do painel">
      <div className="dashboard-glow" />
      <div className="dashboard">
        <aside className="dash-sidebar">
          <div className="brand brand-small"><span className="brand-mark"><Scissors size={17} /></span><span>agenda<span className="brand-accent">kopcode</span></span></div>
          <div className="dash-shop"><div className="shop-avatar">B</div><div><strong>Barbearia Modelo</strong><small>Painel de gestão</small></div><ChevronDown size={14} /></div>
          <div className="dash-nav active"><CalendarDays size={16} /> Visão geral</div>
          <div className="dash-nav"><Clock3 size={16} /> Agendamentos</div>
          <div className="dash-nav"><Users size={16} /> Clientes</div>
          <div className="dash-nav"><Scissors size={16} /> Serviços</div>
          <div className="dash-nav"><Wallet size={16} /> Financeiro</div>
          <div className="dash-side-bottom"><ShieldCheck size={15} /> Espaço da sua barbearia</div>
        </aside>
        <main className="dash-main">
          <div className="dash-top"><div><span className="eyebrow">SEGUNDA-FEIRA, 26 DE OUTUBRO</span><h3>Bom dia! 👋</h3><p>Aqui está o resumo da sua barbearia.</p></div><div className="dash-bell"><Bell size={17} /><i /></div></div>
          <div className="stats-grid">
            <div className="stat-card"><span>Agendamentos hoje</span><CalendarDays size={16} /><strong>12</strong><small className="stat-positive"><TrendingUp size={12} /> Dia em andamento</small></div>
            <div className="stat-card"><span>Faturamento do mês</span><Wallet size={16} /><strong>R$ 4.280</strong><small className="stat-muted">Visão ilustrativa</small></div>
            <div className="stat-card"><span>Clientes</span><Users size={16} /><strong>186</strong><small className="stat-muted">Sua base de clientes</small></div>
          </div>
          <div className="agenda-panel">
            <div className="panel-heading"><div><h4>Próximos horários</h4><p>Uma visão rápida do dia</p></div><span className="today-pill">Hoje <ChevronDown size={12} /></span></div>
            <div className="appointment"><span className="appointment-time">09:00</span><span className="appointment-avatar avatar-one">RM</span><span className="appointment-person"><strong>Rafael Martins</strong><small>Corte tradicional · João</small></span><span className="status confirmed">Confirmado</span></div>
            <div className="appointment"><span className="appointment-time">09:30</span><span className="appointment-avatar avatar-two">LC</span><span className="appointment-person"><strong>Lucas Costa</strong><small>Corte + barba · Pedro</small></span><span className="status confirmed">Confirmado</span></div>
            <div className="appointment"><span className="appointment-time">10:15</span><span className="appointment-avatar avatar-three">AF</span><span className="appointment-person"><strong>André Ferreira</strong><small>Barba · João</small></span><span className="status pending">Aguardando</span></div>
          </div>
          <div className="dash-footnote"><span className="pulse-dot" /> Prévia demonstrativa — dados fictícios</div>
        </main>
      </div>
      <div className="float-card float-notification"><div className="float-icon"><Bell size={17} /></div><div><strong>Novo agendamento</strong><span>Seu próximo cliente está marcado.</span></div><CheckCircle2 size={17} className="float-check" /></div>
      <div className="float-card float-growth"><span className="growth-icon"><TrendingUp size={17} /></span><div><strong>Mais organização.</strong><span>Mais tempo para atender.</span></div></div>
    </div>
  )
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [faqOpen, setFaqOpen] = useState<number | null>(0)
  const [selectedPlan, setSelectedPlan] = useState('Profissional')
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [backendStatus, setBackendStatus] = useState<'checking' | 'ready' | 'missing' | 'error'>('checking')

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setBackendStatus('missing')
      return
    }
    supabase.auth.getSession()
      .then(({ error }) => setBackendStatus(error ? 'error' : 'ready'))
      .catch(() => setBackendStatus('error'))
  }, [])

  const startTrial = (plan = 'Profissional') => {
    setSelectedPlan(plan)
    setNoticeOpen(true)
  }

  return (
    <>
      <header className="site-header">
        <div className="container nav-container">
          <a href="#inicio" className="brand" aria-label="AgendaKopcode início"><span className="brand-mark"><Scissors size={20} /></span><span>agenda<span className="brand-accent">kopcode</span></span></a>
          <button className="mobile-menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}>{menuOpen ? <X /> : <Menu />}</button>
          <nav className={menuOpen ? 'main-nav open' : 'main-nav'}>
            <a href="#recursos" onClick={() => setMenuOpen(false)}>Recursos</a>
            <a href="#como-funciona" onClick={() => setMenuOpen(false)}>Como funciona</a>
            <a href="#planos" onClick={() => setMenuOpen(false)}>Planos</a>
            <a href="#duvidas" onClick={() => setMenuOpen(false)}>Dúvidas</a>
            <button className="nav-cta" onClick={() => startTrial()}>Começar grátis <ArrowRight size={16} /></button>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero section" id="inicio">
          <div className="hero-orb orb-one" /><div className="hero-orb orb-two" />
          <div className="container hero-grid">
            <div className="hero-copy">
              <div className="announcement"><span><Sparkles size={13} /></span> SUA BARBEARIA, MAIS PROFISSIONAL <ArrowRight size={13} /></div>
              <h1>Sua agenda em dia.<br /><span>Sua barbearia</span><br />em outro nível.</h1>
              <p className="hero-description">Agendamentos, clientes e gestão em um só lugar. Menos tempo organizando a rotina, mais tempo fazendo o que você faz de melhor.</p>
              <div className="hero-actions"><button className="button-primary button-large" onClick={() => startTrial()}>Quero conhecer grátis <ArrowRight size={18} /></button><a className="button-text" href="#recursos">Conhecer recursos <ArrowDownRight size={17} /></a></div>
              <div className="hero-proof"><div className="proof-icons"><span><Scissors size={14} /></span><span><CalendarDays size={14} /></span><span><Zap size={14} /></span></div><p><strong>Feito para a rotina real</strong><br />de barbeiros e equipes.</p></div>
              <div className="hero-trial"><Check size={15} /> 7 dias para conhecer <span /> Sem compromisso durante o teste</div>
            </div>
            <div className="hero-visual"><DashboardPreview /></div>
          </div>
          <div className="container hero-bottom"><span>UMA ROTINA MAIS LEVE COMEÇA COM</span><div><span><CalendarDays size={15} /> Agenda organizada</span><span><Bell size={15} /> Lembretes</span><span><TrendingUp size={15} /> Visão do negócio</span><span><ShieldCheck size={15} /> Dados separados por empresa</span></div></div>
        </section>

        <section className="benefits section" id="recursos">
          <div className="container">
            <div className="section-heading"><span className="eyebrow">MENOS CORRERIA. MAIS CONTROLE.</span><h2>O seu dia flui melhor<br />quando tudo está <span>no lugar.</span></h2><p>Ferramentas pensadas para quem atende sozinho e para quem coordena uma equipe inteira.</p></div>
            <div className="feature-grid">
              <article className="feature-card feature-dark"><div className="feature-icon"><CalendarDays /></div><span className="feature-number">01 / AGENDA</span><h3>Horários organizados, sem confusão.</h3><p>Visualize os atendimentos do dia e dê aos clientes um caminho simples para escolher um horário.</p><div className="mini-calendar"><div className="mini-cal-head"><span>Agenda de hoje</span><span>•••</span></div><div className="mini-cal-row"><span>09:00</span><i className="cal-bar bar-gold" /><small>Corte</small></div><div className="mini-cal-row"><span>09:30</span><i className="cal-bar bar-green" /><small>Corte + barba</small></div><div className="mini-cal-row"><span>10:15</span><i className="cal-bar bar-lilac" /><small>Barba</small></div></div></article>
              <article className="feature-card"><div className="feature-icon icon-sand"><Users /></div><span className="feature-number">02 / CLIENTES</span><h3>Conheça quem senta na sua cadeira.</h3><p>Tenha os dados dos clientes e o histórico da sua relação com a barbearia em um só lugar.</p><div className="client-preview"><div className="client-row"><span className="client-avatar avatar-one">RM</span><div><strong>Rafael Martins</strong><small>Cliente recorrente</small></div><span className="client-check"><Check size={13} /></span></div><div className="client-row"><span className="client-avatar avatar-two">LC</span><div><strong>Lucas Costa</strong><small>Cliente recorrente</small></div><span className="client-check"><Check size={13} /></span></div></div></article>
              <article className="feature-card"><div className="feature-icon icon-sage"><TrendingUp /></div><span className="feature-number">03 / GESTÃO</span><h3>Enxergue o negócio além da cadeira.</h3><p>Acompanhe os números da operação e tome decisões com mais clareza, sem depender de anotações soltas.</p><div className="revenue-preview"><span>Visão financeira</span><strong>Organização que acompanha seu crescimento</strong><div className="revenue-bars"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><small><TrendingUp size={13} /> Indicadores no seu painel</small></div></article>
            </div>
          </div>
        </section>

        <section className="how section" id="como-funciona">
          <div className="container how-grid"><div className="section-heading how-heading"><span className="eyebrow">COMECE SEM COMPLICAÇÃO</span><h2>Do primeiro acesso<br />à sua rotina <span>organizada.</span></h2><p>Um espaço feito para acompanhar o seu negócio, seja você um profissional independente ou dono de uma barbearia com equipe.</p><button className="button-primary" onClick={() => startTrial()}>Ver opções de plano <ArrowRight size={17} /></button></div>
            <div className="steps"><article className="step"><div className="step-number">01</div><div><h3>Configure seu espaço</h3><p>Cadastre sua barbearia, seus serviços, horários e profissionais.</p></div><span className="step-icon"><Scissors size={20} /></span></article><article className="step"><div className="step-number">02</div><div><h3>Compartilhe seu link</h3><p>Tenha um endereço de agendamento para enviar aos clientes e colocar na bio das redes sociais.</p></div><span className="step-icon"><ArrowRight size={20} /></span></article><article className="step"><div className="step-number">03</div><div><h3>Acompanhe tudo em um lugar</h3><p>Consulte a agenda, organize a equipe e acompanhe a operação pelo painel.</p></div><span className="step-icon"><TrendingUp size={20} /></span></article></div>
          </div>
        </section>

        <section className="plans section" id="planos">
          <div className="container"><div className="section-heading centered"><span className="eyebrow">ESCOLHA O SEU RITMO</span><h2>Um plano para cada<br /><span>fase da barbearia.</span></h2><p>Comece com o essencial e evolua conforme o seu negócio cresce.</p><div className="trial-label"><Sparkles size={15} /> 7 dias de teste para conhecer a plataforma</div></div>
            <div className="plans-grid">{plans.map((plan) => <article className={plan.featured ? 'plan-card plan-featured' : 'plan-card'} key={plan.name}>{plan.featured && <div className="popular-label">MAIS ESCOLHIDO</div>}<div className="plan-top"><span>{plan.name}</span>{plan.featured && <Zap size={17} />}</div><p className="plan-note">{plan.note}</p><div className="plan-price"><small>R$</small><strong>{plan.price}</strong><span>/ mês</span></div><p className="plan-billing">Valores de referência para o lançamento</p><button className={plan.featured ? 'button-primary plan-button' : 'button-outline plan-button'} onClick={() => startTrial(plan.name)}>Conhecer este plano <ArrowRight size={16} /></button><div className="plan-divider" /><span className="includes-label">O QUE ESTÁ INCLUÍDO</span><ul>{plan.features.map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul></article>)}</div>
            <p className="plans-disclaimer">Planos e preços apresentados como proposta inicial; a contratação e a cobrança ainda não estão ativadas neste protótipo.</p>
          </div>
        </section>

        <section className="security section"><div className="container security-card"><div className="security-icon"><ShieldCheck size={27} /></div><div><span className="eyebrow">PRIVACIDADE DESDE A BASE</span><h2>Os dados de cada barbearia<br />pertencem a ela.</h2><p>A plataforma está sendo planejada com separação de dados por empresa e regras de acesso. A proteção final depende da implementação e dos testes de segurança antes do lançamento.</p></div><div className="security-points"><span><CheckCircle2 size={16} /> Acesso por permissões</span><span><CheckCircle2 size={16} /> Espaços independentes</span><span><CheckCircle2 size={16} /> Segurança como prioridade</span></div></div></section>

        <section className="faq section" id="duvidas"><div className="container faq-grid"><div className="section-heading"><span className="eyebrow">DÚVIDAS FREQUENTES</span><h2>Quer saber mais<br />antes de <span>começar?</span></h2><p>Estamos construindo uma forma mais simples de cuidar da rotina da sua barbearia.</p></div><div className="faq-list">{[{q:'Serve para barbeiro autônomo?',a:'Sim. A proposta é atender tanto profissionais independentes quanto barbearias que trabalham com equipes.'},{q:'Posso ter um link para meus clientes?',a:'Sim. A experiência planejada inclui um endereço próprio para cada barbearia, fácil de compartilhar nas redes sociais.'},{q:'Como funciona o teste de 7 dias?',a:'A proposta é permitir que você conheça a plataforma por 7 dias. O cadastro e a ativação do teste ainda serão implementados.'},{q:'Já posso pagar pelo site?',a:'Ainda não. Esta é a primeira versão visual do projeto. Cadastro, pagamentos recorrentes e notificações serão conectados nas próximas etapas.'}].map((item, index) => <div className={faqOpen === index ? 'faq-item faq-item-open' : 'faq-item'} key={item.q}><button onClick={() => setFaqOpen(faqOpen === index ? null : index)} aria-expanded={faqOpen === index}><span>{item.q}</span><span className="faq-toggle">{faqOpen === index ? <X size={16} /> : <ArrowRight size={16} />}</span></button>{faqOpen === index && <p>{item.a}</p>}</div>)}</div></div></section>

        <section className="final-cta"><div className="container final-cta-inner"><div><span className="eyebrow">AGENDAKOPCODE</span><h2>Seu talento merece<br />uma rotina à altura.</h2><p>Conheça a proposta e acompanhe a evolução da plataforma.</p></div><button className="button-light" onClick={() => startTrial()}>Quero conhecer <ArrowRight size={18} /></button><div className="cta-sparkle"><Sparkles size={120} /></div></div></section>
      </main>

      <footer className="site-footer"><div className="container footer-inner"><a href="#inicio" className="brand"><span className="brand-mark"><Scissors size={18} /></span><span>agenda<span className="brand-accent">kopcode</span></span></a><p>Organização para quem vive da barbearia.</p><div className="footer-links"><a href="#recursos">Recursos</a><a href="#planos">Planos</a><a href="#duvidas">Dúvidas</a></div><span className="copyright">© {new Date().getFullYear()} AgendaKopcode</span></div></footer>

      {noticeOpen && <div className="modal-backdrop" role="presentation" onClick={() => setNoticeOpen(false)}><div className="notice-modal" role="dialog" aria-modal="true" aria-labelledby="notice-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setNoticeOpen(false)} aria-label="Fechar"><X size={19} /></button><div className="modal-symbol"><Sparkles size={24} /></div><span className="eyebrow">PRÓXIMA ETAPA</span><h2 id="notice-title">O AgendaKopcode está tomando forma.</h2><p>Você selecionou o plano <strong>{selectedPlan}</strong>. {backendStatus === 'ready' ? 'A conexão com o serviço de autenticação Supabase respondeu corretamente.' : backendStatus === 'checking' ? 'Verificando a configuração do banco de dados…' : backendStatus === 'missing' ? 'O Supabase ainda precisa ser configurado nas variáveis de ambiente do site.' : 'Não foi possível confirmar a conexão com o Supabase; confira as variáveis de ambiente e a configuração do projeto.'} O cadastro, o teste grátis e os pagamentos ainda serão ativados nas próximas etapas.</p><button className="button-primary modal-action" onClick={() => { setNoticeOpen(false); document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth' }) }}>Continuar explorando <ArrowRight size={16} /></button></div></div>}
    </>
  )
}

export default App