"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type Teacher = { id: string; full_name: string; role: "admin" | "teacher" };
type Period = "month" | "firstHalf" | "secondHalf" | "year";
type PrayerAuthor = { created_by: string };
type RankingRow = Teacher & { count: number; rank: number | null };

const kstNow = () => new Date(Date.now() + 9 * 60 * 60 * 1000);
const yearsToChoose = (year: number) =>
  Array.from({ length: 10 }, (_, index) => year - index);

function dateRange(year: number, month: number, period: Period) {
  const beginMonth = period === "month" ? month : period === "secondHalf" ? 7 : 1;
  const endMonth = period === "month" ? (month === 12 ? 1 : month + 1) :
    period === "firstHalf" ? 7 : 1;
  const endYear = period === "month" && month === 12 || period === "year" || period === "secondHalf"
    ? year + 1 : year;
  const two = (number: number) => String(number).padStart(2, "0");
  return {
    from: String(year) + "-" + two(beginMonth) + "-01T00:00:00+09:00",
    to: String(endYear) + "-" + two(endMonth) + "-01T00:00:00+09:00",
    label: String(year) + "년 " + (period === "month" ? String(month) + "월" :
      period === "firstHalf" ? "상반기 (1~6월)" : period === "secondHalf" ? "하반기 (7~12월)" : "연간")
  };
}

