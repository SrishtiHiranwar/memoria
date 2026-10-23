import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

type Role = 'DOCTOR' | 'PATIENT';
type User = { id: string; email: string; role: Role; patientId: string | null };
type Photo = { id: string; imageUrl: string; caption: string; createdAt: string };
type Scene = {
  photoId: string;
  narration: string;
  recallQuestion: string;
  expectedAnswer: string;
  answerOptions: string[];
};
type Story = {
  id: string;
  patientId: string;
  createdAt: string;
  title: string;
  prompt: string;
  status: 'DRAFT' | 'APPROVED' | 'ASSIGNED' | 'COMPLETED';
  scenes: Scene[];
  approvedAt: string | null;
  assignedAt: string | null;
};
type Patient = {
  id: string;
  name: string;
  user: { email: string } | null;
  photos: Photo[];
  stories: Story[];
};
type Alert = {
  id: string;
  patientId: string;
  createdAt: string;
  acknowledgedAt: string | null;
  patient: { id: string; name: string };
};
type SessionRow = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  patient: { id: string; name: string };
  story: { id: string; title: string };
};
type ApiOptions = Omit<RequestInit, 'body'> & { body?: BodyInit | null };

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const TOKEN_KEY = 'memoria-token';
const USER_KEY = 'memoria-user';
const FALLBACK_MESSAGE = 'Your caregiver has been told. Please wait here, or ask someone nearby.';

async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error('Cannot reach the Memoria server. Check that it is running and try again.');
  }
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? 'The request could not be completed.');
  return payload as T;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function PhotoImage({ photo, alt, className }: { photo: Photo; alt: string; className?: string }) {
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (photo.imageUrl.startsWith('/placeholders/')) {
      setSrc(photo.imageUrl);
      setFailed(false);
      return;
    }

    const controller = new AbortController();
    let objectUrl = '';
    setSrc('');
    setFailed(false);
    fetch(`${API_URL}${photo.imageUrl}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) ?? ''}` },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('Photo unavailable');
        return response.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo.id, photo.imageUrl]);

  if (failed) return <span className={`photo-unavailable ${className ?? ''}`}>Photo unavailable</span>;
  return <img className={className} src={src} alt={alt} />;
}

function App() {
  const [user, setUser] = useState<User | null>(() => {
    const cached = localStorage.getItem(USER_KEY);
    return cached ? JSON.parse(cached) as User : null;
  });
  const [booting, setBooting] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    api<{ user: User }>('/auth/me')
      .then(({ user: current }) => {
        setUser(current);
        localStorage.setItem(USER_KEY, JSON.stringify(current));
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
      })
      .finally(() => setBooting(false));
  }, []);

  function signOut() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }

  if (booting) return <div className="loading-screen">Opening Memoria…</div>;
  if (!user) return <Login onSignedIn={(nextUser) => setUser(nextUser)} />;
  if (user.role === 'DOCTOR') return <DoctorDashboard user={user} onSignOut={signOut} />;
  return <PatientExperience onSignOut={signOut} />;
}

