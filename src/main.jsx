import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  LayoutDashboard, Users, FileText, Settings, Plus, LogOut,
  Trash2, Printer, Save, ChevronLeft, ReceiptText
} from 'lucide-react'
import { supabase } from './supabase'
import './styles.css'

const money = (v) => new Intl.NumberFormat('en-US', {style:'currency', currency:'USD'}).format(Number(v || 0))
const today = () => new Date().toISOString().slice(0,10)

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [business, setBusiness] = useState(null)
  const [page, setPage] = useState('dashboard')

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session?.user) loadBusiness()
    else setBusiness(null)
  }, [session])

  async function loadBusiness() {
    const { data: memberships, error } = await supabase
      .from('business_members')
      .select('business_id, role, businesses(*)')
      .eq('user_id', session.user.id)
      .limit(1)
    if (error) return console.error(error)
    if (memberships?.length) setBusiness(memberships[0].businesses)
  }

  if (loading) return <div className="center-screen">Loading…</div>
  if (!session) return <Auth />
  if (!business) return <Onboarding user={session.user} onDone={loadBusiness} />

  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} business={business} />
      <main className="main">
        {page === 'dashboard' && <Dashboard business={business} setPage={setPage} />}
        {page === 'customers' && <Customers business={business} />}
        {page === 'documents' && <Documents business={business} />}
        {page === 'unbilled' && <UnbilledWork business={business} setPage={setPage} />}
        {page === 'new-invoice' && <DocumentEditor business={business} type="invoice" onClose={()=>setPage('documents')} />}
        {page === 'new-quote' && <DocumentEditor business={business} type="quote" onClose={()=>setPage('documents')} />}
        {page === 'settings' && <BusinessSettings business={business} onSaved={loadBusiness} />}
      </main>
    </div>
  )
}

function Auth() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setMsg('')
    const fn = mode === 'signin'
      ? supabase.auth.signInWithPassword({email, password})
      : supabase.auth.signUp({email, password})
    const { error } = await fn
    setBusy(false)
    if (error) setMsg(error.message)
    else if (mode === 'signup') setMsg('Account created. If email confirmation is enabled, check your inbox.')
  }

  return <div className="auth-wrap">
    <div className="auth-card">
      <img src="/atlas-support-logo.png" className="auth-logo" />
      <h1>Billing System</h1>
      <p className="muted">Quotes, invoices, customers and job billing.</p>
      <form onSubmit={submit}>
        <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" minLength="6" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
        <button className="primary wide" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
      </form>
      {msg && <div className="notice">{msg}</div>}
      <button className="link-btn" onClick={()=>setMode(mode==='signin'?'signup':'signin')}>
        {mode === 'signin' ? 'Need an account? Create one' : 'Already have an account? Sign in'}
      </button>
    </div>
  </div>
}

function Onboarding({user, onDone}) {
  const [name, setName] = useState('Atlas Support')
  const [busy, setBusy] = useState(false)
  async function createBusiness(e) {
    e.preventDefault(); setBusy(true)
    const { error } = await supabase.from('businesses').insert({
      name, created_by: user.id, invoice_prefix:'INV', quote_prefix:'Q'
    })
    setBusy(false)
    if (error) alert(error.message)
    else onDone()
  }
  return <div className="auth-wrap"><div className="auth-card">
    <img src="/atlas-support-logo.png" className="auth-logo" />
    <h2>Set up your business</h2>
    <form onSubmit={createBusiness}>
      <label>Business name<input value={name} onChange={e=>setName(e.target.value)} required /></label>
      <button className="primary wide" disabled={busy}>{busy?'Creating…':'Create business'}</button>
    </form>
  </div></div>
}

function Sidebar({page,setPage,business}) {
  const nav = [
    ['dashboard', LayoutDashboard, 'Dashboard'],
    ['customers', Users, 'Customers'],
    ['documents', FileText, 'Quotes & Invoices'],
    ['unbilled', ReceiptText, 'Unbilled Work'],
    ['settings', Settings, 'Settings'],
  ]
  return <aside className="sidebar">
    <div className="brand"><img src="/atlas-support-logo.png"/><span>Billing</span></div>
    <nav>
      {nav.map(([id,Icon,label]) => <button key={id} className={page===id?'active':''} onClick={()=>setPage(id)}><Icon size={19}/>{label}</button>)}
    </nav>
    <div className="sidebar-bottom">
      <div className="business-name">{business.name}</div>
      <button onClick={()=>supabase.auth.signOut()}><LogOut size={18}/>Sign out</button>
    </div>
  </aside>
}

