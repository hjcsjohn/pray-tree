# 기도나무 (Pray Tree)
교회 교사가 학생과 기도 제목을 기록하는 Next.js + Supabase 웹앱입니다.

## 포함 기능
- Supabase 이메일/비밀번호 로그인 및 계정 생성
- 학생 등록
- 학생별 기도 제목 등록 및 상태 표시
- 기도 현황을 나무/정원 테마로 표시

## 환경변수
`.env.example`을 참고해 Vercel 환경변수에 아래 값을 설정하세요.
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase publishable/anon key)

비밀 키나 `.env.local` 파일을 GitHub에 업로드하지 마세요.

## 로컬 실행
```bash
npm install
npm run dev
```

## 배포
Vercel 프로젝트에서 이 저장소(`hjcsjohn/pray-tree`)의 `main` 브랜치를 연결하고 Root Directory를 `./`로 설정합니다. 환경변수를 등록하면 이후 `main` 브랜치 커밋마다 자동 배포됩니다.

## 데이터베이스
이 버전은 `students`와 `prayer_requests` 테이블을 읽고 씁니다. 테이블의 필드명과 RLS 정책이 앱에서 쓰는 필드와 일치하는지 확인하세요.