function Login({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const [email, setEmail] = useState('doctor@demo.local');
  const [password, setPassword] = useState('demo-doctor');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await api<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem(TOKEN_KEY, result.token);
      localStorage.setItem(USER_KEY, JSON.stringify(result.user));
      onSignedIn(result.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <BrandMark />
        <p className="eyebrow">A story, shared gently</p>
        <h1>Welcome to Memoria</h1>
        <p className="muted">Sign in as a doctor or on the patient’s device with the patient login.</p>
        <form onSubmit={submit} className="stack-form">
          <label>
            Email
            <input autoComplete="username" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Password
            <input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {error && <p className="inline-error" role="alert">{error}</p>}
          <button className="button button-primary button-wide" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="demo-access">
          <span className="muted">Fictional demo accounts</span>
          <div>
            <button className="text-button" onClick={() => { setEmail('doctor@demo.local'); setPassword('demo-doctor'); }}>Doctor</button>
            <button className="text-button" onClick={() => { setEmail('patient@demo.local'); setPassword('demo-patient'); }}>Patient</button>
          </div>
        </div>
        <p className="safety-note">Prototype only · Use fictional data · Not medical advice or care</p>
      </section>
    </main>
  );
}

function BrandMark() {
  return <div className="brand-mark" aria-hidden="true"><span>m</span></div>;
}

function DoctorDashboard({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [section, setSection] = useState<'patients' | 'alerts' | 'sessions'>('patients');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId) ?? patients[0];

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [patientData, alertData, sessionData] = await Promise.all([
        api<{ patients: Patient[] }>('/patients'),
        api<{ alerts: Alert[] }>('/alerts'),
        api<{ sessions: SessionRow[] }>('/sessions'),
      ]);
      setPatients(patientData.patients);
      setAlerts(alertData.alerts);
      setSessions(sessionData.sessions);
      setSelectedPatientId((current) => current || patientData.patients[0]?.id || '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load your dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load, refresh]);

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 4000);
  }

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><BrandMark /><span>Memoria</span></div>
        <p className="sidebar-caption">DOCTOR WORKSPACE</p>
        <nav className="sidebar-nav" aria-label="Doctor dashboard">
          <button className={section === 'patients' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('patients')}>
            <span aria-hidden="true">◉</span> Patients <span className="nav-count">{patients.length}</span>
          </button>
          <button className={section === 'alerts' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('alerts')}>
            <span aria-hidden="true">♢</span> Alerts <span className="nav-count">{alerts.filter((alert) => !alert.acknowledgedAt).length}</span>
          </button>
          <button className={section === 'sessions' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('sessions')}>
            <span aria-hidden="true">◷</span> Sessions
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="signed-in"><span className="avatar">{user.email.slice(0, 1).toUpperCase()}</span><span><b>Doctor</b><small>{user.email}</small></span></div>
          <button className="nav-item signout" onClick={onSignOut}>Sign out</button>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Doctor dashboard</p>
            <h1>{section === 'patients' ? 'Your patients' : section === 'alerts' ? 'Caregiver alerts' : 'Story sessions'}</h1>
          </div>
          <div className="topbar-actions">
            <span className="prototype-badge">FICTIONAL DEMO</span>
            <button className="button button-quiet" onClick={() => setRefresh((value) => value + 1)}>Refresh</button>
          </div>
        </header>
        {notice && <div className="toast" role="status">{notice}</div>}
        {error && <div className="banner-error" role="alert">{error}</div>}
        {loading ? <div className="loading-card">Loading your workspace…</div> : (
          <>
            {section === 'patients' && (
              <DoctorPatients
                patients={patients}
                selectedPatient={selectedPatient}
                onSelectPatient={setSelectedPatientId}
                onRefresh={() => setRefresh((value) => value + 1)}
                onNotice={flash}
              />
            )}
            {section === 'alerts' && <DoctorAlerts alerts={alerts} onRefresh={() => setRefresh((value) => value + 1)} onNotice={flash} />}
            {section === 'sessions' && <DoctorSessions sessions={sessions} />}
          </>
        )}
        <section className="coming-card">
          <div className="coming-icon" aria-hidden="true">✦</div>
          <div><p className="eyebrow">Coming soon</p><h2>3D and VR experiences</h2><p>Doctor-approved immersive scenes are planned for a future update.</p></div>
          <span className="coming-pill">NOT AVAILABLE YET</span>
        </section>
        <footer className="dashboard-footer">Memoria is a support prototype, not a medical device. All sample data is fictional.</footer>
      </main>
    </div>
  );
}