function Dashboard({business,setPage}) {
  const [stats,setStats] = useState({customers:0, open:0, outstanding:0, quotes:0})
  const [recent,setRecent] = useState([])
  useEffect(()=>{ load() },[])
  async function load(){
    const [{count:customers},{data:docs}] = await Promise.all([
      supabase.from('customers').select('*',{count:'exact',head:true}).eq('business_id',business.id),
      supabase.from('documents').select('id,document_type,document_number,status,total_amount,issue_date,customers(name)')
        .eq('business_id',business.id).order('created_at',{ascending:false}).limit(6)
    ])
    const d = docs || []
    setStats({
      customers: customers || 0,
      open: d.filter(x=>x.document_type==='invoice' && !['paid','void'].includes(x.status)).length,
      outstanding: d.filter(x=>x.document_type==='invoice' && !['paid','void'].includes(x.status)).reduce((a,x)=>a+Number(x.total_amount||0),0),
      quotes: d.filter(x=>x.document_type==='quote' && !['declined','void'].includes(x.status)).length
    })
    setRecent(d)
  }
  return <section>
    <Header title="Dashboard" subtitle="Atlas Support billing at a glance." />
    <div className="actions-row no-print">
      <button className="primary" onClick={()=>setPage('new-invoice')}><Plus size={18}/>New Invoice</button>
      <button className="secondary" onClick={()=>setPage('new-quote')}><Plus size={18}/>New Quote</button>
    </div>
    <div className="stats">
      <Stat label="Customers" value={stats.customers}/>
      <Stat label="Open invoices" value={stats.open}/>
      <Stat label="Outstanding" value={money(stats.outstanding)}/>
      <Stat label="Active quotes" value={stats.quotes}/>
    </div>
    <div className="card">
      <div className="card-title"><h3>Recent documents</h3></div>
      {recent.length === 0 ? <Empty text="No quotes or invoices yet."/> :
      <table><thead><tr><th>Number</th><th>Customer</th><th>Type</th><th>Status</th><th className="right">Total</th></tr></thead>
      <tbody>{recent.map(d=><tr key={d.id}><td>{d.document_number}</td><td>{d.customers?.name}</td><td className="capitalize">{d.document_type}</td><td><span className="pill">{d.status}</span></td><td className="right">{money(d.total_amount)}</td></tr>)}</tbody></table>}
    </div>
  </section>
}
function Stat({label,value}){return <div className="stat"><span>{label}</span><strong>{value}</strong></div>}
function Header({title,subtitle}){return <header className="page-header"><div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div></header>}
function Empty({text}){return <div className="empty">{text}</div>}

function Customers({business}) {
  const [customers,setCustomers] = useState([])
  const [show,setShow]=useState(false)
  const [selected,setSelected]=useState(null)
  useEffect(()=>{load()},[])
  async function load(){
    const {data}=await supabase.from('customers').select('*').eq('business_id',business.id).order('name')
    setCustomers(data||[])
    if(selected){
      const fresh=(data||[]).find(c=>c.id===selected.id)
      if(fresh) setSelected(fresh)
    }
  }
  if(selected) return <CustomerDetails business={business} customer={selected} onBack={()=>setSelected(null)} onSaved={async(c)=>{setSelected(c);await load()}} />
  return <section>
    <Header title="Customers" subtitle="Customer billing and service information."/>
    <button className="primary no-print" onClick={()=>setShow(true)}><Plus size={18}/>Add Customer</button>
    <div className="card table-card">
      {customers.length===0?<Empty text="No customers yet."/>:
      <table><thead><tr><th>Name</th><th>Contact</th><th>Phone</th><th>Email</th><th>Billing frequency</th></tr></thead>
      <tbody>{customers.map(c=><tr key={c.id} className="clickable" onClick={()=>setSelected(c)}><td><strong>{c.name}</strong></td><td>{c.contact_name||'—'}</td><td>{c.phone||'—'}</td><td>{c.email||'—'}</td><td className="capitalize">{c.default_billing_frequency==='on_demand'?'On demand':c.default_billing_frequency}</td></tr>)}</tbody></table>}
    </div>
    {show&&<CustomerModal business={business} onClose={()=>setShow(false)} onSaved={()=>{setShow(false);load()}}/>}
  </section>
}

