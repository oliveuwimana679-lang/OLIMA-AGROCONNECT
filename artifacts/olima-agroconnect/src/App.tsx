import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  getGetMarketplaceSummaryQueryKey,
  getGetMyProfileQueryKey,
  getListIncomingRequestsQueryKey,
  getListMyProductsQueryKey,
  getListMyRequestsQueryKey,
  getListProductsQueryKey,
  useCreateProduct,
  useCreateRequest,
  useDeleteProduct,
  useGetMarketplaceSummary,
  useGetMyProfile,
  useListIncomingRequests,
  useListMyProducts,
  useListMyRequests,
  useListProducts,
  useSaveMyProfile,
  useUpdateProduct,
  useUpdateRequestStatus,
  type Product,
  type ProductInput,
  type Profile,
  type ProfileRole,
} from '@workspace/api-client-react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { SupabaseAuthProvider, useSupabaseAuth } from '@/lib/supabase-auth';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Filter,
  HandCoins,
  Leaf,
  LogOut,
  MapPin,
  Menu,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShoppingBasket,
  Sprout,
  Trash2,
  Users,
  Wheat,
  X,
} from 'lucide-react';
import {
  Link,
  Redirect,
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';
import NotFound from '@/pages/not-found';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const queryClient = new QueryClient();

type Notice = { tone: 'success' | 'error'; text: string } | null;

function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link href="/" className={`brand-lockup ${inverse ? 'brand-inverse' : ''}`} data-testid="link-brand-home">
      <span className="brand-mark"><Sprout size={21} strokeWidth={1.8} /></span>
      <span className="brand-name">OLIMA<span>AGROCONNECT</span></span>
    </Link>
  );
}

function Button({
  children,
  onClick,
  kind = 'primary',
  type = 'button',
  disabled = false,
  className = '',
  testId,
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: 'primary' | 'outline' | 'quiet' | 'danger';
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
  testId?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={`button button-${kind} ${className}`}
    >
      {children}
    </button>
  );
}

function NoticeBar({ notice, onClose }: { notice: Notice; onClose?: () => void }) {
  if (!notice) return null;
  const success = notice.tone === 'success';
  return (
    <div className={`notice ${success ? 'notice-success' : 'notice-error'}`} role="status" data-testid={`status-${notice.tone}`}>
      {success ? <Check size={17} /> : <CircleAlert size={17} />}
      <span>{notice.text}</span>
      {onClose && <button onClick={onClose} aria-label="Dismiss message" data-testid="button-dismiss-notice"><X size={16} /></button>}
    </div>
  );
}