function DoctorPatients({
  patients,
  selectedPatient,
  onSelectPatient,
  onRefresh,
  onNotice,
}: {
  patients: Patient[];
  selectedPatient: Patient | undefined;
  onSelectPatient: (id: string) => void;
  onRefresh: () => void;
  onNotice: (message: string) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  return (
    <div className="patient-layout">
      <section className="patient-list-card">
        <div className="card-title-row"><div><p className="eyebrow">Your care team</p><h2>Patients <span className="subtle-count">{patients.length}</span></h2></div>
          <button className="icon-button" aria-label="Add patient" onClick={() => setShowCreate((show) => !show)}>＋</button></div>
        {showCreate && <CreatePatient onCreated={(id) => { setShowCreate(false); onSelectPatient(id); onRefresh(); onNotice('Patient login created. Share credentials securely.'); }} />}
        {patients.length === 0 ? <div className="empty-state"><span>◉</span><p>No patient profiles yet.</p><button className="button button-secondary" onClick={() => setShowCreate(true)}>Add your first patient</button></div> :
          <div className="patient-list">{patients.map((patient) => (
            <button key={patient.id} className={selectedPatient?.id === patient.id ? 'patient-list-item selected' : 'patient-list-item'} onClick={() => onSelectPatient(patient.id)}>
              <span className="patient-avatar">{patient.name.trim().slice(0, 1).toUpperCase()}</span>
              <span className="patient-list-copy"><b>{patient.name}</b><small>{patient.photos.length} photos · {patient.stories.length} stories</small></span>
              <span className="chevron">›</span>
            </button>
          ))}</div>
        }
      </section>
      {selectedPatient ? <PatientDetail patient={selectedPatient} patients={patients} onRefresh={onRefresh} onNotice={onNotice} /> :
        <div className="welcome-card"><div className="welcome-art">M</div><h2>Start with a patient</h2><p>Create a patient profile to add photos and draft a story.</p><button className="button button-primary" onClick={() => setShowCreate(true)}>＋ Add patient</button></div>}
    </div>
  );
}

function CreatePatient({ onCreated }: { onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const response = await api<{ patient: { id: string } }>('/patients', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      onCreated(response.patient.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create the patient.');
    } finally { setBusy(false); }
  }

  return <form className="create-patient-form" onSubmit={submit}>
    <h3>New patient login</h3>
    <label>Display name<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} /></label>
    <label>Login email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
    <label>Temporary password<input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
    <p className="help-text">Share login credentials directly with the patient or caregiver.</p>
    {error && <p className="inline-error">{error}</p>}
    <button className="button button-primary" disabled={busy}>{busy ? 'Creating…' : 'Create login'}</button>
  </form>;
}

function PatientDetail({
  patient,
  patients,
  onRefresh,
  onNotice,
}: {
  patient: Patient;
  patients: Patient[];
  onRefresh: () => void;
  onNotice: (message: string) => void;
}) {
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [storyError, setStoryError] = useState('');

  async function uploadPhoto(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setUploadError('');
    setUploading(true);
    const form = new FormData();
    form.set('photo', file);
    form.set('caption', caption);
    try {
      await api(`/patients/${patient.id}/photos`, { method: 'POST', body: form });
      setFile(null);
      setCaption('');
      (document.getElementById('photo-file') as HTMLInputElement | null)?.value && ((document.getElementById('photo-file') as HTMLInputElement).value = '');
      onRefresh();
      onNotice('Photo added to this patient’s approved collection.');
    } catch (reason) {
      setUploadError(reason instanceof Error ? reason.message : 'Could not upload this photo.');
    } finally { setUploading(false); }
  }

  async function generate(event: FormEvent) {
    event.preventDefault();
    setStoryError('');
    setGenerating(true);
    try {
      await api(`/patients/${patient.id}/stories/generate`, { method: 'POST', body: JSON.stringify({ prompt }) });
      setPrompt('');
      onRefresh();
      onNotice('Draft created. Review each scene before approving.');
    } catch (reason) {
      setStoryError(reason instanceof Error ? reason.message : 'Could not draft a story.');
    } finally { setGenerating(false); }
  }

  return (
    <section className="patient-detail">
      <div className="patient-heading-card">
        <div className="patient-heading-avatar">{patient.name.trim().slice(0, 1).toUpperCase()}</div>
        <div className="patient-heading-copy"><p className="eyebrow">Patient profile</p><h2>{patient.name}</h2><p>{patient.user?.email ?? 'Login not linked'}</p></div>
        <div className="patient-stats"><div><strong>{patient.photos.length}</strong><span>Photos</span></div><div><strong>{patient.stories.length}</strong><span>Stories</span></div></div>
      </div>

      <section className="content-card">
        <div className="section-heading"><div><p className="eyebrow">Approved content</p><h2>Photo collection</h2></div><span className="count-pill">{patient.photos.length}</span></div>
        <form onSubmit={uploadPhoto} className="upload-form">
          <label className="upload-picker" htmlFor="photo-file"><span className="upload-symbol">＋</span><span><b>{file ? file.name : 'Choose a photo'}</b><small>JPEG, PNG, WebP, GIF · up to 5 MB</small></span><input id="photo-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
          <label className="caption-input">Photo caption<input value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Describe only what is visible…" required maxLength={500} /></label>
          {uploadError && <p className="inline-error full-width">{uploadError}</p>}
          <button className="button button-secondary" disabled={!file || uploading}>{uploading ? 'Uploading…' : 'Add photo'}</button>
        </form>
        {patient.photos.length === 0 ? <p className="muted empty-inline">Add a few photos before drafting a story.</p> :
          <div className="photo-grid">{patient.photos.map((photo) => <figure className="photo-tile" key={photo.id}><PhotoImage photo={photo} alt={photo.caption} /><figcaption>{photo.caption}</figcaption></figure>)}</div>}
      </section>

      <section className="content-card">
        <div className="section-heading"><div><p className="eyebrow">Doctor-reviewed stories</p><h2>Stories <span className="subtle-count">{patient.stories.length}</span></h2></div></div>
        {patient.photos.length > 0 && <form onSubmit={generate} className="story-prompt-form">
          <label htmlFor="story-prompt">Story idea</label>
          <textarea id="story-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="A calm story about noticing familiar things in these photos…" minLength={5} maxLength={2000} required rows={3} />
          <p className="help-text">Gemini receives this prompt and photo captions only. Do not include names or personal details.</p>
          {storyError && <p className="inline-error">{storyError}</p>}
          <button className="button button-primary" disabled={generating}>{generating ? 'Drafting story…' : '✦ Draft story with AI'}</button>
        </form>}
        {patient.stories.length === 0 ? <p className="muted empty-inline">No stories yet. Start with a short prompt above.</p> :
          <div className="story-list">{patient.stories.map((story) => <StoryEditor key={story.id} story={story} patient={patient} patients={patients} onRefresh={onRefresh} onNotice={onNotice} />)}</div>}
      </section>
    </section>
  );
}

function StoryEditor({
  story,
  patient,
  patients,
  onRefresh,
  onNotice,
}: {
  story: Story;
  patient: Patient;
  patients: Patient[];
  onRefresh: () => void;
  onNotice: (message: string) => void;
}) {
  const [expanded, setExpanded] = useState(story.status === 'DRAFT');
  const [title, setTitle] = useState(story.title);
  const [prompt, setPrompt] = useState(story.prompt);
  const [scenes, setScenes] = useState<Scene[]>(story.scenes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(story.patientId);

  useEffect(() => {
    setTitle(story.title);
    setPrompt(story.prompt);
    setScenes(story.scenes);
    setSelectedPatient(story.patientId);
  }, [story]);

  function updateScene(index: number, field: keyof Scene, value: string) {
    setScenes((current) => current.map((scene, sceneIndex) => {
      if (sceneIndex !== index) return scene;
      if (field === 'answerOptions') return { ...scene, answerOptions: value.split('\n').map((option) => option.trim()).filter(Boolean) };
      return { ...scene, [field]: value };
    }));
  }

  async function action(path: string, bodyValue?: unknown, success?: string) {
    setBusy(true);
    setError('');
    try {
      await api(path, { method: 'POST', ...(bodyValue ? { body: JSON.stringify(bodyValue) } : {}) });
      onNotice(success ?? 'Story updated.');
      onRefresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The story could not be updated.');
    } finally { setBusy(false); }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/stories/${story.id}`, { method: 'PATCH', body: JSON.stringify({ title, prompt, scenes }) });
      onNotice('Draft changes saved.');
      onRefresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The story could not be saved.');
    } finally { setBusy(false); }
  }

  const editable = story.status === 'DRAFT';

  return (
    <article className="story-card">
      <button className="story-summary" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <span className="story-summary-icon">▤</span>
        <span className="story-summary-copy"><b>{story.title}</b><small>{story.scenes.length} scenes · Created {formatDate(story.createdAt)}</small>{story.status === 'DRAFT' && <span className="draft-review-label">AI-generated · for doctor review</span>}</span>
        <span className={`status-badge status-${story.status.toLowerCase()}`}>{story.status}</span>
        <span className="chevron">{expanded ? '⌄' : '›'}</span>
      </button>
      {expanded && <div className="story-editor">
        {story.status === 'DRAFT' && <div className="ai-review-label">✦ AI-generated, for doctor review</div>}
        {editable ? <form onSubmit={save} className="editor-form">
          <label>Story title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required /></label>
          <label>Original prompt<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={2} maxLength={2000} required /></label>
          {scenes.map((scene, index) => {
            const photo = patient.photos.find((item) => item.id === scene.photoId);
            return <div className="scene-editor" key={`${scene.photoId}-${index}`}>
              <div className="scene-editor-heading"><span>SCENE {index + 1}</span>{photo && <PhotoImage photo={photo} alt="" />}</div>
              <label>Narration<textarea value={scene.narration} onChange={(event) => updateScene(index, 'narration', event.target.value)} rows={2} maxLength={600} required /></label>
              <label>Recall question<input value={scene.recallQuestion} onChange={(event) => updateScene(index, 'recallQuestion', event.target.value)} maxLength={240} required /></label>
              <label>Expected answer<input value={scene.expectedAnswer} onChange={(event) => updateScene(index, 'expectedAnswer', event.target.value)} maxLength={200} required /></label>
              <label>Answer options <small>One option per line; include the expected answer.</small><textarea value={scene.answerOptions.join('\n')} onChange={(event) => updateScene(index, 'answerOptions', event.target.value)} rows={3} required /></label>
            </div>;
          })}
          {error && <p className="inline-error">{error}</p>}
          <div className="editor-actions"><button className="button button-secondary" disabled={busy}>Save changes</button><button type="button" className="button button-primary" disabled={busy} onClick={() => void action(`/stories/${story.id}/approve`, {}, 'Story approved. It can now be assigned.')}>Approve story</button></div>
        </form> : <div className="scene-readonly-list">{story.scenes.map((scene, index) => <div className="scene-readonly" key={`${scene.photoId}-${index}`}><b>Scene {index + 1}</b><p>{scene.narration}</p><small>{scene.recallQuestion}</small></div>)}
          {error && <p className="inline-error">{error}</p>}
          {(story.status === 'APPROVED' || story.status === 'ASSIGNED') && <div className="editor-actions">
            <label className="assign-select">Assign to <select value={selectedPatient} disabled={story.status !== 'APPROVED' || busy} onChange={(event) => setSelectedPatient(event.target.value)}>{patients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <button className="button button-primary" disabled={story.status !== 'APPROVED' || busy} onClick={() => void action(`/stories/${story.id}/assign`, { patientId: selectedPatient }, 'Story assigned to the patient login.')}>Assign story</button>
            <button className="button button-quiet" disabled={busy} onClick={() => void action(`/stories/${story.id}/reset`, {}, 'Story returned to draft so it can be edited.')}>Reset to draft</button>
          </div>}
        </div>}
      </div>}
    </article>
  );
}

function DoctorAlerts({ alerts, onRefresh, onNotice }: { alerts: Alert[]; onRefresh: () => void; onNotice: (message: string) => void }) {
  const [error, setError] = useState('');
  async function acknowledge(id: string) {
    setError('');
    try {
      await api(`/alerts/${id}/acknowledge`, { method: 'POST', body: JSON.stringify({}) });
      onRefresh();
      onNotice('Alert acknowledged.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not acknowledge this alert.'); }
  }
  return <section className="content-card full-card">
    <div className="section-heading"><div><p className="eyebrow">Human follow-up</p><h2>Alerts from patients</h2></div><span className="count-pill">{alerts.filter((alert) => !alert.acknowledgedAt).length} open</span></div>
    {error && <p className="inline-error">{error}</p>}
    {alerts.length === 0 ? <div className="empty-state"><span>♢</span><p>No caregiver alerts. Patient requests for help appear here.</p></div> :
      <div className="alert-list">{alerts.map((alert) => <article className="alert-row" key={alert.id}>
        <span className={alert.acknowledgedAt ? 'alert-dot done' : 'alert-dot'} />
        <div className="alert-copy"><b>{alert.patient.name} asked for their caregiver</b><small>{formatDate(alert.createdAt)}{alert.acknowledgedAt ? ` · Acknowledged ${formatDate(alert.acknowledgedAt)}` : ' · Waiting for acknowledgement'}</small></div>
        {!alert.acknowledgedAt && <button className="button button-secondary" onClick={() => void acknowledge(alert.id)}>Acknowledge</button>}
      </article>)}</div>}
  </section>;
}

function DoctorSessions({ sessions }: { sessions: SessionRow[] }) {
  const [selectedSession, setSelectedSession] = useState('');
  const [summary, setSummary] = useState<{ label: string; summary: { summary: string; concerns: string[]; doctorReviewNote: string } } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function openSummary(id: string) {
    setSelectedSession(id);
    setSummary(null);
    setError('');
    setBusy(true);
    try {
      const result = await api<{ ai_generated: boolean; label: string; summary: { summary: string; concerns: string[]; doctorReviewNote: string } }>(`/sessions/${id}/summary`);
      setSummary(result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load this summary.'); }
    finally { setBusy(false); }
  }
  return <div className="sessions-layout">
    <section className="content-card session-card">
      <div className="section-heading"><div><p className="eyebrow">Patient activity</p><h2>Sessions</h2></div><span className="count-pill">{sessions.length}</span></div>
      {sessions.length === 0 ? <div className="empty-state"><span>◷</span><p>Completed story sessions will appear here.</p></div> :
        <div className="session-list">{sessions.map((session) => <button className={selectedSession === session.id ? 'session-row selected' : 'session-row'} key={session.id} onClick={() => void openSummary(session.id)}>
          <span className="session-row-icon">◷</span><span><b>{session.patient.name}</b><small>{session.story.title} · {formatDate(session.startedAt)}</small></span><span className="chevron">›</span>
        </button>)}</div>}
    </section>
    <section className="content-card summary-card">
      <p className="eyebrow">Session summary</p>
      {!selectedSession ? <div className="summary-empty"><span>✦</span><p>Select a session to see its summary.</p></div> :
        busy ? <p className="muted">Loading session summary…</p> :
          error ? <p className="inline-error">{error}</p> :
            summary ? <><div className="ai-review-label">✦ {summary.label}</div><p className="summary-text">{summary.summary.summary}</p>
              {summary.summary.concerns.length > 0 && <div className="concerns"><b>For doctor review</b><ul>{summary.summary.concerns.map((concern) => <li key={concern}>{concern}</li>)}</ul></div>}
              <p className="help-text">{summary.summary.doctorReviewNote}</p></> : null}
    </section>
  </div>;
}

type ActiveGame = { story: Story; sessionId: string };

function PatientExperience({ onSignOut }: { onSignOut: () => void }) {
  const [stories, setStories] = useState<Story[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [checkedCaregiver, setCheckedCaregiver] = useState(false);
  const [activeGame, setActiveGame] = useState<ActiveGame | null>(null);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [questionVisible, setQuestionVisible] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeAlertId, setActiveAlertId] = useState('');
  const [alertAcknowledged, setAlertAcknowledged] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [finished, setFinished] = useState(false);

  const loadAssigned = useCallback(async () => {
    try {
      const [storyData, photoData] = await Promise.all([
        api<{ stories: Story[] }>('/me/stories'),
        api<{ photos: Photo[] }>('/me/photos'),
      ]);
      setStories(storyData.stories);
      setPhotos(photoData.photos);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load your stories.');
    }
  }, []);

  useEffect(() => { void loadAssigned(); }, [loadAssigned]);

  useEffect(() => {
    if (!activeAlertId) return;
    let mounted = true;
    const check = async () => {
      try {
        const result = await api<{ alert: Alert; showFallback: boolean }>(`/me/alerts/${activeAlertId}`);
        if (mounted) {
          setAlertAcknowledged(Boolean(result.alert.acknowledgedAt));
          setShowFallback(result.showFallback);
        }
      } catch {
        if (mounted) setNotice('The alert status could not be checked. Please wait here.');
      }
    };
    void check();
    const interval = window.setInterval(() => void check(), 5000);
    return () => { mounted = false; window.clearInterval(interval); };
  }, [activeAlertId]);

  const activeScene = activeGame?.story.scenes[sceneIndex];
  const activePhoto = useMemo(() => photos.find((photo) => photo.id === activeScene?.photoId), [photos, activeScene]);

  function speakNarration(text: string) {
    if (!('speechSynthesis' in window)) {
      setNotice('Voice playback is not available in this browser. You can read the story text on screen.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.86;
    window.speechSynthesis.speak(utterance);
  }

  async function startStory(story: Story) {
    setBusy(true);
    setError('');
    try {
      const result = await api<{ session: { id: string } }>('/sessions', {
        method: 'POST',
        body: JSON.stringify({ storyId: story.id, caregiverPresent: checkedCaregiver }),
      });
      setActiveGame({ story, sessionId: result.session.id });
      setSceneIndex(0);
      setQuestionVisible(false);
      setAnswers({});
      setSelectedAnswer('');
      setFinished(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not start the story.');
    } finally { setBusy(false); }
  }

  function answerQuestion(answer: string) {
    setSelectedAnswer(answer);
    if (activeGame) setAnswers((current) => ({ ...current, [sceneIndex]: answer }));
  }

  async function continueStory() {
    if (!activeGame) return;
    if (!questionVisible) {
      setQuestionVisible(true);
      return;
    }
    if (!selectedAnswer) return;
    if (sceneIndex < activeGame.story.scenes.length - 1) {
      setSceneIndex((value) => value + 1);
      setQuestionVisible(false);
      setSelectedAnswer('');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api(`/sessions/${activeGame.sessionId}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          answers: Object.entries({ ...answers, [sceneIndex]: selectedAnswer }).map(([index, selected]) => ({
            sceneIndex: Number(index),
            selectedAnswer: selected,
          })),
        }),
      });
      setActiveGame(null);
      setFinished(true);
      setCheckedCaregiver(false);
      void loadAssigned();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save this session.');
    } finally { setBusy(false); }
  }

  async function callCaregiver() {
    setError('');
    try {
      const result = await api<{ alert: Alert }>('/alerts', { method: 'POST', body: JSON.stringify({}) });
      setActiveAlertId(result.alert.id);
      setAlertAcknowledged(false);
      setShowFallback(false);
      setNotice('An alert has been sent. Please wait here.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The caregiver alert could not be sent.');
    }
  }

  function leaveStory() {
    window.speechSynthesis?.cancel();
    setActiveGame(null);
    setError('');
  }

  return (
    <main className="patient-mode">
      <header className="patient-header">
        <div className="sidebar-brand"><BrandMark /><span>Memoria</span></div>
        <button className="patient-signout" onClick={onSignOut}>Sign out</button>
      </header>
      <section className="patient-content">
        <p className="patient-eyebrow">TODAY, AT YOUR PACE</p>
        {activeGame && activeScene ? (
          <div className="game-card">
            <div className="game-topline"><button className="patient-back" onClick={leaveStory}>← Back to stories</button><span>Story {sceneIndex + 1} of {activeGame.story.scenes.length}</span></div>
            {activePhoto && <PhotoImage photo={activePhoto} className="game-photo" alt={activePhoto.caption} />}
            <h1 className="game-title">{activeGame.story.title}</h1>
            {!questionVisible ? <div className="narration-panel"><p>{activeScene.narration}</p><button className="button patient-play" onClick={() => speakNarration(activeScene.narration)}>▶ Listen to the story</button><button className="button button-primary patient-next" onClick={() => setQuestionVisible(true)}>Continue</button></div> :
              <div className="question-panel"><p className="question-label">A little question</p><h2>{activeScene.recallQuestion}</h2><div className="answer-options">{activeScene.answerOptions.map((option) => <button className={selectedAnswer === option ? 'answer-button chosen' : 'answer-button'} key={option} onClick={() => answerQuestion(option)}>{option}</button>)}</div><button className="button button-primary patient-next" disabled={!selectedAnswer || busy} onClick={() => void continueStory()}>{busy ? 'Saving…' : sceneIndex === activeGame.story.scenes.length - 1 ? 'Finish story' : 'Next scene'}</button></div>}
          </div>
        ) : finished ? (
          <div className="patient-welcome"><div className="welcome-art">♡</div><h1>Thank you for sharing a story.</h1><p>You can take a quiet moment before choosing another.</p><button className="button button-primary patient-next" onClick={() => setFinished(false)}>See my stories</button></div>
        ) : (
          <div className="patient-welcome">
            <div className="welcome-art">M</div>
            <h1>Hello. What would you like to explore?</h1>
            <p>Choose a story to look at together.</p>
            <label className="caregiver-confirm"><input type="checkbox" checked={checkedCaregiver} onChange={(event) => setCheckedCaregiver(event.target.checked)} /><span><b>My caregiver is here with me.</b><small>Please ask your caregiver to stay with you during the story.</small></span></label>
            {stories.length === 0 ? <div className="no-stories"><p>There are no stories ready yet.</p><small>Your doctor will add a story for you.</small></div> :
              <div className="patient-story-list">{stories.map((story) => <article className="patient-story-card" key={story.id}>
                <span className="patient-story-art">✦</span><span className="patient-story-info"><b>{story.title}</b><small>{story.scenes.length} gentle {story.scenes.length === 1 ? 'scene' : 'scenes'}</small></span>
                <button className="button button-primary" disabled={!checkedCaregiver || busy} onClick={() => void startStory(story)}>Start story</button>
              </article>)}</div>}
          </div>
        )}
        {error && <p className="patient-notice patient-error" role="alert">{error}</p>}
        {notice && <p className="patient-notice" role="status">{notice}</p>}
        {activeAlertId && <div className={alertAcknowledged ? 'alert-status acknowledged' : 'alert-status'} role="status">
          <span className="alert-status-icon">{alertAcknowledged ? '✓' : '•'}</span>
            <p>{alertAcknowledged ? 'Your caregiver has seen your request.' : showFallback ? FALLBACK_MESSAGE : 'Your request was sent. Please wait here.'}</p>
        </div>}
      </section>
      <button className="call-caregiver" disabled={Boolean(activeAlertId && !alertAcknowledged)} onClick={() => void callCaregiver()}><span aria-hidden="true">♡</span><span>{activeAlertId && !alertAcknowledged ? 'Caregiver called' : 'Call my caregiver'}</span></button>
    </main>
  );
}

export default App;