function CustomerModal({business,onClose,onSaved,customer=null}) {
  const empty={name:'',contact_name:'',email:'',phone:'',billing_address_line1:'',billing_address_line2:'',billing_city:'',billing_state:'',billing_postal_code:'',service_address_line1:'',service_address_line2:'',service_city:'',service_state:'',service_postal_code:'',default_billing_frequency:'immediate',notes:''}
  const [form,setForm]=useState({...empty,...(customer||{})})
  const [saving,setSaving]=useState(false)
  const change=(k,v)=>setForm(f=>({...f,[k]:v}))
  async function save(e){
    e.preventDefault();setSaving(true)
    const fields=['name','contact_name','email','phone','billing_address_line1','billing_address_line2','billing_city','billing_state','billing_postal_code','service_address_line1','service_address_line2','service_city','service_state','service_postal_code','default_billing_frequency','notes']
    const payload={}; fields.forEach(k=>payload[k]=form[k]||null)
    let result
    if(customer) result=await supabase.from('customers').update(payload).eq('id',customer.id).select().single()
    else result=await supabase.from('customers').insert({...payload,business_id:business.id}).select().single()
    setSaving(false)
    if(result.error) return alert(result.error.message)
    onSaved(result.data)
  }
  return <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-head"><h2>{customer?'Edit Customer':'Add Customer'}</h2><button type="button" onClick={onClose}>×</button></div>
    <div className="grid2">
      <label>Customer / company name<input value={form.name||''} onChange={e=>change('name',e.target.value)} required/></label>
      <label>Contact name<input value={form.contact_name||''} onChange={e=>change('contact_name',e.target.value)}/></label>
      <label>Email<input type="email" value={form.email||''} onChange={e=>change('email',e.target.value)}/></label>
      <label>Phone<input value={form.phone||''} onChange={e=>change('phone',e.target.value)}/></label>
    </div>
    <h4>Billing address</h4><div className="grid2">
      <label className="span2">Street<input value={form.billing_address_line1||''} onChange={e=>change('billing_address_line1',e.target.value)}/></label>
      <label className="span2">Address line 2<input value={form.billing_address_line2||''} onChange={e=>change('billing_address_line2',e.target.value)}/></label>
      <label>City<input value={form.billing_city||''} onChange={e=>change('billing_city',e.target.value)}/></label>
      <label>State / ZIP<div className="inline"><input value={form.billing_state||''} onChange={e=>change('billing_state',e.target.value)}/><input value={form.billing_postal_code||''} onChange={e=>change('billing_postal_code',e.target.value)}/></div></label>
    </div>
    <h4>Service address</h4><div className="grid2">
      <label className="span2">Street<input value={form.service_address_line1||''} onChange={e=>change('service_address_line1',e.target.value)}/></label>
      <label className="span2">Address line 2<input value={form.service_address_line2||''} onChange={e=>change('service_address_line2',e.target.value)}/></label>
      <label>City<input value={form.service_city||''} onChange={e=>change('service_city',e.target.value)}/></label>
      <label>State / ZIP<div className="inline"><input value={form.service_state||''} onChange={e=>change('service_state',e.target.value)}/><input value={form.service_postal_code||''} onChange={e=>change('service_postal_code',e.target.value)}/></div></label>
    </div>
    <div className="grid2 customer-bottom-fields">
      <label>Default billing frequency<select value={form.default_billing_frequency||'immediate'} onChange={e=>change('default_billing_frequency',e.target.value)}><option value="immediate">Immediate</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="on_demand">On demand</option></select></label>
      <label className="span2">Customer notes<textarea rows="4" value={form.notes||''} onChange={e=>change('notes',e.target.value)} placeholder="Access notes, billing preferences, equipment details…"/></label>
    </div>
    <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={saving}>{saving?'Saving…':customer?'Save Changes':'Save Customer'}</button></div>
  </form></div>
}

function CustomerDetails({business,customer,onBack,onSaved}) {
  const [current,setCurrent]=useState(customer)
  const [edit,setEdit]=useState(false)
  const [docs,setDocs]=useState([])
  const [unbilled,setUnbilled]=useState([])
  const [billing,setBilling]=useState(false)
  const [message,setMessage]=useState('')
  useEffect(()=>{load()},[customer.id])

  async function load(){
    const [{data:c},{data:d},{data:u}] = await Promise.all([
      supabase.from('customers').select('*').eq('id',customer.id).single(),
      supabase.from('documents').select('id,document_number,document_type,issue_date,status,total_amount').eq('customer_id',customer.id).order('created_at',{ascending:false}),
      supabase.from('unbilled_items').select('*').eq('customer_id',customer.id).is('invoiced_document_id',null).order('service_date',{ascending:true}).order('created_at',{ascending:true})
    ])
    if(c){setCurrent(c);onSaved?.(c)}
    setDocs(d||[]); setUnbilled(u||[])
  }

  const unbilledTotal=unbilled.reduce((a,i)=>a+(Number(i.quantity)||0)*(Number(i.unit_price)||0),0)
  const openInvoices=docs.filter(d=>d.document_type==='invoice'&&!['paid','void'].includes(d.status))
  const quotes=docs.filter(d=>d.document_type==='quote')
  const paidInvoices=docs.filter(d=>d.document_type==='invoice'&&d.status==='paid')
  const outstanding=openInvoices.reduce((a,d)=>a+Number(d.total_amount||0),0)

  async function billNow(){
    if(!unbilled.length) return
    if(!confirm(`Create one invoice for ${current.name} containing ${unbilled.length} unbilled item${unbilled.length===1?'':'s'} (${money(unbilledTotal)})?`)) return
    setBilling(true); setMessage('')
    const {data:invoiceId,error}=await supabase.rpc('bill_unbilled_customer',{p_customer_id:current.id})
    setBilling(false)
    if(error) return alert(error.message)
    const {data:invoice}=await supabase.from('documents').select('document_number,total_amount').eq('id',invoiceId).single()
    setMessage(`${invoice?.document_number||'Invoice'} created${invoice?.total_amount!=null?` for ${money(invoice.total_amount)}`:''}.`)
    await load()
  }

  const billingLabel=current.default_billing_frequency==='on_demand'?'On demand':current.default_billing_frequency
  return <section>
    <div className="customer-detail-head no-print">
      <button className="back" onClick={onBack}><ChevronLeft size={18}/>Back to Customers</button>
      <div className="customer-detail-actions"><button className="secondary" onClick={()=>setEdit(true)}>Edit Customer</button>{unbilled.length>0&&<button className="primary" onClick={billNow} disabled={billing}><ReceiptText size={17}/>{billing?'Billing…':'Bill Now'}</button>}</div>
    </div>
    <Header title={current.name} subtitle={`${current.contact_name||'Customer'} · ${billingLabel||'Immediate'} billing`}/>
    {message&&<div className="notice success-notice">{message}</div>}
    <div className="stats customer-stats">
      <Stat label="Unbilled work" value={money(unbilledTotal)}/>
      <Stat label="Open invoices" value={openInvoices.length}/>
      <Stat label="Outstanding" value={money(outstanding)}/>
      <Stat label="Quotes" value={quotes.length}/>
    </div>

    <div className="customer-detail-grid">
      <div className="card customer-info-card"><div className="card-title"><h3>Customer details</h3></div>
        <dl className="detail-list">
          <div><dt>Contact</dt><dd>{current.contact_name||'—'}</dd></div>
          <div><dt>Email</dt><dd>{current.email||'—'}</dd></div>
          <div><dt>Phone</dt><dd>{current.phone||'—'}</dd></div>
          <div><dt>Billing method</dt><dd className="capitalize">{billingLabel||'Immediate'}</dd></div>
          <div><dt>Billing address</dt><dd>{formatCustomerAddress(current,'billing')}</dd></div>
          <div><dt>Service address</dt><dd>{formatCustomerAddress(current,'service')}</dd></div>
        </dl>
        {current.notes&&<div className="customer-notes"><h4>Notes</h4><p>{current.notes}</p></div>}
      </div>
      <div className="card"><div className="card-title"><h3>Unbilled work</h3>{unbilled.length>0&&<strong>{money(unbilledTotal)}</strong>}</div>
        {unbilled.length===0?<Empty text="No unbilled work for this customer."/>:<table><thead><tr><th>Date</th><th>Description</th><th className="right">Amount</th></tr></thead><tbody>{unbilled.map(i=><tr key={i.id}><td>{i.service_date}</td><td>{i.description}</td><td className="right">{money((Number(i.quantity)||0)*(Number(i.unit_price)||0))}</td></tr>)}</tbody></table>}
      </div>
    </div>

    <div className="card table-card"><div className="card-title customer-section-title"><h3>Open invoices</h3></div>
      {openInvoices.length===0?<Empty text="No open invoices."/>:<table><thead><tr><th>Invoice</th><th>Date</th><th>Status</th><th className="right">Total</th></tr></thead><tbody>{openInvoices.map(d=><tr key={d.id}><td><strong>{d.document_number}</strong></td><td>{d.issue_date}</td><td><span className="pill">{d.status}</span></td><td className="right">{money(d.total_amount)}</td></tr>)}</tbody></table>}
    </div>
    <div className="card table-card"><div className="card-title customer-section-title"><h3>Quotes</h3></div>
      {quotes.length===0?<Empty text="No quotes for this customer."/>:<table><thead><tr><th>Quote</th><th>Date</th><th>Status</th><th className="right">Total</th></tr></thead><tbody>{quotes.map(d=><tr key={d.id}><td><strong>{d.document_number}</strong></td><td>{d.issue_date}</td><td><span className="pill">{d.status}</span></td><td className="right">{money(d.total_amount)}</td></tr>)}</tbody></table>}
    </div>
    <div className="card table-card"><div className="card-title customer-section-title"><h3>Paid invoice history</h3></div>
      {paidInvoices.length===0?<Empty text="No paid invoices yet."/>:<table><thead><tr><th>Invoice</th><th>Date</th><th>Status</th><th className="right">Total</th></tr></thead><tbody>{paidInvoices.map(d=><tr key={d.id}><td><strong>{d.document_number}</strong></td><td>{d.issue_date}</td><td><span className="pill">{d.status}</span></td><td className="right">{money(d.total_amount)}</td></tr>)}</tbody></table>}
    </div>
    {edit&&<CustomerModal business={business} customer={current} onClose={()=>setEdit(false)} onSaved={async(updated)=>{setEdit(false);setCurrent(updated);onSaved?.(updated);await load()}}/>}
  </section>
}

