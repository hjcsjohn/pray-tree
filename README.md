# 기도나무 — 실제 웹서비스 시작 프로젝트

교회 관리자와 여러 교사가 함께 사용하는 기도제목/기도응답 관리 웹앱입니다.
Next.js + Supabase Auth + Postgres RLS 기반입니다.

## 포함 기능
- 이메일/비밀번호 로그인 및 로그아웃
- 관리자/교사 역할 구분
- 관리자: 교사 목록 확인, 담당 교사별 학생 조회, 학생 추가
- 교사: 자신에게 배정된 학생만 조회 및 학생 추가
- 학생별 기도제목 추가, 진행 중/응답 완료 상태 변경
- 기도응답 및 감사 내용 기록
- 날짜별 기도 기록
- 기록 수에 따라 바뀌는 기도나무
- DB 행 수준 보안(RLS) 정책

## 먼저 알아둘 점
이 폴더는 실제 배포 가능한 **시작 프로젝트**이며, 아직 온라인 계정/도메인에 배포된 공개 서비스는 아닙니다.
배포하려면 본인 소유의 Supabase와 Vercel 계정 설정이 필요합니다. 비밀번호, 서비스 롤 키를 채팅에 보내지 마세요.
학생의 이름과 기도제목은 민감한 정보일 수 있으므로 실제 사용 전 교회 내 접근 범위와 개인정보 처리 기준을 확인하세요.

## 1. Supabase 프로젝트 만들기
1. https://supabase.com 에서 프로젝트를 만듭니다.
2. 프로젝트의 SQL Editor에서 `supabase/schema.sql` 전체를 실행합니다.
3. Authentication 설정에서 이메일/비밀번호 로그인을 켭니다.
4. Authentication > Users에서 관리자 계정을 먼저 생성합니다.
5. SQL Editor에서 관리자 역할을 지정합니다. 이메일 주소를 실제 관리자 이메일로 바꿉니다.

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'admin@yourchurch.org'
);
```

6. Settings > API에서 Project URL과 publishable/anon key를 복사합니다. `service_role` 키는 절대로 브라우저에 넣지 마세요.

## 2. 로컬에서 실행
Node.js 20 이상 권장.

```bash
npm install
cp .env.example .env.local
```

`.env.local` 파일을 열고 값을 채웁니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

그다음:

```bash
npm run dev
```

브라우저에서 http://localhost:3000 을 엽니다.

## 3. 배포
1. 프로젝트 파일을 본인 GitHub 저장소에 올립니다.
2. https://vercel.com 에서 해당 저장소를 가져옵니다.
3. Vercel 프로젝트 Settings > Environment Variables에 위 두 환경변수를 설정합니다.
4. Deploy를 누릅니다.
5. Supabase Authentication의 Site URL과 Redirect URLs에 실제 Vercel 도메인을 등록합니다.

## 교사 계정 발급 관련
현재 화면에는 가입 요청의 기본 예시가 있습니다. 공개 운영에서는 관리자만 교사를 초대하도록 **Supabase Edge Function + 서버 측 검증**을 붙이는 것을 권장합니다. 일반 브라우저에서 관리자 권한의 `service_role` 키를 사용하지 마세요. Supabase Auth에서 가입 확인 이메일을 켜면 사용자가 이메일 인증을 완료해야 로그인할 수 있습니다.

## 접근 제어 참고
- `profiles.role`은 기본적으로 `teacher`로 생성됩니다.
- 관리자 역할은 SQL Editor에서 명시적으로 지정합니다.
- RLS 정책은 교사가 본인에게 배정된 학생과 해당 기도 기록만 보도록 제한합니다.
- 배포 전 테스트 계정 두 개를 만들어 서로의 학생 정보가 노출되지 않는지 확인하세요.
- 실제 운영 전 교사 초대 흐름, 비밀번호 재설정, 감사 로그, 백업/복구 및 개인정보 보존/삭제 정책을 점검하세요.