export default function TeacherRanking({ client, teachers, onBack }: {
  client: SupabaseClient;
  teachers: Teacher[];
  onBack: () => void;
}) {
  const [year, setYear] = useState(() => kstNow().getUTCFullYear());
  const [month, setMonth] = useState(() => kstNow().getUTCMonth() + 1);
  const [period, setPeriod] = useState<Period>("month");
  const [rows, setRows] = useState<PrayerAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const range = useMemo(() => dateRange(year, month, period), [year, month, period]);

  useEffect(() => {
    let disposed = false;
    async function fetchRanking() {
      setLoading(true);
      setError("");
      setRows([]);
      try {
        const collected: PrayerAuthor[] = [];
        // Paginate to count every record, beyond Supabase's 1,000-row response limit.
        for (let offset = 0; ; offset += 1000) {
          const { data, error: queryError } = await client.from("prayer_requests")
            .select("created_by")
            .gte("created_at", range.from)
            .lt("created_at", range.to)
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(offset, offset + 999);
          if (queryError) throw new Error(queryError.message);
          if (disposed) return;
          const page = (data || []) as PrayerAuthor[];
          collected.push(...page);
          if (page.length < 1000) break;
        }
        if (!disposed) setRows(collected);
      } catch (caught) {
        if (!disposed) setError(caught instanceof Error ? caught.message : "집계 데이터를 불러오지 못했습니다.");
      } finally {
        if (!disposed) setLoading(false);
      }
    }
    void fetchRanking();
    return () => { disposed = true; };
  }, [client, range.from, range.to, refresh]);

  const ranking = useMemo<RankingRow[]>(() => {
    const counts = new Map<string, number>();
    rows.forEach(row => counts.set(row.created_by, (counts.get(row.created_by) || 0) + 1));
    const sorted = teachers.filter(t => t.role === "teacher")
      .map(t => ({ ...t, count: counts.get(t.id) || 0, rank: null as number | null }))
      .sort((a, b) => b.count - a.count || a.full_name.localeCompare(b.full_name, "ko"));
    let lastCount = -1;
    let lastRank = 0;
    return sorted.map((item, index) => {
      if (item.count === 0) return { ...item, rank: null };
      if (item.count !== lastCount) {
        lastCount = item.count;
        lastRank = index + 1;
      }
      return { ...item, rank: lastRank };
    });
  }, [rows, teachers]);

  const total = ranking.reduce((sum, person) => sum + person.count, 0);
  const activeTeachers = ranking.filter(person => person.count > 0).length;
  const winners = ranking.filter(person => person.count > 0 && person.rank !== null && person.rank <= 3);
  const maxCount = ranking[0]?.count || 0;

  function exportCsv() {
    const escapeCell = (value: string | number) => {
      let text = String(value);
      if (/^[=+\-@]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const csvRows = [
      ["순위", "교사명", "기도제목 등록 수", "집계 기간"],
      ...ranking.map(person => [person.rank ?? "-", person.full_name, person.count, range.label])
    ];
    const csv = "\uFEFF" + csvRows.map(line => line.map(escapeCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const element = document.createElement("a");
    element.href = url;
    element.download = "기도나무_교사별랭킹_" + String(year) + "_" + period + (period === "month" ? "_" + String(month).padStart(2, "0") : "") + ".csv";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
  }

  return (
    <section className="ranking-page">
      <div className="ranking-heading">
        <div>
          <p className="ranking-overline">PRAYER TREE · 감사의 기록</p>
          <h2>🏆 교사별 기도제목 랭킹</h2>
          <p>함께 기도해 온 교사들의 수고를 한눈에 살펴보세요.</p>
        </div>
        <button type="button" className="outline ranking-back" onClick={onBack}>← 학생 관리로 돌아가기</button>
      </div>

      <div className="ranking-controls">
        <div className="ranking-period-tabs" role="group" aria-label="집계 기간">
          {([
            ["month", "월별"], ["firstHalf", "상반기"], ["secondHalf", "하반기"], ["year", "연간"]
          ] as [Period, string][]).map(([value, label]) =>
            <button key={value} type="button" className={period === value ? "active" : ""} aria-pressed={period === value} onClick={() => setPeriod(value)}>{label}</button>
          )}
        </div>
        <label>연도 <select value={year} onChange={e => setYear(Number(e.target.value))}>
          {yearsToChoose(kstNow().getUTCFullYear()).map(value => <option key={value} value={value}>{value}년</option>)}
        </select></label>
        {period === "month" && <label>월 <select value={month} onChange={e => setMonth(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(value => <option key={value} value={value}>{value}월</option>)}
        </select></label>}
      </div>

      <div className="ranking-period-title">
        <div><h3>{range.label} 기도제목 랭킹</h3><p>한국시간(KST) 기준 · 등록한 교사를 기준으로 집계</p></div>
        <div className="ranking-actions">
          <button type="button" className="outline" disabled={loading} onClick={() => setRefresh(n => n + 1)}>↻ 최신 기록</button>
          <button type="button" className="outline" disabled={loading || !!error} onClick={exportCsv}>↓ 엑셀용 CSV</button>
          <button type="button" className="primary" disabled={loading || !!error} onClick={() => window.print()}>🖨 인쇄 / PDF</button>
        </div>
      </div>

      {loading ? <div className="ranking-message" role="status">교사별 기도제목 수를 집계하고 있습니다…</div> :
       error ? <div className="ranking-message ranking-error" role="alert">랭킹 불러오기 실패: {error}<p>새로고침하거나 관리자 로그인 상태를 확인해 주세요.</p></div> :
       <>
        <div className="ranking-summary">
          <div><span>🌿 등록된 기도제목</span><strong>{total.toLocaleString("ko-KR")}<small> 개</small></strong></div>
          <div><span>👩‍🏫 참여 교사</span><strong>{activeTeachers}<small> 명</small></strong></div>
          <div><span>🏅 집계 대상 교사</span><strong>{ranking.length}<small> 명</small></strong></div>
        </div>
        {winners.length > 0 ? <div className="ranking-podium">
          {winners.map(person => <div key={person.id} className={"ranking-winner rank-" + person.rank}>
            <span className="ranking-medal">{person.rank === 1 ? "🥇" : person.rank === 2 ? "🥈" : "🥉"}</span>
            <span className="ranking-place">{person.rank}위{winners.filter(w=>w.rank===person.rank).length > 1 ? " · 공동" : ""}</span>
            <strong>{person.full_name}</strong>
            <span className="ranking-count">{person.count.toLocaleString("ko-KR")} <small>건</small></span>
          </div>)}
        </div> : <div className="ranking-message">선택한 기간에 교사가 직접 등록한 기도제목이 아직 없습니다.</div>}

        <div className="ranking-table-wrap">
          <table className="ranking-table">
            <thead><tr><th scope="col">순위</th><th scope="col">교사명</th><th scope="col">기도제목 등록 수</th><th scope="col">기여도</th></tr></thead>
            <tbody>
              {ranking.map(person => <tr key={person.id}>
                <td className="ranking-position">{person.rank === null ? "—" : person.rank + "위"}</td>
                <td><strong>{person.full_name}</strong></td>
                <td className="ranking-number">{person.count.toLocaleString("ko-KR")}건</td>
                <td><div className="ranking-bar-track"><span style={{ width: (maxCount > 0 ? person.count / maxCount * 100 : 0) + "%" }} /></div></td>
              </tr>)}
            </tbody>
          </table>
          {ranking.length === 0 && <div className="ranking-message">등록된 교사 계정이 아직 없습니다.</div>}
        </div>
        <p className="ranking-note">집계 기준: 기도제목을 실제로 등록한 교사의 계정(created_by)과 등록일(created_at)을 기준으로 1건씩 셉니다. 관리자 계정이 대신 등록한 글은 교사 실적에 포함되지 않습니다. 공동 순위는 같은 등수로 표시하고, 0건은 순위를 부여하지 않습니다. 삭제된 기록은 집계되지 않습니다.</p>
        <p className="ranking-print-footer">기도나무 · {range.label} · 교사별 기도제목 등록 현황</p>
       </>
      }
    </section>
  );
}