function formatCustomerAddress(c,prefix){
  const lines=[c[`${prefix}_address_line1`],c[`${prefix}_address_line2`],[c[`${prefix}_city`],c[`${prefix}_state`],c[`${prefix}_postal_code`]].filter(Boolean).join(' ')].filter(Boolean)
  return lines.length?lines.join(', '):'—'
}

function UnbilledWork({business,setPage}) {
  const [customers,setCustomers]=useState([])
  const [items,setItems]=useState([])
  const [saving,setSaving]=useState(false)
  const [billing,setBilling]=useState(null)
  const [message,setMessage]=useState('')
  const [form,setForm]=useState({customer_id:'',service_date:today(),item_type:'labor',description:'',quantity:1,unit_price:0,notes:''})

  useEffect(()=>{load()},[])

  async function load(){
    const [{data:customerData},{data:itemData}] = await Promise.all([
      supabase.from('customers').select('*').eq('business_id',business.id).order('name'),
      supabase.from('unbilled_items').select('*, customers(name,default_billing_frequency)').eq('business_id',business.id).is('invoiced_document_id',null).order('service_date',{ascending:true}).order('created_at',{ascending:true})
    ])
    setCustomers(customerData||[])
    setItems(itemData||[])
    if(!form.customer_id && customerData?.length){
      const preferred=customerData.find(c=>c.default_billing_frequency==='on_demand') || customerData[0]
      setForm(f=>({...f,customer_id:preferred.id}))
    }
  }

  const change=(k,v)=>setForm(f=>({...f,[k]:v}))
  const grouped=useMemo(()=>{
    const map={}
    for(const i of items){
      const id=i.customer_id
      if(!map[id]) map[id]={customer:customers.find(c=>c.id===id),items:[],total:0}
      map[id].items.push(i)
      map[id].total += (Number(i.quantity)||0)*(Number(i.unit_price)||0)
    }
    return Object.values(map).sort((a,b)=>(a.customer?.name||'').localeCompare(b.customer?.name||''))
  },[items,customers])

  async function addWork(e){
    e.preventDefault()
    if(!form.customer_id) return alert('Choose a customer.')
    if(!form.description.trim()) return alert('Enter a description.')
    setSaving(true); setMessage('')
    const {data:userData}=await supabase.auth.getUser()
    const {error}=await supabase.from('unbilled_items').insert({
      business_id:business.id,
      customer_id:form.customer_id,
      service_date:form.service_date,
      item_type:form.item_type||null,
      description:form.description.trim(),
      quantity:Number(form.quantity)||0,
      unit_price:Number(form.unit_price)||0,
      notes:form.notes||null,
      created_by:userData?.user?.id||null
    })
    setSaving(false)
    if(error) return alert(error.message)
    setForm(f=>({...f,description:'',quantity:1,unit_price:0,notes:''}))
    setMessage('Work added to the unbilled queue.')
    await load()
  }

  async function removeWork(id){
    if(!confirm('Remove this unbilled item?')) return
    const {error}=await supabase.from('unbilled_items').delete().eq('id',id)
    if(error) return alert(error.message)
    await load()
  }

  async function billNow(customer){
    const customerItems=items.filter(i=>i.customer_id===customer.id)
    if(!customerItems.length) return
    const total=customerItems.reduce((a,i)=>a+(Number(i.quantity)||0)*(Number(i.unit_price)||0),0)
    if(!confirm(`Create one invoice for ${customer.name} containing ${customerItems.length} unbilled item${customerItems.length===1?'':'s'} (${money(total)})?`)) return
    setBilling(customer.id); setMessage('')
    const {data:invoiceId,error}=await supabase.rpc('bill_unbilled_customer',{p_customer_id:customer.id})
    setBilling(null)
    if(error) return alert(error.message)
    const {data:invoice}=await supabase.from('documents').select('document_number,total_amount').eq('id',invoiceId).single()
    setMessage(`${invoice?.document_number||'Invoice'} created for ${customer.name}${invoice?.total_amount!=null?` — ${money(invoice.total_amount)}`:''}.`)
    await load()
  }

  return <section>
    <Header title="Unbilled Work" subtitle="Add work as you go, then create one invoice whenever you are ready to bill."/>
    {message&&<div className="notice success-notice">{message}</div>}
    <div className="editor-grid unbilled-grid">
      <form className="card" onSubmit={addWork}>
        <div className="card-title"><h3>Add unbilled work</h3></div>
        <div className="grid2">
          <label>Customer<select value={form.customer_id} onChange={e=>change('customer_id',e.target.value)} required><option value="">Select customer…</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}{c.default_billing_frequency==='on_demand'?' — On demand':''}</option>)}</select></label>
          <label>Service date<input type="date" value={form.service_date} onChange={e=>change('service_date',e.target.value)}/></label>
          <label>Type<select value={form.item_type} onChange={e=>change('item_type',e.target.value)}><option value="labor">Labor</option><option value="material">Material</option><option value="other">Other</option></select></label>
          <label>Description<input value={form.description} onChange={e=>change('description',e.target.value)} placeholder="Service, labor, material…" required/></label>
          <label>Qty / Hrs<input type="number" min="0" step="0.01" value={form.quantity} onChange={e=>change('quantity',e.target.value)}/></label>
          <label>Rate / Price<input type="number" min="0" step="0.01" value={form.unit_price} onChange={e=>change('unit_price',e.target.value)}/></label>
          <label className="span2">Internal notes<textarea rows="3" value={form.notes} onChange={e=>change('notes',e.target.value)} placeholder="Optional internal note"/></label>
        </div>
        <div className="sumrow work-preview"><span>Line amount</span><strong>{money((Number(form.quantity)||0)*(Number(form.unit_price)||0))}</strong></div>
        <button className="primary no-print" disabled={saving}><Plus size={18}/>{saving?'Adding…':'Add Unbilled Work'}</button>
      </form>
      <div className="card">
        <div className="card-title"><h3>Ready to bill</h3></div>
        {grouped.length===0?<Empty text="No unbilled work. Add a charge when work is performed."/>:
          <div className="billing-groups">{grouped.map(g=><div className="billing-group" key={g.customer?.id||g.items[0].customer_id}>
            <div><strong>{g.customer?.name||'Customer'}</strong><span>{g.items.length} item{g.items.length===1?'':'s'} · {g.customer?.default_billing_frequency==='on_demand'?'On demand':'Billing: '+(g.customer?.default_billing_frequency||'—')}</span></div>
            <div className="billing-group-total"><strong>{money(g.total)}</strong><button className="primary" type="button" onClick={()=>billNow(g.customer)} disabled={billing===g.customer?.id}><ReceiptText size={17}/>{billing===g.customer?.id?'Billing…':'Bill Now'}</button></div>
          </div>)}</div>}
      </div>
    </div>
    <div className="card table-card">
      <div className="card-title"><h3>Pending items</h3></div>
      {items.length===0?<Empty text="Nothing waiting to be billed."/>:<table><thead><tr><th>Date</th><th>Customer</th><th>Description</th><th>Type</th><th className="right">Qty</th><th className="right">Rate</th><th className="right">Amount</th><th></th></tr></thead>
      <tbody>{items.map(i=><tr key={i.id}><td>{i.service_date}</td><td>{i.customers?.name}</td><td>{i.description}</td><td className="capitalize">{i.item_type||'—'}</td><td className="right">{i.quantity}</td><td className="right">{money(i.unit_price)}</td><td className="right"><strong>{money((Number(i.quantity)||0)*(Number(i.unit_price)||0))}</strong></td><td className="right"><button className="icon danger" type="button" onClick={()=>removeWork(i.id)}><Trash2 size={16}/></button></td></tr>)}</tbody></table>}
    </div>
  </section>
}