function LoadingBlock({ label = 'Loading marketplace' }: { label?: string }) {
  return (
    <div className="loading-block" role="status" data-testid="status-loading">
      <span className="skeleton skeleton-mark" />
      <div className="loading-lines"><span className="skeleton" /><span className="skeleton short" /></div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

function QueryError({ onRetry, label = 'We could not load this just now.' }: { onRetry: () => void; label?: string }) {
  return (
    <div className="empty-state error-state" data-testid="status-query-error">
      <span className="empty-icon"><RefreshCw size={22} /></span>
      <strong>Let’s try that again.</strong>
      <p>{label}</p>
      <Button kind="outline" onClick={onRetry} testId="button-retry">Retry</Button>
    </div>
  );
}

function EmptyState({ title, copy, action }: { title: string; copy: string; action?: ReactNode }) {
  return (
    <div className="empty-state" data-testid="status-empty">
      <span className="empty-icon"><Wheat size={23} /></span>
      <strong>{title}</strong>
      <p>{copy}</p>
      {action}
    </div>
  );
}

function ProductVisual({ product, compact = false }: { product: Product; compact?: boolean }) {
  return (
    <div className={`product-visual ${compact ? 'product-visual-compact' : ''}`} data-testid={`img-product-${product.id}`}>
      {product.imageUrl ? (
        <img src={product.imageUrl} alt={product.name} loading="lazy" />
      ) : (
        <div className={`produce-art produce-${(product.category || 'produce').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
          <span>{product.category || 'Fresh produce'}</span>
          <Leaf size={compact ? 24 : 32} strokeWidth={1.3} />
        </div>
      )}
      <span className="district-stamp"><MapPin size={12} />{product.district}</span>
    </div>
  );
}

function ProductCard({ product, onRequest }: { product: Product; onRequest?: () => void }) {
  return (
    <article className="product-card" data-testid={`card-product-${product.id}`}>
      <ProductVisual product={product} />
      <div className="product-card-body">
        <div className="product-eyebrow"><span>{product.category}</span><span className="availability"><i />Available</span></div>
        <h3>{product.name}</h3>
        <div className="product-grower"><span className="tiny-avatar">{initials(product.farmerName)}</span><span>{product.farmerName}</span></div>
        <div className="product-price-row">
          <div><strong>{money(product.pricePerKg)}</strong><span> / {product.unit || 'kg'}</span></div>
          <small>{number(product.quantityKg)} kg</small>
        </div>
        {onRequest && <button className="card-action" onClick={onRequest} data-testid={`button-request-${product.id}`}>Request produce <ArrowRight size={15} /></button>}
      </div>
    </article>
  );
}

function initials(name?: string | null) {
  return (name || 'Olima').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

function money(value: number) {
  return new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF', maximumFractionDigits: 0 }).format(value);
}

function number(value: number) {
  return new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(value);
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-RW', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

function HomeRedirect() {
  const { user, isLoading } = useSupabaseAuth();
  if (isLoading) return <PageLoading />;
  return user ? <SignedInDestination /> : <HomePage />;
}

function SignedInDestination() {
  const profile = useGetMyProfile();
  if (profile.isLoading) return <PageLoading />;
  if (profile.isError || !profile.data) return <Redirect to="/complete-profile" />;
  return <Redirect to={profile.data.role === 'farmer' ? '/farmer' : '/buyer'} />;
}

function HomePage() {
  const [chosenRole, setChosenRole] = useState<ProfileRole | null>(null);
  const summary = useGetMarketplaceSummary({
    query: { queryKey: getGetMarketplaceSummaryQueryKey(), staleTime: 60_000, refetchOnWindowFocus: true },
  });
  const [, setLocation] = useLocation();
  const enterSignup = (role: ProfileRole) => {
    sessionStorage.setItem('olima-selected-role', role);
    setLocation('/sign-up');
  };
  return (
    <div className="public-page grain">
      <header className="public-header">
        <div className="public-header-inner">
          <Brand />
          <nav className="public-nav" aria-label="Main navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#market">The marketplace</a>
          </nav>
          <div className="header-actions">
            <Link href="/sign-in" className="sign-in-link" data-testid="link-sign-in">Sign in</Link>
            <a href="#join" className="button button-primary small-cta" data-testid="link-get-started">Get started <ArrowRight size={15} /></a>
          </div>
        </div>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-copy reveal">
            <div className="eyebrow"><span className="eyebrow-line" />RWANDA’S HARVEST, BETTER CONNECTED</div>
            <h1>Good harvests<br />deserve <em>good markets.</em></h1>
            <p className="hero-intro">A simpler way for Rwanda’s farmers and produce buyers to find each other, agree a fair price, and move fresh produce with confidence.</p>
            <div className="hero-actions">
              <a href="#join" className="button button-primary" data-testid="link-join-marketplace">Join the marketplace <ArrowRight size={17} /></a>
              <a href="#how-it-works" className="text-link">See how it works <ArrowUpRight size={15} /></a>
            </div>
            <div className="hero-trust"><span className="community-mark"><Users size={15} /></span><span>Local growers. Real produce. Clear terms.</span></div>
          </div>
          <div className="hero-image-wrap reveal-late">
            <img className="hero-image" src="/market-morning.jpg" alt="Fresh produce set out at a Rwanda village market" />
            <div className="hero-image-caption"><span className="caption-mark"><Sprout size={18} /></span><div><strong>From hillside farms</strong><span>to buyers across Rwanda</span></div><span className="caption-arrow"><ArrowUpRight size={17} /></span></div>
            <span className="hero-image-index mono">01 / 04 — HARVEST SEASON</span>
            <div className="hero-side-note mono">FRESH FROM RWANDA</div>
          </div>
          <div className="hero-footnote"><span>01</span><span>Built around the way local markets already work.</span><span className="footnote-rule" /></div>
        </section>

        <section className="market-pulse" id="market">
          <div className="pulse-title"><span className="eyebrow">A MARKET WITH MOMENTUM</span><strong>Rooted here.<br />Ready to grow.</strong></div>
          {summary.isLoading ? (
            <div className="pulse-loading"><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /></div>
          ) : summary.isError ? (
            <div className="pulse-error"><span>Marketplace figures are taking a moment.</span><button onClick={() => summary.refetch()} data-testid="button-summary-retry">Try again</button></div>
          ) : (
            <div className="pulse-stats">
              <div><strong data-testid="text-summary-farmers">{number(summary.data?.farmers ?? 0)}</strong><span>farmers</span></div>
              <div><strong data-testid="text-summary-buyers">{number(summary.data?.buyers ?? 0)}</strong><span>buyers</span></div>
              <div><strong data-testid="text-summary-products">{number(summary.data?.products ?? 0)}</strong><span>produce listings</span></div>
              <div><strong data-testid="text-summary-districts">{number(summary.data?.districts ?? 0)}</strong><span>districts connected</span></div>
            </div>
          )}
        </section>

        <section className="featured-section">
          <div className="section-heading">
            <div><span className="eyebrow"><span className="eyebrow-line" />ON THE MARKET NOW</span><h2>Harvests worth<br />meeting.</h2></div>
            <p>See what growers are bringing to market today. Fresh, local produce with the details that make a good trade.</p>
          </div>
          {summary.isLoading ? <div className="featured-loading"><div className="skeleton-card" /><div className="skeleton-card" /><div className="skeleton-card" /></div> :
            summary.isError ? <QueryError onRetry={() => summary.refetch()} label="Featured produce is unavailable right now." /> :
            summary.data?.featured?.length ? (
              <div className="product-grid public-product-grid">
                {summary.data.featured.slice(0, 3).map((product) => <ProductCard key={product.id} product={product} onRequest={() => enterSignup('buyer')} />)}
              </div>
            ) : <EmptyState title="The first harvest is on its way." copy="New produce listings will show up here as local growers join." />}
          <div className="market-note"><span className="market-note-mark"><Wheat size={18} /></span><span>Every listing comes directly from the farmer who grew it.</span><span className="mono">NO MIDDLEMEN REQUIRED</span></div>
        </section>

        <section className="how-section" id="how-it-works">
          <div className="how-side"><span className="eyebrow"><span className="eyebrow-line" />A BETTER WAY TO TRADE</span><h2>Clear from<br />the first hello.</h2><p>Olima keeps the important things close: what’s available, where it grew, what it costs, and what happens next.</p><Link href="/sign-in" className="text-link">Already trading with us? Sign in <ArrowRight size={15} /></Link></div>
          <div className="how-steps">
            <article><span className="step-no mono">01</span><span className="step-icon"><ShoppingBasket size={21} /></span><h3>Put produce on the map</h3><p>Farmers share a clear listing with quantity, price, and district.</p></article>
            <article><span className="step-no mono">02</span><span className="step-icon"><Search size={21} /></span><h3>Find the right fit</h3><p>Buyers browse real available produce and send a direct request.</p></article>
            <article><span className="step-no mono">03</span><span className="step-icon"><HandCoins size={21} /></span><h3>Agree the trade</h3><p>Both sides see the terms and status of each request in one place.</p></article>
          </div>
        </section>

        <section className="join-section" id="join">
          <div className="join-art" aria-hidden="true"><div className="join-sun" /><div className="join-hill join-hill-back" /><div className="join-hill join-hill-front" /><div className="join-plant"><i /><i /><i /><b /></div><div className="join-art-label mono">RWANDA · 01°56′S</div></div>
          <div className="join-copy"><span className="eyebrow"><span className="eyebrow-line" />YOUR NEXT GOOD TRADE STARTS HERE</span><h2>Where will your<br /><em>harvest take you?</em></h2><p>Join the local marketplace built to make everyday produce trading feel a little more straightforward.</p>
            <div className="role-choice">
              <span className="role-label">I’m joining as a…</span>
              <div className="role-options">
                <button className={`role-option ${chosenRole === 'farmer' ? 'selected' : ''}`} onClick={() => setChosenRole('farmer')} data-testid="button-select-farmer"><Sprout size={18} /><span><strong>Farmer</strong><small>List my produce</small></span>{chosenRole === 'farmer' && <Check size={16} />}</button>
                <button className={`role-option ${chosenRole === 'buyer' ? 'selected' : ''}`} onClick={() => setChosenRole('buyer')} data-testid="button-select-buyer"><ShoppingBasket size={18} /><span><strong>Buyer</strong><small>Find local produce</small></span>{chosenRole === 'buyer' && <Check size={16} />}</button>
              </div>
              <Button onClick={() => chosenRole && enterSignup(chosenRole)} disabled={!chosenRole} className="join-submit" testId="button-create-account">Create my account <ArrowRight size={17} /></Button>
              <p className="role-signin">Already have an account? <Link href="/sign-in" data-testid="link-sign-in-footer">Sign in</Link></p>
            </div>
          </div>
        </section>
      </main>
      <footer className="public-footer">
        <Brand inverse />
        <span>Rwanda’s produce, moving together.</span>
        <div><Link href="/sign-in" data-testid="link-footer-signin">Sign in</Link><a href="#how-it-works">How it works</a></div>
        <small className="mono">© OLIMA AGROCONNECT</small>
      </footer>
    </div>
  );
}

function SignInPage() {
  return <AuthForm mode="sign-in" />;
}

function SignUpPage() {
  return <AuthForm mode="sign-up" />;
}

function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const { signIn, signUp } = useSupabaseAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const isSignUp = mode === 'sign-up';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      if (isSignUp) {
        const hasSession = await signUp(email.trim(), password);
        if (hasSession) {
          setLocation('/complete-profile');
          return;
        }
        setNotice({
          tone: 'success',
          text: 'Check your inbox for a confirmation link. After confirming, you can finish your marketplace profile.',
        });
      } else {
        await signIn(email.trim(), password);
        setLocation('/');
      }
    } catch {
      setNotice({
        tone: 'error',
        text: isSignUp
          ? 'We couldn’t create your account. Check your details or sign in if you already registered.'
          : 'We couldn’t sign you in with those details. Check your email and password and try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame mode={mode}>
      <section className="auth-form-panel">
        <div className="auth-form-heading">
          <span className="eyebrow"><span className="eyebrow-line" />{isSignUp ? 'JOIN THE MARKET' : 'WELCOME BACK'}</span>
          <h2>{isSignUp ? 'Create your account.' : 'Sign in to Olima.'}</h2>
          <p>{isSignUp ? 'Use your email to get started with local produce trading.' : 'Your marketplace is ready when you are.'}</p>
        </div>
        <NoticeBar notice={notice} onClose={() => setNotice(null)} />
        <form className="auth-form" onSubmit={submit}>
          <label className="auth-field">
            Email address
            <input
              type="email"
              required
              autoComplete="email"
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              data-testid="input-auth-email"
            />
          </label>
          <label className="auth-field">
            Password
            <input
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={isSignUp ? 'At least 8 characters' : 'Your password'}
              data-testid="input-auth-password"
            />
          </label>
          <Button type="submit" disabled={busy || !email.trim() || password.length < 8} className="auth-submit" testId="button-auth-submit">
            {busy ? (isSignUp ? 'Creating account…' : 'Signing in…') : (isSignUp ? 'Create my account' : 'Sign in')}
            <ArrowRight size={17} />
          </Button>
        </form>
        <p className="auth-form-switch">
          {isSignUp ? 'Already have an account?' : 'New to Olima?'}{' '}
          <Link href={isSignUp ? '/sign-in' : '/sign-up'} data-testid="link-auth-switch">
            {isSignUp ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </section>
    </AuthFrame>
  );
}

function AuthFrame({ mode, children }: { mode: 'sign-in' | 'sign-up'; children: ReactNode }) {
  return (
    <main className="auth-page grain">
      <div className="auth-side">
        <Brand inverse />
        <div className="auth-side-copy"><span className="eyebrow">A LOCAL MARKETPLACE, MADE PRACTICAL</span><h1>Good food<br />travels <em>far.</em></h1><p>Connect with Rwanda’s growers and buyers, one honest trade at a time.</p></div>
        <div className="auth-bottom mono">OLIMA AGROCONNECT · RWANDA</div>
      </div>
      <div className="auth-main">
        <div className="auth-mobile-brand"><Brand /></div>
        <div className="auth-card-wrap">{children}</div>
        <div className="auth-footer"><Link href="/" data-testid="link-auth-home">Back to marketplace</Link><span>Secure sign-in powered by Supabase</span></div>
      </div>
      <span className="auth-decoration"><Sprout size={62} strokeWidth={0.8} /></span>
      <span className="auth-mode mono">{mode === 'sign-in' ? 'WELCOME BACK' : 'JOIN THE MARKET'}</span>
    </main>
  );
}

function CompleteProfilePage() {
  const { user } = useSupabaseAuth();
  const profile = useGetMyProfile();
  const save = useSaveMyProfile();
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const metadataRole = user?.user_metadata?.role;
  const [role, setRole] = useState<ProfileRole>(() => {
    const saved = sessionStorage.getItem('olima-selected-role');
    if (saved === 'farmer' || saved === 'buyer') return saved;
    return metadataRole === 'buyer' ? 'buyer' : 'farmer';
  });
  const userFullName = typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '';
  const [fullName, setFullName] = useState(userFullName);
  const [phone, setPhone] = useState('');
  const [district, setDistrict] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  useEffect(() => {
    if (profile.data) {
      setRole(profile.data.role);
       setFullName(profile.data.fullName || userFullName);
      setPhone(profile.data.phone || '');
      setDistrict(profile.data.district || '');
    }
  }, [profile.data, userFullName]);
  useEffect(() => {
    if (profile.data) sessionStorage.removeItem('olima-selected-role');
  }, [profile.data]);
  if (profile.isLoading) return <PageLoading />;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    save.mutate({ data: { role, fullName: fullName.trim(), phone: phone.trim() || undefined, district: district.trim() || undefined } }, {
      onSuccess: (nextProfile) => {
        sessionStorage.removeItem('olima-selected-role');
        client.setQueryData(getGetMyProfileQueryKey(), nextProfile);
        void client.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
        setNotice({ tone: 'success', text: 'Your profile is ready. Welcome to the market.' });
        setLocation(nextProfile.role === 'farmer' ? '/farmer' : '/buyer');
      },
      onError: () => setNotice({ tone: 'error', text: 'We couldn’t save your profile. Check your connection and try again.' }),
    });
  };
  return (
    <main className="profile-page grain">
      <header className="profile-top"><Brand /><span className="mono">SETUP · 01 / 01</span></header>
      <section className="profile-card">
        <div className="profile-progress"><span /></div>
        <span className="eyebrow"><span className="eyebrow-line" />FIRST, A LITTLE ABOUT YOU</span>
        <h1>Let’s get your market<br />profile in order.</h1>
        <p>This helps the people you trade with know who they’re talking to.</p>
        <NoticeBar notice={notice} />
        {profile.isError && <div className="profile-existing-note">Your marketplace profile is not complete yet. Add a few details to continue.</div>}
        <form onSubmit={submit} className="profile-form">
          <label className="form-label">I’m here as a
            <div className="role-options role-options-form">
              {(['farmer', 'buyer'] as ProfileRole[]).map((choice) => (
                <button type="button" key={choice} onClick={() => setRole(choice)} className={`role-option ${role === choice ? 'selected' : ''}`} data-testid={`button-role-${choice}`}>
                  {choice === 'farmer' ? <Sprout size={18} /> : <ShoppingBasket size={18} />}
                  <span><strong>{choice === 'farmer' ? 'Farmer' : 'Buyer'}</strong><small>{choice === 'farmer' ? 'I grow produce' : 'I source produce'}</small></span>
                  {role === choice && <Check size={16} />}
                </button>
              ))}
            </div>
          </label>
          <label className="form-label">Full name<input required minLength={2} maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your name" data-testid="input-full-name" /></label>
          <div className="form-two">
            <label className="form-label">Phone number <span className="optional">Optional</span><input maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+250 7xx xxx xxx" data-testid="input-phone" /></label>
            <label className="form-label">District <span className="optional">Optional</span><input maxLength={80} value={district} onChange={(event) => setDistrict(event.target.value)} placeholder="e.g. Musanze" data-testid="input-district" /></label>
          </div>
          <Button type="submit" disabled={save.isPending || fullName.trim().length < 2} className="profile-submit" testId="button-save-profile">{save.isPending ? 'Saving your details…' : 'Continue to my marketplace'} <ArrowRight size={17} /></Button>
        </form>
        <div className="profile-private"><span><Check size={14} /></span>Your profile details help make local trading more reliable.</div>
      </section>
      <footer className="profile-foot mono">OLIMA AGROCONNECT · RWANDA</footer>
    </main>
  );
}

function ProtectedRoute({ role, children }: { role: ProfileRole; children: (profile: Profile) => ReactNode }) {
  const { user, isLoading } = useSupabaseAuth();
  if (isLoading) return <PageLoading />;
  if (!user) return <Redirect to="/sign-in" />;
  return <RoleWorkspace role={role}>{children}</RoleWorkspace>;
}

function RoleWorkspace({ role, children }: { role: ProfileRole; children: (profile: Profile) => ReactNode }) {
  const profile = useGetMyProfile();
  if (profile.isLoading) return <PageLoading />;
  if (profile.isError || !profile.data) return <Redirect to="/complete-profile" />;
  if (profile.data.role !== role) return <Redirect to={profile.data.role === 'farmer' ? '/farmer' : '/buyer'} />;
  return <WorkspaceShell profile={profile.data}>{children(profile.data)}</WorkspaceShell>;
}

function WorkspaceShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  const { signOut } = useSupabaseAuth();
  const [location, setLocation] = useLocation();
  const [mobileMenu, setMobileMenu] = useState(false);
  const isFarmer = profile.role === 'farmer';
  const dashboardHref = isFarmer ? '/farmer' : '/buyer';
  const handleSignOut = async () => {
    try {
      await signOut();
      setLocation('/');
    } catch {
      setLocation('/sign-in');
    }
  };
  const navItems = [
    { href: dashboardHref, label: 'Overview', icon: <Package size={17} /> },
    { href: `${dashboardHref}?view=${isFarmer ? 'requests' : 'sent'}`, label: isFarmer ? 'Buyer requests' : 'My requests', icon: <HandCoins size={17} /> },
  ];
  return (
    <div className="workspace grain">
      <aside className={`workspace-sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="workspace-brand"><Brand inverse /><button className="mobile-close" onClick={() => setMobileMenu(false)} aria-label="Close menu" data-testid="button-close-menu"><X size={20} /></button></div>
        <div className="workspace-context"><span className="workspace-context-icon">{isFarmer ? <Sprout size={17} /> : <ShoppingBasket size={17} />}</span><div><small>YOUR MARKET</small><strong>{isFarmer ? 'Farmer space' : 'Buyer space'}</strong></div></div>
        <div className="workspace-nav-label">WORKSPACE</div>
        <nav className="workspace-nav">
          {navItems.map((item) => <Link key={item.href} href={item.href} className={`workspace-nav-item ${location === item.href.split('?')[0] && (item.label === 'Overview' || location.includes('requests')) ? 'active' : ''}`} onClick={() => setMobileMenu(false)} data-testid={`link-nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}>{item.icon}<span>{item.label}</span>{item.label !== 'Overview' && <ArrowUpRight size={14} className="nav-go" />}</Link>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="market-live"><span className="live-dot" /><span><strong>Marketplace live</strong><small>Listings update as they change</small></span></div>
          <button className="workspace-user" onClick={() => void handleSignOut()} data-testid="button-sign-out">
            <span className="user-avatar">{initials(profile.fullName)}</span><span className="user-details"><strong>{profile.fullName}</strong><small>{profile.district || 'Rwanda'}</small></span><LogOut size={16} />
          </button>
        </div>
      </aside>
      {mobileMenu && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileMenu(false)} data-testid="button-close-navigation" />}
      <main className="workspace-main">
        <header className="workspace-topbar">
          <button className="menu-trigger" onClick={() => setMobileMenu(true)} aria-label="Open navigation" data-testid="button-open-menu"><Menu size={19} /></button>
          <div className="breadcrumb"><span>OLIMA</span><i>/</i><strong>{isFarmer ? 'Farmer space' : 'Buyer space'}</strong></div>
          <div className="topbar-right"><span className="topbar-location"><MapPin size={14} />{profile.district || 'Rwanda'}</span><span className="user-avatar top-avatar">{initials(profile.fullName)}</span></div>
        </header>
        <div className="workspace-content">{children}</div>
      </main>
    </div>
  );
}

function FarmerDashboard({ profile }: { profile: Profile }) {
  const client = useQueryClient();
  const products = useListMyProducts({ query: { queryKey: getListMyProductsQueryKey(), refetchOnWindowFocus: true } });
  const incoming = useListIncomingRequests({ query: { queryKey: getListIncomingRequestsQueryKey(), refetchOnWindowFocus: true } });
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const remove = useDeleteProduct();
  const updateStatus = useUpdateRequestStatus();
  const [productDialog, setProductDialog] = useState<Product | 'new' | null>(null);
  const [activeView, setActiveView] = useState<'overview' | 'requests'>(window.location.search.includes('requests') ? 'requests' : 'overview');
  const [notice, setNotice] = useState<Notice>(null);
  const [dialogNotice, setDialogNotice] = useState<Notice>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [location] = useLocation();
  useEffect(() => {
    setActiveView(window.location.search.includes('requests') ? 'requests' : 'overview');
  }, [location]);
  const pendingCount = incoming.data?.filter((item) => item.status === 'pending').length ?? 0;
  const refreshProducts = () => Promise.all([
    client.invalidateQueries({ queryKey: getListMyProductsQueryKey() }),
    client.invalidateQueries({ queryKey: getListProductsQueryKey() }),
    client.invalidateQueries({ queryKey: getGetMarketplaceSummaryQueryKey() }),
  ]);
  const handleStatus = (id: number, status: 'accepted' | 'declined') => {
    setBusyId(id);
    setNotice(null);
    updateStatus.mutate({ id, data: { status } }, {
      onSuccess: () => {
        setNotice({ tone: 'success', text: status === 'accepted' ? 'Request accepted. The buyer has been updated.' : 'Request declined. The buyer has been updated.' });
        void Promise.all([
          client.invalidateQueries({ queryKey: getListIncomingRequestsQueryKey() }),
          client.invalidateQueries({ queryKey: getListMyRequestsQueryKey() }),
        ]);
      },
      onError: () => setNotice({ tone: 'error', text: 'That request could not be updated. Please try again.' }),
      onSettled: () => setBusyId(null),
    });
  };
  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div><span className="eyebrow"><span className="eyebrow-line" />YOUR FARM, YOUR MARKET</span><h1>Muraho, {profile.fullName.split(' ')[0]}.</h1><p>Here’s what’s happening with your produce today.</p></div>
        <Button onClick={() => { setProductDialog('new'); setNotice(null); setDialogNotice(null); }} testId="button-add-product"><Plus size={17} /> Add a listing</Button>
      </div>
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />
      <div className="dashboard-tabs">
        <button onClick={() => setActiveView('overview')} className={activeView === 'overview' ? 'selected' : ''} data-testid="tab-my-listings"><Package size={16} /> My listings <span>{products.data?.length ?? 0}</span></button>
        <button onClick={() => setActiveView('requests')} className={activeView === 'requests' ? 'selected' : ''} data-testid="tab-buyer-requests"><HandCoins size={16} /> Buyer requests {pendingCount > 0 && <span className="tab-pending">{pendingCount}</span>}</button>
      </div>
      {activeView === 'overview' ? (
        <>
          <div className="stat-strip">
            <div className="stat-panel"><span className="stat-icon stat-green"><Wheat size={19} /></span><span className="stat-label">Active listings</span><strong data-testid="text-active-listings">{products.data?.filter((p) => p.available).length ?? '—'}</strong><small>Available to buyers</small></div>
            <div className="stat-panel"><span className="stat-icon stat-ochre"><Clock3 size={19} /></span><span className="stat-label">Waiting on you</span><strong data-testid="text-pending-requests">{pendingCount}</strong><small>Requests to review</small></div>
            <div className="stat-panel"><span className="stat-icon stat-terracotta"><HandCoins size={19} /></span><span className="stat-label">Accepted trades</span><strong data-testid="text-accepted-requests">{incoming.data?.filter((r) => r.status === 'accepted').length ?? '—'}</strong><small>From your produce</small></div>
          </div>
          <section className="dashboard-section">
          <div className="dashboard-section-heading"><div><span className="eyebrow">YOUR PRODUCE</span><h2>My listings <span className="count-chip">{products.data?.length ?? 0}</span></h2></div><button className="text-link" onClick={() => { setProductDialog('new'); setDialogNotice(null); }} data-testid="button-add-another">Add another <Plus size={15} /></button></div>
            {products.isLoading ? <div className="listing-skeleton"><span className="skeleton" /><span className="skeleton" /></div> :
              products.isError ? <QueryError onRetry={() => products.refetch()} label="Your listings could not be loaded." /> :
              products.data?.length ? <div className="farmer-listings">{products.data.map((product) => <FarmerProductRow key={product.id} product={product} onEdit={() => setProductDialog(product)} onToggle={() => update.mutate({ id: product.id, data: { available: !product.available } }, { onSuccess: () => { setNotice({ tone: 'success', text: `${product.name} is ${product.available ? 'paused' : 'available'} to buyers.` }); void refreshProducts(); }, onError: () => setNotice({ tone: 'error', text: 'Your listing could not be updated.' }) })} onDelete={() => {
                if (!window.confirm(`Remove ${product.name} from your listings?`)) return;
                remove.mutate({ id: product.id }, { onSuccess: () => { setNotice({ tone: 'success', text: `${product.name} has been removed.` }); void refreshProducts(); }, onError: () => setNotice({ tone: 'error', text: 'This listing could not be removed.' }) });
              }} />)}</div> :
              <EmptyState title="Your first listing starts here." copy="Add the produce you’re ready to sell, with a price and how much you have." action={<Button onClick={() => { setProductDialog('new'); setDialogNotice(null); }}><Plus size={16} /> Add a listing</Button>} />}
          </section>
          <section className="dashboard-section">
            <div className="dashboard-section-heading"><div><span className="eyebrow">INCOMING</span><h2>Recent buyer requests</h2></div><button className="text-link" onClick={() => setActiveView('requests')} data-testid="button-view-requests">View all <ArrowRight size={15} /></button></div>
            {incoming.isLoading ? <LoadingBlock label="Loading buyer requests" /> : incoming.isError ? <QueryError onRetry={() => incoming.refetch()} label="Buyer requests could not be loaded." /> :
              incoming.data?.length ? <div className="request-list">{incoming.data.slice(0, 3).map((request) => <RequestRow key={request.id} request={request} busy={busyId === request.id} onAccept={() => handleStatus(request.id, 'accepted')} onDecline={() => handleStatus(request.id, 'declined')} />)}</div> :
              <EmptyState title="No buyer requests yet." copy="When a buyer requests your produce, you’ll find the details here." />}
          </section>
        </>
      ) : (
        <section className="dashboard-section requests-view">
          <div className="dashboard-section-heading"><div><span className="eyebrow">INCOMING</span><h2>Buyer requests</h2><p>Review each request and choose what works for your farm.</p></div></div>
          {incoming.isLoading ? <LoadingBlock label="Loading incoming buyer requests" /> : incoming.isError ? <QueryError onRetry={() => incoming.refetch()} label="Buyer requests could not be loaded." /> :
            incoming.data?.length ? <div className="request-list">{incoming.data.map((request) => <RequestRow key={request.id} request={request} busy={busyId === request.id} onAccept={() => handleStatus(request.id, 'accepted')} onDecline={() => handleStatus(request.id, 'declined')} />)}</div> :
            <EmptyState title="Your inbox is clear." copy="New requests from interested buyers will appear here." />}
        </section>
      )}
      {productDialog && <ProductDialog product={productDialog === 'new' ? undefined : productDialog} farmerDistrict={profile.district || ''} busy={create.isPending || update.isPending} error={dialogNotice} onClose={() => setProductDialog(null)} onSubmit={(data) => {
        setDialogNotice(null);
        const onSuccess = (saved: Product) => {
          setProductDialog(null);
          setNotice({ tone: 'success', text: productDialog === 'new' ? `${saved.name} is now listed for buyers.` : `${saved.name} listing updated.` });
          void refreshProducts();
        };
        if (productDialog === 'new') create.mutate({ data }, { onSuccess, onError: () => setDialogNotice({ tone: 'error', text: 'Your listing could not be saved. Check the details and try again.' }) });
        else update.mutate({ id: productDialog.id, data }, { onSuccess, onError: () => setDialogNotice({ tone: 'error', text: 'Your changes could not be saved. Please try again.' }) });
      }} />}
    </div>
  );
}

function FarmerProductRow({ product, onEdit, onToggle, onDelete }: { product: Product; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  return (
    <article className="farmer-product-row" data-testid={`row-my-product-${product.id}`}>
      <ProductVisual product={product} compact />
      <div className="farmer-product-info"><span className={`status-label ${product.available ? 'status-available' : 'status-paused'}`}><i />{product.available ? 'Available' : 'Paused'}</span><h3>{product.name}</h3><p>{product.category} <span>·</span> {product.district}</p></div>
      <div className="farmer-product-amount"><strong>{money(product.pricePerKg)}</strong><small>per kg</small></div>
      <div className="farmer-product-amount"><strong>{number(product.quantityKg)} kg</strong><small>in stock</small></div>
      <div className="row-actions"><button onClick={onToggle} aria-label={product.available ? 'Pause listing' : 'Make listing available'} data-testid={`button-toggle-product-${product.id}`}>{product.available ? 'Pause' : 'Make available'}</button><button onClick={onEdit} aria-label={`Edit ${product.name}`} data-testid={`button-edit-product-${product.id}`}><Pencil size={15} /></button><button onClick={onDelete} aria-label={`Delete ${product.name}`} data-testid={`button-delete-product-${product.id}`}><Trash2 size={15} /></button></div>
    </article>
  );
}

function ProductDialog({ product, farmerDistrict, busy, error, onClose, onSubmit }: { product?: Product; farmerDistrict: string; busy: boolean; error: Notice; onClose: () => void; onSubmit: (data: ProductInput) => void }) {
  const [name, setName] = useState(product?.name || '');
  const [category, setCategory] = useState(product?.category || '');
  const [description, setDescription] = useState(product?.description || '');
  const [price, setPrice] = useState(product?.pricePerKg?.toString() || '');
  const [quantity, setQuantity] = useState(product?.quantityKg?.toString() || '');
  const [district, setDistrict] = useState(product?.district || farmerDistrict);
  const [unit, setUnit] = useState(product?.unit || 'kg');
  const [imageUrl, setImageUrl] = useState(product?.imageUrl || '');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit({ name: name.trim(), category: category.trim(), description: description.trim(), pricePerKg: Number(price), quantityKg: Number(quantity), district: district.trim(), unit: unit.trim() || 'kg', ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}) });
  };
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="dialog product-dialog" role="dialog" aria-modal="true" aria-labelledby="product-dialog-title">
        <div className="dialog-head"><div><span className="eyebrow">{product ? 'MAKE IT CURRENT' : 'BRING IT TO MARKET'}</span><h2 id="product-dialog-title">{product ? 'Edit your listing' : 'Add a produce listing'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close dialog" data-testid="button-close-product-dialog"><X size={19} /></button></div>
        <p className="dialog-intro">Clear details help buyers know if your harvest is the right fit.</p>
        <NoticeBar notice={error} />
        <form onSubmit={submit} className="dialog-form">
          <label className="form-label">Produce name<input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fresh market tomatoes" data-testid="input-product-name" /></label>
          <div className="form-two">
            <label className="form-label">Category<input required minLength={2} maxLength={80} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Vegetables" data-testid="input-product-category" /></label>
            <label className="form-label">District<input required minLength={2} maxLength={80} value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="District" data-testid="input-product-district" /></label>
          </div>
          <label className="form-label">Description <span className="optional">Optional</span><textarea maxLength={1200} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell buyers about your harvest…" data-testid="input-product-description" /></label>
          <div className="form-three">
            <label className="form-label">Price per kg<input required type="number" min="1" step="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="RWF" data-testid="input-product-price" /></label>
            <label className="form-label">Quantity (kg)<input required type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" data-testid="input-product-quantity" /></label>
            <label className="form-label">Unit<input maxLength={30} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg" data-testid="input-product-unit" /></label>
          </div>
          <label className="form-label">Photo URL <span className="optional">Optional</span><input type="url" maxLength={500} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" data-testid="input-product-image" /></label>
          <div className="dialog-actions"><Button kind="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || name.trim().length < 2 || category.trim().length < 2 || district.trim().length < 2 || Number(price) <= 0 || Number(quantity) < 1} testId="button-save-product">{busy ? 'Saving…' : product ? 'Save changes' : 'Publish listing'} <ArrowRight size={16} /></Button></div>
        </form>
      </section>
    </div>
  );
}

function RequestRow({ request, busy, onAccept, onDecline }: { request: { id: number; buyerName: string; productName: string; quantityKg: number; pricePerKg: number; message: string; status: string; createdAt: string }; busy: boolean; onAccept: () => void; onDecline: () => void }) {
  return (
    <article className="request-row" data-testid={`row-request-${request.id}`}>
      <span className="request-avatar">{initials(request.buyerName)}</span>
      <div className="request-main"><div className="request-heading"><strong>{request.buyerName}</strong><span className={`request-status status-${request.status}`} data-testid={`status-request-${request.id}`}><i />{request.status}</span></div><p>Interested in <b>{request.productName}</b></p>{request.message && <blockquote>“{request.message}”</blockquote>}<small>{dateLabel(request.createdAt)}</small></div>
      <div className="request-details"><strong>{number(request.quantityKg)} kg</strong><small>{money(request.pricePerKg)} / kg</small><span className="request-total">{money(request.quantityKg * request.pricePerKg)} total</span></div>
      {request.status === 'pending' && <div className="request-actions"><Button disabled={busy} onClick={onAccept} testId={`button-accept-request-${request.id}`}>{busy ? 'Saving…' : 'Accept'}</Button><Button kind="outline" disabled={busy} onClick={onDecline} testId={`button-decline-request-${request.id}`}>Decline</Button></div>}
    </article>
  );
}

function BuyerDashboard({ profile }: { profile: Profile }) {
  const client = useQueryClient();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [district, setDistrict] = useState('');
  const [activeView, setActiveView] = useState<'browse' | 'sent'>(window.location.search.includes('sent') ? 'sent' : 'browse');
  const [requestProduct, setRequestProduct] = useState<Product | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [dialogNotice, setDialogNotice] = useState<Notice>(null);
  const [location] = useLocation();
  useEffect(() => {
    setActiveView(window.location.search.includes('sent') ? 'sent' : 'browse');
  }, [location]);
  const params = useMemo(() => ({
    ...(query.trim() ? { q: query.trim() } : {}),
    ...(category ? { category } : {}),
    ...(district ? { district } : {}),
  }), [query, category, district]);
  const products = useListProducts(params, { query: { queryKey: getListProductsQueryKey(params), refetchOnWindowFocus: true } });
  const requests = useListMyRequests({ query: { queryKey: getListMyRequestsQueryKey(), refetchOnWindowFocus: true } });
  const create = useCreateRequest();
  const pendingCount = requests.data?.filter((item) => item.status === 'pending').length ?? 0;
  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div><span className="eyebrow"><span className="eyebrow-line" />RWANDA’S FRESH PRODUCE MARKET</span><h1>Muraho, {profile.fullName.split(' ')[0]}.</h1><p>Find the right harvest for your business.</p></div>
        <div className="buyer-market-badge"><span className="live-dot" />LOCAL PRODUCE, AVAILABLE NOW</div>
      </div>
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />
      <div className="dashboard-tabs">
        <button onClick={() => setActiveView('browse')} className={activeView === 'browse' ? 'selected' : ''} data-testid="tab-browse"><Search size={16} /> Browse produce</button>
        <button onClick={() => setActiveView('sent')} className={activeView === 'sent' ? 'selected' : ''} data-testid="tab-sent-requests"><HandCoins size={16} /> My requests {pendingCount > 0 && <span className="tab-pending">{pendingCount}</span>}</button>
      </div>
      {activeView === 'browse' ? (
        <>
          <div className="buyer-intro"><div><h2>Find something <em>fresh.</em></h2><p>Real produce from growers in your part of Rwanda.</p></div><span className="buyer-intro-icon"><ShoppingBasket size={24} /></span></div>
          <div className="search-panel">
            <label className="search-input-wrap"><Search size={18} /><input type="search" placeholder="Search produce or farmer…" value={query} onChange={(e) => setQuery(e.target.value)} data-testid="input-search-products" /><span className="search-key mono">FIND</span></label>
            <label className="filter-wrap"><Filter size={16} /><select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category" data-testid="select-category"><option value="">All categories</option>{unique(products.data?.map((item) => item.category) ?? []).map((item) => <option key={item} value={item}>{item}</option>)}</select><ChevronDown size={14} /></label>
            <label className="filter-wrap"><MapPin size={16} /><select value={district} onChange={(e) => setDistrict(e.target.value)} aria-label="Filter by district" data-testid="select-district"><option value="">All districts</option>{unique(products.data?.map((item) => item.district) ?? []).map((item) => <option key={item} value={item}>{item}</option>)}</select><ChevronDown size={14} /></label>
            {(query || category || district) && <button className="clear-filters" onClick={() => { setQuery(''); setCategory(''); setDistrict(''); }} data-testid="button-clear-filters"><X size={14} /> Clear</button>}
          </div>
          <div className="browse-heading"><span>{products.isLoading ? 'Looking across the market…' : `${products.data?.length ?? 0} ${products.data?.length === 1 ? 'listing' : 'listings'} to explore`}</span><span className="browse-fresh"><span className="live-dot" /> Market updates live</span></div>
          {products.isLoading ? <div className="product-grid"><div className="skeleton-card" /><div className="skeleton-card" /><div className="skeleton-card" /></div> :
            products.isError ? <QueryError onRetry={() => products.refetch()} label="We could not load produce listings." /> :
            products.data?.length ? <div className="product-grid buyer-product-grid">{products.data.map((product) => <ProductCard key={product.id} product={product} onRequest={() => { setRequestProduct(product); setNotice(null); setDialogNotice(null); }} />)}</div> :
            <EmptyState title={query || category || district ? 'No matches this time.' : 'The market is quiet for now.'} copy={query || category || district ? 'Try a different search or clear the filters to see what is available.' : 'Check back soon as local growers add new listings.'} action={(query || category || district) ? <Button kind="outline" onClick={() => { setQuery(''); setCategory(''); setDistrict(''); }}>Clear filters</Button> : undefined} />}
        </>
      ) : (
        <section className="dashboard-section buyer-requests">
          <div className="dashboard-section-heading"><div><span className="eyebrow">YOUR ACTIVITY</span><h2>Requests you’ve sent</h2><p>Keep track of the conversations you’ve started with growers.</p></div></div>
          {requests.isLoading ? <LoadingBlock label="Loading your sent requests" /> : requests.isError ? <QueryError onRetry={() => requests.refetch()} label="Your requests could not be loaded." /> :
            requests.data?.length ? <div className="sent-request-list">{requests.data.map((request) => <SentRequestCard key={request.id} request={request} />)}</div> :
            <EmptyState title="No requests sent yet." copy="When a listing catches your eye, send the farmer a request from its card." action={<Button onClick={() => setActiveView('browse')}><Search size={16} /> Browse produce</Button>} />}
        </section>
      )}
      {requestProduct && <RequestDialog product={requestProduct} busy={create.isPending} error={dialogNotice} onClose={() => setRequestProduct(null)} onSubmit={(quantityKg, message) => {
        setDialogNotice(null);
        create.mutate({ data: { productId: requestProduct.id, quantityKg, message: message.trim() || undefined } }, {
          onSuccess: () => {
            setRequestProduct(null);
            setNotice({ tone: 'success', text: `Your request for ${requestProduct.name} has been sent to the farmer.` });
            void Promise.all([
              client.invalidateQueries({ queryKey: getListMyRequestsQueryKey() }),
              client.invalidateQueries({ queryKey: getListProductsQueryKey() }),
              client.invalidateQueries({ queryKey: getListIncomingRequestsQueryKey() }),
              client.invalidateQueries({ queryKey: getGetMarketplaceSummaryQueryKey() }),
            ]);
          },
          onError: () => setDialogNotice({ tone: 'error', text: 'Your request could not be sent. Please check your connection and try again.' }),
        });
      }} />}
    </div>
  );
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function SentRequestCard({ request }: { request: { id: number; productName: string; farmerName: string; quantityKg: number; pricePerKg: number; message: string; status: string; createdAt: string } }) {
  return (
    <article className="sent-request-card" data-testid={`card-sent-request-${request.id}`}>
      <span className="sent-request-icon"><Wheat size={20} /></span>
      <div className="sent-request-info"><span className={`request-status status-${request.status}`} data-testid={`status-sent-request-${request.id}`}><i />{request.status}</span><h3>{request.productName}</h3><p>From {request.farmerName} <span>·</span> {dateLabel(request.createdAt)}</p>{request.message && <blockquote>“{request.message}”</blockquote>}</div>
      <div className="sent-request-total"><strong>{number(request.quantityKg)} kg</strong><span>{money(request.pricePerKg)} / kg</span><b>{money(request.quantityKg * request.pricePerKg)}</b></div>
    </article>
  );
}

function RequestDialog({ product, busy, error, onClose, onSubmit }: { product: Product; busy: boolean; error: Notice; onClose: () => void; onSubmit: (quantity: number, message: string) => void }) {
  const [quantity, setQuantity] = useState('1');
  const [message, setMessage] = useState('');
  const amount = Number(quantity);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (amount > 0 && amount <= product.quantityKg) onSubmit(amount, message);
  };
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="dialog request-dialog" role="dialog" aria-modal="true" aria-labelledby="request-dialog-title">
        <div className="dialog-head"><div><span className="eyebrow">A DIRECT NOTE TO THE FARMER</span><h2 id="request-dialog-title">Request this produce</h2></div><button className="icon-button" onClick={onClose} aria-label="Close dialog" data-testid="button-close-request-dialog"><X size={19} /></button></div>
        <NoticeBar notice={error} />
        <div className="request-product-summary"><ProductVisual product={product} compact /><div><strong>{product.name}</strong><span>{product.farmerName} · {product.district}</span><b>{money(product.pricePerKg)} / {product.unit || 'kg'}</b></div></div>
        <form onSubmit={submit} className="dialog-form">
          <label className="form-label">How much would you like? <span className="form-hint">Up to {number(product.quantityKg)} kg available</span><div className="quantity-input"><input type="number" min="1" max={product.quantityKg} step="1" required value={quantity} onChange={(e) => setQuantity(e.target.value)} data-testid="input-request-quantity" /><span>kg</span></div></label>
          <div className="request-estimate"><span>Estimated total</span><strong>{money((Number.isFinite(amount) ? amount : 0) * product.pricePerKg)}</strong></div>
          <label className="form-label">Message for the farmer <span className="optional">Optional</span><textarea rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Share any details that will help plan this trade…" data-testid="input-request-message" /></label>
          <div className="dialog-actions"><Button kind="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || amount < 1 || amount > product.quantityKg} testId="button-send-request">{busy ? 'Sending…' : 'Send request'} <ArrowRight size={16} /></Button></div>
        </form>
      </section>
    </div>
  );
}

function PageLoading() {
  return <main className="page-loading"><Brand /><LoadingBlock label="Loading your marketplace" /></main>;
}

function AuthenticatedOnly({ children }: { children: ReactNode }) {
  const { user, isLoading } = useSupabaseAuth();
  if (isLoading) return <PageLoading />;
  return user ? <>{children}</> : <Redirect to="/sign-in" />;
}

function AuthRoutes() {
  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseAuthProvider>
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/complete-profile">
            <AuthenticatedOnly><CompleteProfilePage /></AuthenticatedOnly>
          </Route>
          <Route path="/farmer"><ProtectedRoute role="farmer">{(profile) => <FarmerDashboard profile={profile} />}</ProtectedRoute></Route>
          <Route path="/buyer"><ProtectedRoute role="buyer">{(profile) => <BuyerDashboard profile={profile} />}</ProtectedRoute></Route>
          <Route component={NotFound} />
        </Switch>
      </SupabaseAuthProvider>
    </QueryClientProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <AuthRoutes />
    </WouterRouter>
  );
}

export default App;