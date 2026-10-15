```tsx
'use client';

import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Student = {
  id: string;
  full_name: string;
  emoji?: string | null;
};

type Prayer = {
  id: string;
  student_id: string;
  title: string;
  body?: string | null;
  status: string;
};

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [studentName, setStudentName] = useState('');
  const [selected, setSelected] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // Supabase 클라이언트를 지역 변수에 보관해
  // 비동기 콜백에서도 null이 아님을 보장합니다.
  useEffect(() => {
    const client = supabase;

    if (!client) {
      return;
    }

    client.auth.getSession().then(({ data, error }) => {
      if (error) {
        setMessage(error.message);
        return;
      }

      setUserId(data.session?.user.id ?? null);
    });

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (userId) {
      void load();
    } else {
      setStudents([]);
      setPrayers([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function load() {
    const client = supabase;

    if (!client || !userId) {
      return;
    }

    const [studentsResult, prayersResult] = await Promise.all([
      client
        .from('students')
        .select('id, full_name, emoji')
        .order('created_at', { ascending: false }),
      client
        .from('prayer_requests')
        .select('id, student_id, title, body, status')
        .order('created_at', { ascending: false }),
    ]);

    if (studentsResult.error) {
      setMessage(studentsResult.error.message);
    } else {
      const loadedStudents = (studentsResult.data ?? []) as Student[];
      setStudents(loadedStudents);

      setSelected((current) => {
        if (
          current &&
          loadedStudents.some((student) => student.id === current)
        ) {
          return current;
        }

        return loadedStudents[0]?.id ?? '';
      });
    }

    if (prayersResult.error) {
      setMessage(prayersResult.error.message);
    } else {
      setPrayers((prayersResult.data ?? []) as Prayer[]);
    }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const client = supabase;

    if (!client) {
      setMessage('Supabase 환경변수를 확인해 주세요.');
      return;
    }

    setBusy(true);

    try {
      const { error } = await client.auth.signInWithPassword({
        email,
        password,
      });

      setMessage(error ? error.message : '로그인했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function signup() {
    const client = supabase;

    if (!client) {
      setMessage('Supabase 환경변수를 확인해 주세요.');
      return;
    }

    if (!email.trim() || password.length < 6) {
      setMessage('이메일을 입력하고 비밀번호를 6자 이상 입력해 주세요.');
      return;
    }

    setBusy(true);

    try {
      const { error } = await client.auth.signUp({
        email,
        password,
      });

      setMessage(
        error
          ? error.message
          : '가입 요청을 보냈습니다. 이메일 확인이 필요할 수 있습니다.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function addStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const client = supabase;

    if (!client || !userId || !studentName.trim()) {
      return;
    }

    const { error } = await client.from('students').insert({
      full_name: studentName.trim(),
      emoji: '🌱',
      teacher_id: userId,
    });

    setMessage(error ? error.message : '학생을 추가했습니다.');

    if (!error) {
      setStudentName('');
      await load();
    }
  }

  async function addPrayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const client = supabase;

    if (!client || !userId || !selected || !title.trim()) {
      return;
    }

    const { error } = await client.from('prayer_requests').insert({
      student_id: selected,
      title: title.trim(),
      body: body.trim(),
      status: '진행 중',
      created_by: userId,
    });

    setMessage(error ? error.message : '기도 제목을 기록했습니다.');

    if (!error) {
      setTitle('');
      setBody('');
      await load();
    }
  }

  async function logout() {
    const client = supabase;

    if (!client) {
      return;
    }

    const { error } = await client.auth.signOut();

    if (error) {
      setMessage(error.message);
    }
  }

  if (!supabase) {
    return (
      <main className="wrap">
        <h1>🌳 기도나무</h1>
        <p>
          Vercel 환경변수에 NEXT_PUBLIC_SUPABASE_URL과
          NEXT_PUBLIC_SUPABASE_ANON_KEY를 등록해 주세요.
        </p>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="wrap login">
        <div className="tree">🌳</div>
        <p className="eyebrow">GROWING TOGETHER IN PRAYER</p>
        <h1>기도나무</h1>
        <p>작은 기도가 모여 믿음의 나무로 자라납니다.</p>

        <form onSubmit={login}>
          <label>
            이메일
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
            />
          </label>

          <button type="submit" disabled={busy}>
            {busy ? '처리 중...' : '로그인'}
          </button>

          <button
            type="button"
            className="secondary"
            onClick={signup}
            disabled={busy}
          >
            새 계정 만들기
          </button>
        </form>

        {message && <p className="message">{message}</p>}
      </main>
    );
  }

  const activePrayerCount = prayers.filter(
    (prayer) => prayer.status !== '응답 완료',
  ).length;

  const answeredPrayerCount = prayers.filter(
    (prayer) => prayer.status === '응답 완료',
  ).length;

  return (
    <main className="wrap">
      <header>
        <div className="brand">
          🌳 <span>기도나무<small>PRAY TREE</small></span>
        </div>
        <button className="secondary" onClick={logout}>
          로그아웃
        </button>
      </header>

      <section className="hero">
        <p className="eyebrow">OUR PRAYER GARDEN</p>
        <h1>함께 기도하며 자라나요</h1>
        <p>한 사람의 이름을 기억하고, 작은 기도를 매일 쌓아가요.</p>

        <div className="garden">
          <span>☀️</span>
          <strong>🌳</strong>
          <div>
            🌱 학생 {students.length}명　🙏 진행 중 {activePrayerCount}개　
            ✨ 응답 {answeredPrayerCount}개
          </div>
        </div>
      </section>

      <div className="grid">
        <section className="panel">
          <h2>🌱 우리 반 학생</h2>

          <form onSubmit={addStudent} className="inline">
            <input
              value={studentName}
              onChange={(event) => setStudentName(event.target.value)}
              placeholder="학생 이름"
              required
            />
            <button type="submit">추가</button>
          </form>

          {students.map((student) => (
            <div className="item" key={student.id}>
              🌱　{student.full_name}
            </div>
          ))}

          {!students.length && (
            <p className="empty">첫 학생을 등록해 주세요.</p>
          )}
        </section>

        <section className="panel">
          <h2>🙏 기도 제목 심기</h2>

          <form onSubmit={addPrayer}>
            <label>
              학생
              <select
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
                required
              >
                <option value="">학생 선택</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.full_name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              기도 제목
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="가족의 건강을 위해"
                required
              />
            </label>

            <label>
              내용
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={3}
              />
            </label>

            <button type="submit" disabled={!students.length}>
              기도 제목 기록하기
            </button>
          </form>
        </section>
      </div>

      <section className="panel">
        <h2>🌼 기도 제목 목록</h2>

        {prayers.map((prayer) => (
          <article className="prayer" key={prayer.id}>
            <b>{prayer.title}</b>

            <span
              className={
                prayer.status === '응답 완료' ? 'done' : 'status'
              }
            >
              {prayer.status}
            </span>

            <p>
              {students.find(
                (student) => student.id === prayer.student_id,
              )?.full_name ?? '학생'}
              {prayer.body ? ` · ${prayer.body}` : ''}
            </p>
          </article>
        ))}

        {!prayers.length && (
          <p className="empty">
            첫 기도 제목을 기록하면 이곳에 표시됩니다.
          </p>
        )}
      </section>

      {message && <p className="message">{message}</p>}

      <footer>“쉬지 말고 기도하라” · 데살로니가전서 5:17</footer>
    </main>
  );
}
```