function Documents({business}) {
  const [docs,setDocs]=useState([])
  const [view,setView]=useState(null)
  useEffect(()=>{load()},[])
  async function load(){
    const {data}=await supabase.from('documents').select('*, customers(*)').eq('business_id',business.id).order('created_at',{ascending:false})
    setDocs(data||[])
  }
  if(view) return <DocumentView doc={view} business={business} onBack={()=>setView(null)} onChanged={load}/>
  return <section><Header title="Quotes & Invoices" subtitle="All customer billing documents."/>
    <div className="card table-card">
      {docs.length===0?<Empty text="No documents yet."/>:
      <table><thead><tr><th>Number</th><th>Date</th><th>Customer</th><th>Type</th><th>Status</th><th className="right">Total</th></tr></thead>
      <tbody>{docs.map(d=><tr key={d.id} className="clickable" onClick={()=>setView(d)}><td><strong>{d.document_number}</strong></td><td>{d.issue_date}</td><td>{d.customers?.name}</td><td className="capitalize">{d.document_type}</td><td><span className="pill">{d.status}</span></td><td className="right">{money(d.total_amount)}</td></tr>)}</tbody></table>}
    </div>
  </section>
}

function DocumentEditor({business,type,onClose}) {
  const [customers,setCustomers]=useState([])
  const [customerId,setCustomerId]=useState('')
  const [date,setDate]=useState(today())
  const [taxRate,setTaxRate]=useState(Number(business.default_tax_rate||0))
  const [discount,setDiscount]=useState(0)
  const [notes,setNotes]=useState('')
  const [payment,setPayment]=useState(business.payment_instructions||'')
  const [items,setItems]=useState([{description:'',quantity:1,unit_price:0,item_type:null}])
  const [saving,setSaving]=useState(false)
  useEffect(()=>{supabase.from('customers').select('*').eq('business_id',business.id).order('name').then(({data})=>setCustomers(data||[]))},[])
  const subtotal=useMemo(()=>items.reduce((a,i)=>a+(Number(i.quantity)||0)*(Number(i.unit_price)||0),0),[items])
  const tax=subtotal*(Number(taxRate)||0)/100
  const total=Math.max(0,subtotal+tax-(Number(discount)||0))
  function setItem(i,k,v){setItems(items.map((x,idx)=>idx===i?{...x,[k]:v}:x))}
  function addItem(){setItems([...items,{description:'',quantity:1,unit_price:0,item_type:null}])}
  function removeItem(i){setItems(items.filter((_,idx)=>idx!==i))}
  async function save(){
    if(!customerId) return alert('Choose a customer.')
    if(!items.some(i=>i.description.trim())) return alert('Add at least one line item.')
    setSaving(true)
    const due = type==='invoice' && business.default_terms_days
      ? new Date(new Date(date).getTime()+Number(business.default_terms_days)*86400000).toISOString().slice(0,10)
      : null
    const valid = type==='quote' ? new Date(new Date(date).getTime()+30*86400000).toISOString().slice(0,10) : null
    const {data:doc,error}=await supabase.from('documents').insert({
      business_id:business.id, customer_id:customerId, document_type:type,
      issue_date:date, due_date:due, valid_until:valid, status:'draft',
      tax_rate:Number(taxRate)||0, discount_amount:Number(discount)||0,
      payment_instructions:payment, notes
    }).select().single()
    if(error){setSaving(false);return alert(error.message)}
    const rows=items.filter(i=>i.description.trim()).map((i,idx)=>({
      document_id:doc.id, item_type:i.item_type||null, description:i.description,
      quantity:Number(i.quantity)||0, unit_price:Number(i.unit_price)||0, sort_order:idx
    }))
    const {error:itemErr}=await supabase.from('document_items').insert(rows)
    setSaving(false)
    if(itemErr) return alert(itemErr.message)
    onClose()
  }
  return <section><div className="editor-head"><button className="back no-print" onClick={onClose}><ChevronLeft size={18}/>Back</button><div><h1>New {type==='invoice'?'Invoice':'Quote'}</h1><p>Free-form labor, materials and goods.</p></div></div>
    <div className="editor-grid">
      <div className="card">
        <div className="grid2">
          <label>Customer<select value={customerId} onChange={e=>setCustomerId(e.target.value)} required><option value="">Select customer…</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
        </div>
        <h3>Line items</h3>
        <div className="line-head"><span>Description</span><span>Qty / Hrs</span><span>Rate / Price</span><span>Amount</span><span></span></div>
        {items.map((i,idx)=><div className="line-row" key={idx}>
          <input placeholder="Labor, material, service…" value={i.description} onChange={e=>setItem(idx,'description',e.target.value)}/>
          <input type="number" min="0" step="0.01" value={i.quantity} onChange={e=>setItem(idx,'quantity',e.target.value)}/>
          <input type="number" min="0" step="0.01" value={i.unit_price} onChange={e=>setItem(idx,'unit_price',e.target.value)}/>
          <div className="line-total">{money((Number(i.quantity)||0)*(Number(i.unit_price)||0))}</div>
          <button className="icon danger" onClick={()=>removeItem(idx)} disabled={items.length===1}><Trash2 size={17}/></button>
        </div>)}
        <button className="secondary no-print" onClick={addItem}><Plus size={17}/>Add line</button>
        <div className="grid2 notes-grid">
          <label>Notes<textarea rows="4" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional notes for the customer"/></label>
          <label>Payment instructions<textarea rows="4" value={payment} onChange={e=>setPayment(e.target.value)} placeholder="Where / how to pay"/></label>
        </div>
      </div>
      <div className="card totals-card">
        <h3>Summary</h3>
        <div className="sumrow"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
        <label className="suminput"><span>Tax rate (%)</span><input type="number" min="0" step="0.01" value={taxRate} onChange={e=>setTaxRate(e.target.value)}/></label>
        <div className="sumrow"><span>Tax</span><strong>{money(tax)}</strong></div>
        <label className="suminput"><span>Discount</span><input type="number" min="0" step="0.01" value={discount} onChange={e=>setDiscount(e.target.value)}/></label>
        <div className="grand"><span>Total</span><strong>{money(total)}</strong></div>
        <button className="primary wide no-print" onClick={save} disabled={saving}><Save size={18}/>{saving?'Saving…':`Save ${type==='invoice'?'Invoice':'Quote'}`}</button>
      </div>
    </div>
  </section>
}

