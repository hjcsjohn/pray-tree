"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabaseBrowser, supabaseReady } from "../lib/supabase";

type Teacher = { id: string; full_name: string; role: "admin" | "teacher" };
type Student = { id: string; teacher_id: string; full_name: string; grade: string; emoji: string };
type Prayer = { id: string; student_id: string; title: string; body: string; created_at: string; status: string };
type ResponseRow = { id: string; prayer_id: string; body: string; response_date: string; created_at: string };
type PrayerDay = { id: string; student_id: string; prayer_date: string };

const dateToday = () => new Date().toLocaleDateString("en-CA");
const treeFor = (prayers: number, responses: number) => responses >= 3 ? "🍎🌳" : prayers >= 5 ? "🌸" : prayers >= 3 ? "🌳" : prayers >= 1 ? "🌱" : "🌰";

export default function Home() {
  const ready = supabaseReady();
  const [client] = useState(() => ready ? supabaseBrowser() : null);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Teacher | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [days, setDays] = useState<PrayerDay[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [tab, setTab] = useState<"prayers"|"responses"|"days">("prayers");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [grade, setGrade] = useState("초등 3학년");
  const [prayerTitle, setPrayerTitle] = useState("");
  const [prayerBody, setPrayerBody] = useState("");
  const [responsePrayer, setResponsePrayer] = useState("");
  const [responseBody, setResponseBody] = useState("");
  const [responseDate, setResponseDate] = useState(dateToday());

  async function loadAll(userId?: string) {
    if (!client) return;
    const { data: p, error: pe } = await client.from("profiles").select("id,full_name,role").order("full_name");
    if (pe) { setMessage(pe.message); return; }
    const profileRows = (p || []) as Teacher[];
    setTeachers(profileRows);
    const me = profileRows.find(x => x.id === userId) || null;
    setProfile(me);
    const [{ data: ss, error: se }, { data: pp, error: pre }, { data: rr, error: re }, { data: dd, error: de }] = await Promise.all([
      client.from("students").select("*").order("full_name"),
      client.from("prayer_requests").select("*").order("created_at", { ascending: false }),
      client.from("prayer_responses").select("*").order("response_date", { ascending: false }),
      client.from("prayer_days").select("*").order("prayer_date", { ascending: false })
    ]);
    const err = se || pre || re || de;
    if (err) { setMessage(err.message); return; }
    setStudents((ss || []) as Student[]);
    setPrayers((pp || []) as Prayer[]);
    setResponses((rr || []) as ResponseRow[]);
    setDays((dd || []) as PrayerDay[]);
    if (me?.role === "admin") setSelectedTeacher(current => current || profileRows.find(x => x.role === "teacher")?.id || me.id);
    else if (me) setSelectedTeacher(me.id);
  }

  useEffect(() => {
    if (!client) return;
    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadAll(data.session.user.id);
    });
    const { data: listener } = client.auth.onAuthStateChange((event, next) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      setSession(next);
      if (next?.user) setTimeout(() => loadAll(next.user.id), 0);
      else { setProfile(null); setTeachers([]); setStudents([]); setPrayers([]); setResponses([]); setDays([]); }
    });
    // Supabase may process the recovery URL before React subscribes to PASSWORD_RECOVERY.
    // Detect the recovery marker in the URL as a fallback so the password form still appears.
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const queryParams = new URLSearchParams(window.location.search);
    if (hashParams.get("type") === "recovery" || queryParams.get("type") === "recovery" || queryParams.get("reset") === "1") {
      setRecoveryMode(true);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const restoreSession = async () => {
        if (accessToken && refreshToken) {
          const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) {
            setMessage("인증 링크를 확인할 수 없습니다. 새 비밀번호 재설정 이메일을 요청해 주세요.");
            return;
          }
          // Remove sensitive tokens from the address bar after a successful exchange.
          window.history.replaceState({}, "", window.location.pathname + "?reset=1");
        }
        const { data } = await client.auth.getSession();
        if (!data.session) setMessage("인증 세션이 없습니다. 새 비밀번호 재설정 이메일을 요청해 주세요.");
      };
      void restoreSession();
    }
    return () => listener.subscription.unsubscribe();
  }, [client]);

  const visibleStudents = useMemo(() => students.filter(s => profile?.role === "admin" ? s.teacher_id === selectedTeacher : s.teacher_id === profile?.id), [students, profile, selectedTeacher]);
  const student = students.find(s => s.id === selectedStudent);
  const studentPrayers = prayers.filter(p => p.student_id === selectedStudent);
  const studentResponses = responses.filter(r => studentPrayers.some(p => p.id === r.prayer_id));
  const studentDays = days.filter(d => d.student_id === selectedStudent);
  const totalResponses = responses.length;

  async function signIn(e: FormEvent) {
    e.preventDefault(); if (!client) return;
    setBusy(true); setMessage("");
    const { error } = await client.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    setBusy(false); setMessage(error ? error.message : "로그인되었습니다.");
  }
  async function requestPasswordReset(e: FormEvent) {
    e.preventDefault();
    if (!client) return;
    setBusy(true); setMessage("");
    const { error } = await client.auth.resetPasswordForEmail(loginEmail.trim(), {
      redirectTo: window.location.origin,
    });
    setBusy(false);
    setMessage(error ? error.message : "비밀번호 재설정 링크를 이메일로 보냈습니다. 메일함과 스팸함을 확인해 주세요.");
  }
  async function saveNewPassword(e: FormEvent) {
    e.preventDefault();
    if (!client) return;
    const { data: currentAuth } = await client.auth.getSession();
    if (!currentAuth.session) { setMessage("인증 세션이 없습니다. 새 재설정 링크를 요청해 주세요."); return; }
    if (newPassword.length < 8) { setMessage("비밀번호는 8자 이상 입력해 주세요."); return; }
    if (newPassword !== confirmPassword) { setMessage("새 비밀번호가 서로 일치하지 않습니다."); return; }
    setBusy(true); setMessage("");
    const { error } = await client.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    setRecoveryMode(false); setNewPassword(""); setConfirmPassword("");
    setMessage("비밀번호가 변경되었습니다. 기존 계정으로 계속 이용하실 수 있습니다.");
  }
  async function signOut() { if (client) await client.auth.signOut(); setSelectedStudent(""); setMessage("로그아웃되었습니다."); }
  async function createTeacher(e: FormEvent) {
    e.preventDefault(); if (!client || profile?.role !== "admin") return;
    setBusy(true); setMessage("");
    // Admin-created accounts must be provisioned by Supabase Auth invitation or an Edge Function.
    // Never place a service-role key in this browser app.
    const { data, error } = await client.auth.signUp({ email: inviteEmail, password: invitePassword, options: { data: { full_name: inviteName, role: "teacher" } } });
    setBusy(false);
    if (error) setMessage(error.message);
    else { setMessage(data.session ? "계정이 생성되었습니다. 이메일 인증 설정을 확인해 주세요." : "가입 요청이 전송되었습니다. 이메일 인증 후 관리자에게 계정 등록을 요청하세요."); setShowInvite(false); }
  }
  async function addStudent(e: FormEvent) {
    e.preventDefault(); if (!client || !profile) return;
    const teacherId = profile.role === "admin" ? selectedTeacher : profile.id;
    if (!teacherId) { setMessage("담당 교사를 선택해 주세요."); return; }
    setBusy(true);
    const { error } = await client.from("students").insert({ full_name: studentName.trim(), grade, teacher_id: teacherId });
    setBusy(false); if (error) setMessage(error.message); else { setStudentName(""); setMessage("학생을 추가했습니다."); await loadAll(session.user.id); }
  }
  async function addPrayer(e: FormEvent) {
    e.preventDefault(); if (!client || !selectedStudent) return;
    setBusy(true);
    const { error } = await client.from("prayer_requests").insert({ student_id: selectedStudent, title: prayerTitle.trim(), body: prayerBody.trim(), created_by: session.user.id });
    setBusy(false); if (error) setMessage(error.message); else { setPrayerTitle(""); setPrayerBody(""); setMessage("기도제목을 기록했습니다. 🌿"); await loadAll(session.user.id); }
  }
  async function addResponse(e: FormEvent) {
    e.preventDefault(); if (!client || !responsePrayer) return;
    setBusy(true);
    const { error } = await client.from("prayer_responses").insert({ prayer_id: responsePrayer, body: responseBody.trim(), response_date: responseDate, created_by: session.user.id });
    setBusy(false); if (error) setMessage(error.message); else { setResponseBody(""); setMessage("감사의 열매를 기록했습니다. 🌸"); await loadAll(session.user.id); }
  }
  async function logDay() {
    if (!client || !selectedStudent) return;
    setBusy(true);
    const { error } = await client.from("prayer_days").upsert({ student_id: selectedStudent, prayer_date: dateToday(), created_by: session.user.id }, { onConflict: "student_id,prayer_date" });
    setBusy(false); setMessage(error ? error.message : "오늘의 기도를 기록했어요. ⭐"); await loadAll(session.user.id);
  }
  async function togglePrayer(p: Prayer) {
    if (!client) return;
    const { error } = await client.from("prayer_requests").update({ status: p.status === "응답 완료" ? "진행 중" : "응답 완료" }).eq("id", p.id);
    setMessage(error ? error.message : "상태를 변경했습니다."); await loadAll(session.user.id);
  }
  async function deletePrayer(id: string) {
    if (!client || !confirm("이 기도제목을 삭제할까요? 연결된 응답도 삭제됩니다.")) return;
    const { error } = await client.from("prayer_requests").delete().eq("id", id);
    setMessage(error ? error.message : "삭제했습니다."); await loadAll(session.user.id);
  }

  if (!ready) return <main className="setup"><div className="brandmark">🌳</div><h1>기도나무를 연결해 주세요</h1><p>실제 로그인과 온라인 저장 기능을 사용하려면 Supabase 프로젝트 설정이 필요합니다.</p><ol><li>Supabase 프로젝트를 만들고 <code>supabase/schema.sql</code>을 SQL Editor에서 실행하세요.</li><li><code>.env.local</code> 파일에 프로젝트 URL과 anon/publishable key를 입력하세요.</li><li>관리자 계정은 SQL 안내에 따라 역할을 부여하세요.</li></ol><p>설정 안내는 ZIP 안의 README.md에 있습니다.</p></main>;

  if (recoveryMode) return <main className="login-wrap"><div className="login-card"><div className="brandmark">🌳</div><h1>새 비밀번호 설정</h1><p className="muted">새 비밀번호를 입력해 주세요.</p><form onSubmit={saveNewPassword}><label>새 비밀번호<input type="password" required minLength={8} autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="8자 이상"/></label><label>새 비밀번호 확인<input type="password" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="비밀번호 다시 입력"/></label><button className="primary" disabled={busy}>{busy?"변경 중…":"비밀번호 변경"}</button></form>{message && <p className="notice" role="status">{message}</p>}</div></main>;

  if (!session) return <main className="login-wrap"><div className="login-card"><div className="brandmark">🌳</div><h1>기도나무</h1><p className="muted">우리의 기도가 열매 맺어요</p><form onSubmit={signIn}><label>이메일<input type="email" required value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="teacher@church.org"/></label><label>비밀번호<input type="password" required value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} placeholder="비밀번호"/></label><button className="primary" disabled={busy}>{busy?"확인 중…":"로그인"}</button></form><form onSubmit={requestPasswordReset} className="mini-form"><button type="submit" className="outline full" disabled={busy || !loginEmail.trim()}>비밀번호를 잊으셨나요? 재설정 이메일 받기</button><p className="fine">위 이메일 칸에 계정 이메일을 먼저 입력해 주세요.</p></form>{message && <p className="notice" role="status">{message}</p>}<p className="fine">교회 관리자에게 계정 발급을 요청해 주세요.</p></div></main>;

  return <main className="app-shell">
    <header className="app-header"><div className="brandline"><div className="brandmark smallmark">🌳</div><div><h1>기도나무</h1><p>우리의 기도가 열매 맺어요</p></div></div><div className="header-right"><span className="user-pill">{profile?.role==="admin"?"🛡️ 관리자":"🌱 교사"} · {profile?.full_name || session.user.email}</span><button className="outline" onClick={signOut}>로그아웃</button></div></header>
    <section className="hero"><div><h2>작은 기도가 모여, 큰 사랑이 자라나요 🌱</h2><p>아이들을 위한 기도와 응답을 기록하고, 학생마다 자라나는 기도나무를 함께 돌봐요.</p></div><div className="hero-art">🌼🕊️🌿</div></section>
    <section className="stats"><div><span>🧒</span><strong>{students.length}</strong><small>학생</small></div><div><span>🌿</span><strong>{prayers.length}</strong><small>기도제목</small></div><div><span>🌸</span><strong>{totalResponses}</strong><small>기도응답</small></div><div><span>⭐</span><strong>{days.length}</strong><small>기도 기록</small></div></section>
    {message && <div className="notice" role="status">{message}<button onClick={()=>setMessage("")}>닫기</button></div>}
    <div className="workspace">
      <aside className="sidebar"><div className="section-title"><h3>👩‍🏫 {profile?.role==="admin"?"교사 목록":"내 담당 학생"}</h3></div>
      {profile?.role==="admin" ? <div className="teacher-list">{teachers.filter(t=>t.role==="teacher").map(t=><button className={`teacher-item ${selectedTeacher===t.id?"chosen":""}`} key={t.id} onClick={()=>{setSelectedTeacher(t.id);setSelectedStudent("");}}><span className="avatar">👩🏻‍🏫</span><span><b>{t.full_name}</b><small>{students.filter(s=>s.teacher_id===t.id).length}명 · 담당 학생</small></span></button>)}</div> : <p className="helper">담당 학생을 선택해 기도 기록을 확인하세요.</p>}
      {profile?.role==="admin" && <button className="outline full" onClick={()=>setShowInvite(!showInvite)}>＋ 교사 계정 안내</button>}
      {showInvite && <form className="mini-form" onSubmit={createTeacher}><label>교사 이름<input required value={inviteName} onChange={e=>setInviteName(e.target.value)}/></label><label>이메일<input type="email" required value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}/></label><label>임시 비밀번호<input type="password" minLength={8} required value={invitePassword} onChange={e=>setInvitePassword(e.target.value)}/></label><p className="fine">간단한 가입 흐름 예시입니다. 운영 배포 전에는 관리자 전용 초대 Edge Function을 권장합니다.</p><button className="primary" disabled={busy}>가입 요청</button></form>}
      <div className="side-tip">💚 학생 정보는 담당 교사와 관리자만 볼 수 있도록 데이터베이스 권한으로 보호됩니다.</div></aside>
      <section className="main-panel">
        {!selectedStudent ? <>
          <div className="section-heading"><div><h2>{profile?.role==="admin" ? (teachers.find(t=>t.id===selectedTeacher)?.full_name || "교사 선택") : "나의 학생 정원"}</h2><p>학생을 선택하면 기도제목과 성장 기록이 보여요.</p></div></div>
          {profile?.role==="admin" && !selectedTeacher ? <div className="empty">왼쪽에서 교사를 선택해 주세요.</div> : <><form className="add-student" onSubmit={addStudent}><input required value={studentName} onChange={e=>setStudentName(e.target.value)} placeholder="새 학생 이름"/><select value={grade} onChange={e=>setGrade(e.target.value)}><option>유치부</option><option>초등 1학년</option><option>초등 2학년</option><option>초등 3학년</option><option>초등 4학년</option><option>초등 5학년</option><option>초등 6학년</option><option>중등부</option><option>고등부</option></select><button className="primary" disabled={busy}>＋ 학생 추가</button></form><div className="student-grid">{visibleStudents.map(s=>{const ps=prayers.filter(p=>p.student_id===s.id).length;const rs=responses.filter(r=>prayers.some(p=>p.id===r.prayer_id&&p.student_id===s.id)).length;return <button key={s.id} className="student-card" onClick={()=>{setSelectedStudent(s.id);setTab("prayers");}}><div className="student-head"><span className="avatar">{s.emoji||"🧒🏻"}</span><span><b>{s.full_name}</b><small>{s.grade}</small></span></div><div className="tree-art">{treeFor(ps,rs)}</div><div className="tree-caption">{rs>=3?"열매나무":ps>=5?"꽃나무":ps>=3?"어린 나무":ps?"새싹":"새 씨앗"}</div><div className="card-counts"><span>🌿 {ps} 기도</span><span>🌸 {rs} 응답</span></div></button>})}{visibleStudents.length===0&&<div className="empty">아직 학생이 없어요. 위에서 첫 학생을 추가해 주세요. 🌱</div>}</div></>}
        </> : <><div className="detail-top"><button className="outline" onClick={()=>setSelectedStudent("")}>← 학생 목록</button><div className="detail-actions"><button className="soft" onClick={logDay}>⭐ 오늘 기도했어요</button></div></div><div className="student-banner"><div className="big-tree">{treeFor(studentPrayers.length,studentResponses.length)}</div><div className="student-intro"><h2>{student?.full_name}의 기도나무</h2><p>{student?.grade} · 기도의 잎사귀가 자라고 감사의 꽃이 피어요.</p><div className="growthbar"><span style={{width:`${Math.min(100,studentPrayers.length*12+studentResponses.length*12)}%`}}/></div><small>🌿 기도제목 {studentPrayers.length} · 🌸 응답 {studentResponses.length} · ⭐ 기도한 날 {studentDays.length}</small></div></div>
          <div className="record-columns"><div className="records"><div className="tabs"><button className={tab==="prayers"?"active":""} onClick={()=>setTab("prayers")}>🌿 기도제목</button><button className={tab==="responses"?"active":""} onClick={()=>setTab("responses")}>🌸 응답</button><button className={tab==="days"?"active":""} onClick={()=>setTab("days")}>⭐ 기도한 날</button></div>
            {tab==="prayers" && <><form className="prayer-form" onSubmit={addPrayer}><h3>새 기도제목 기록</h3><input required value={prayerTitle} onChange={e=>setPrayerTitle(e.target.value)} placeholder="기도제목"/><textarea value={prayerBody} onChange={e=>setPrayerBody(e.target.value)} placeholder="함께 기도할 내용을 적어 주세요."/><button className="primary" disabled={busy}>기도제목 저장</button></form><div className="record-list">{studentPrayers.map(p=><article className="record" key={p.id}><div className="record-heading"><h4>{p.title}</h4><span className={`status ${p.status==="응답 완료"?"done":""}`}>{p.status}</span></div><p>{p.body||"기도 내용이 추가되지 않았어요."}</p><small>등록일 {new Date(p.created_at).toLocaleDateString("ko-KR")}</small><div className="record-buttons"><button className="soft" onClick={()=>{setResponsePrayer(p.id);setTab("responses");}}>🌸 응답 기록</button><button className="outline" onClick={()=>togglePrayer(p)}>{p.status==="응답 완료"?"진행 중으로":"응답 완료로"}</button>{profile?.role==="admin"&&<button className="delete" onClick={()=>deletePrayer(p.id)}>삭제</button>}</div></article>)}{studentPrayers.length===0&&<div className="empty">첫 기도제목을 기록해 보세요 🌱</div>}</div></>}
            {tab==="responses" && <><form className="prayer-form" onSubmit={addResponse}><h3>기도응답과 감사 기록</h3><label>연결된 기도제목<select required value={responsePrayer} onChange={e=>setResponsePrayer(e.target.value)}><option value="">기도제목 선택</option>{studentPrayers.map(p=><option value={p.id} key={p.id}>{p.title}</option>)}</select></label><label>응답 날짜<input type="date" required value={responseDate} onChange={e=>setResponseDate(e.target.value)}/></label><textarea required value={responseBody} onChange={e=>setResponseBody(e.target.value)} placeholder="어떤 변화와 감사가 있었나요?"/><button className="primary" disabled={busy||!studentPrayers.length}>응답 저장</button></form><div className="record-list">{studentResponses.map(r=><article className="record" key={r.id}><h4>🌸 {studentPrayers.find(p=>p.id===r.prayer_id)?.title}</h4><p>{r.body}</p><small>응답 기록일 {r.response_date}</small></article>)}{studentResponses.length===0&&<div className="empty">아직 기록된 응답이 없어요. 작은 감사도 기록해 보세요 🌷</div>}</div></>}
            {tab==="days" && <div className="record-list">{studentDays.map(d=><article className="record" key={d.id}><h4>⭐ 함께 기도한 날</h4><p>이 날도 이 학생을 위해 기도했어요.</p><small>{d.prayer_date}</small></article>)}{studentDays.length===0&&<div className="empty">‘오늘 기도했어요’를 눌러 첫 기록을 남겨 보세요.</div>}</div>}
          </div><aside className="growth-panel"><div className="garden">✨<div>{treeFor(studentPrayers.length,studentResponses.length)}</div>🌼</div><h3>오늘도 자라고 있어요!</h3><p>응답을 기다리는 시간에도 기도는 소중해요.</p><div className="growth-legend"><span>🌿 <b>{studentPrayers.length}</b><small>기도제목</small></span><span>🌸 <b>{studentResponses.length}</b><small>기도응답</small></span><span>⭐ <b>{studentDays.length}</b><small>기도한 날</small></span></div></aside></div>
        </>}
      </section>
    </div>
    <footer className="footer">🌱 기도는 작은 시작이지만, 하나님 안에서 자라는 사랑입니다.</footer>
  </main>;
}
