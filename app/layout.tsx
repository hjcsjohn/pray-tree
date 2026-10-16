import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "기도나무 | 우리의 기도가 열매 맺어요",
  description: "교사와 함께 학생을 위한 기도제목과 응답을 기록하는 교회 사역 도구"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