function DocumentView({doc,business,onBack,onChanged}) {
  const [items,setItems]=useState([])
  const [status,setStatus]=useState(doc.status)
  const [convertedInvoice,setConvertedInvoice]=useState(null)
  const [converting,setConverting]=useState(false)

  useEffect(()=>{loadDocumentDetails()},[doc.id])

  async function loadDocumentDetails(){
    const itemReq=supabase.from('document_items').select('*').eq('document_id',doc.id).order('sort_order')
    if(doc.document_type==='quote'){
      const [{data:itemData},{data:converted}]=await Promise.all([
        itemReq,
        supabase.from('documents').select('id,document_number,status,total_amount').eq('converted_from_document_id',doc.id).eq('document_type','invoice').maybeSingle()
      ])
      setItems(itemData||[])
      setConvertedInvoice(converted||null)
    } else {
      const {data}=await itemReq
      setItems(data||[])
    }
  }

  async function changeStatus(v){
    setStatus(v)
    const {error}=await supabase.from('documents').update({status:v}).eq('id',doc.id)
    if(error){setStatus(doc.status);return alert(error.message)}
    onChanged()
  }

  async function convertToInvoice(){
    if(doc.document_type!=='quote' || status!=='accepted' || convertedInvoice) return
    if(!confirm(`Convert ${doc.document_number} into a new invoice? The accepted quote will remain on file.`)) return
    setConverting(true)
    const due=business.default_terms_days
      ? new Date(Date.now()+Number(business.default_terms_days)*86400000).toISOString().slice(0,10)
      : null
    const {data:userData}=await supabase.auth.getUser()
    const {data:newDoc,error}=await supabase.from('documents').insert({
      business_id:doc.business_id,
      customer_id:doc.customer_id,
      job_id:doc.job_id||null,
      document_type:'invoice',
      issue_date:today(),
      due_date:due,
      status:'draft',
      tax_rate:Number(doc.tax_rate)||0,
      discount_amount:Number(doc.discount_amount)||0,
      payment_instructions:doc.payment_instructions||business.payment_instructions||'',
      notes:doc.notes||'',
      converted_from_document_id:doc.id,
      created_by:userData?.user?.id||null
    }).select().single()
    if(error){setConverting(false);return alert(error.message)}

    const rows=items.map((i,idx)=>({
      document_id:newDoc.id,
      item_type:i.item_type||null,
      description:i.description,
      quantity:Number(i.quantity)||0,
      unit_price:Number(i.unit_price)||0,
      sort_order:idx
    }))
    if(rows.length){
      const {error:itemErr}=await supabase.from('document_items').insert(rows)
      if(itemErr){
        await supabase.from('documents').delete().eq('id',newDoc.id)
        setConverting(false)
        return alert(itemErr.message)
      }
    }
    const {data:finished}=await supabase.from('documents').select('id,document_number,status,total_amount').eq('id',newDoc.id).single()
    setConvertedInvoice(finished||newDoc)
    setConverting(false)
    onChanged()
  }

  const c=doc.customers||{}
  return <section className="doc-page">
    <div className="doc-toolbar no-print"><button className="back" onClick={onBack}><ChevronLeft size={18}/>Back</button><div className="toolbar-right">
      {doc.document_type==='quote'&&status==='accepted'&&!convertedInvoice&&<button className="primary" onClick={convertToInvoice} disabled={converting}><ReceiptText size={18}/>{converting?'Converting…':'Convert to Invoice'}</button>}
      {doc.document_type==='quote'&&convertedInvoice&&<span className="converted-badge">Converted to {convertedInvoice.document_number}</span>}
      <select value={status} onChange={e=>changeStatus(e.target.value)}><option>draft</option><option>sent</option>{doc.document_type==='quote'&&<option>accepted</option>}{doc.document_type==='quote'&&<option>declined</option>}{doc.document_type==='invoice'&&<option>paid</option>}<option>void</option></select><button className="primary" onClick={()=>window.print()}><Printer size={18}/>Print / PDF</button></div></div>
    <article className="invoice-sheet">
      <div className="invoice-top"><img src="/atlas-support-logo.png"/><div className="doc-meta"><h1>{doc.document_type.toUpperCase()}</h1><strong>{doc.document_number}</strong><span>Date: {doc.issue_date}</span>{doc.due_date&&<span>Due: {doc.due_date}</span>}{doc.valid_until&&<span>Valid until: {doc.valid_until}</span>}</div></div>
      {doc.document_type==='quote'&&convertedInvoice&&<div className="conversion-note">Accepted quote converted to invoice <strong>{convertedInvoice.document_number}</strong>.</div>}
      <div className="invoice-parties">
        <div><h4>FROM</h4><strong>{business.name}</strong>{business.address_line1&&<span>{business.address_line1}</span>}{business.city&&<span>{business.city}, {business.state} {business.postal_code}</span>}{business.phone&&<span>{business.phone}</span>}{business.email&&<span>{business.email}</span>}</div>
        <div><h4>BILL TO</h4><strong>{c.name}</strong>{c.contact_name&&<span>{c.contact_name}</span>}{c.billing_address_line1&&<span>{c.billing_address_line1}</span>}{c.billing_city&&<span>{c.billing_city}, {c.billing_state} {c.billing_postal_code}</span>}{c.email&&<span>{c.email}</span>}</div>
      </div>
      <table className="invoice-table"><thead><tr><th>Description</th><th className="right">Qty/Hrs</th><th className="right">Rate/Price</th><th className="right">Amount</th></tr></thead>
        <tbody>{items.map(i=><tr key={i.id}><td>{i.description}</td><td className="right">{i.quantity}</td><td className="right">{money(i.unit_price)}</td><td className="right">{money(i.line_total)}</td></tr>)}</tbody></table>
      <div className="invoice-bottom"><div className="payment-block">{doc.notes&&<><h4>NOTES</h4><p>{doc.notes}</p></>}{doc.payment_instructions&&<><h4>PAYMENT</h4><p>{doc.payment_instructions}</p></>}</div>
        <div className="invoice-totals"><div><span>Subtotal</span><b>{money(doc.subtotal)}</b></div>{Number(doc.tax_amount)>0&&<div><span>Tax</span><b>{money(doc.tax_amount)}</b></div>}{Number(doc.discount_amount)>0&&<div><span>Discount</span><b>-{money(doc.discount_amount)}</b></div>}<div className="invoice-grand"><span>Total</span><b>{money(doc.total_amount)}</b></div></div></div>
    </article>
  </section>
}

function BusinessSettings({business,onSaved}) {
  const [form,setForm]=useState({...business})
  const change=(k,v)=>setForm({...form,[k]:v})
  async function save(e){e.preventDefault();const fields=['name','email','phone','address_line1','address_line2','city','state','postal_code','payment_instructions','default_tax_rate','default_terms_days','invoice_prefix','quote_prefix'];const payload={};fields.forEach(k=>payload[k]=form[k]??null);const {error}=await supabase.from('businesses').update(payload).eq('id',business.id);if(error)alert(error.message);else{alert('Settings saved.');onSaved()}}
  return <section><Header title="Settings" subtitle="Business details used on invoices and quotes."/>
    <form className="card settings-form" onSubmit={save}>
      <div className="settings-logo"><img src="/atlas-support-logo.png"/><span>Current invoice logo</span></div>
      <div className="grid2">
        <label>Business name<input value={form.name||''} onChange={e=>change('name',e.target.value)}/></label>
        <label>Email<input value={form.email||''} onChange={e=>change('email',e.target.value)}/></label>
        <label>Phone<input value={form.phone||''} onChange={e=>change('phone',e.target.value)}/></label>
        <label>Address<input value={form.address_line1||''} onChange={e=>change('address_line1',e.target.value)}/></label>
        <label>City<input value={form.city||''} onChange={e=>change('city',e.target.value)}/></label>
        <label>State / ZIP<div className="inline"><input value={form.state||''} onChange={e=>change('state',e.target.value)}/><input value={form.postal_code||''} onChange={e=>change('postal_code',e.target.value)}/></div></label>
        <label>Default tax rate (%)<input type="number" min="0" step="0.01" value={form.default_tax_rate||0} onChange={e=>change('default_tax_rate',e.target.value)}/></label>
        <label>Invoice terms (days)<input type="number" min="0" value={form.default_terms_days||0} onChange={e=>change('default_terms_days',e.target.value)}/></label>
        <label>Invoice prefix<input value={form.invoice_prefix||'INV'} onChange={e=>change('invoice_prefix',e.target.value)}/></label>
        <label>Quote prefix<input value={form.quote_prefix||'Q'} onChange={e=>change('quote_prefix',e.target.value)}/></label>
        <label className="span2">Payment instructions<textarea rows="5" value={form.payment_instructions||''} onChange={e=>change('payment_instructions',e.target.value)} placeholder="Checks payable to…, Zelle…, Venmo…, etc."/></label>
      </div>
      <button className="primary no-print"><Save size={18}/>Save Settings</button>
    </form>
  </section>
}

createRoot(document.getElementById('root')).render(<App />)
