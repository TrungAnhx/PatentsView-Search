'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Bookmark,
  BrainCircuit,
  Check,
  ChevronDown,
  Clipboard,
  Clock,
  Copy,
  Database,
  Download,
  FileSearch,
  Filter,
  Globe2,
  Loader2,
  Rocket,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Terminal,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PatentCard } from '@/components/patent-card';
import { PatentDetail } from '@/components/patent-detail';
import { searchPatentsAction } from './actions';
import { Patent } from '@/types';

type DemoTab = 'analyse' | 'train' | 'testing' | 'deploy';

const demoTabs: Array<{ id: DemoTab; label: string; icon: typeof BarChart3 }> = [
  { id: 'analyse', label: 'Analyze', icon: BarChart3 },
  { id: 'train', label: 'Translate', icon: BookOpen },
  { id: 'testing', label: 'Validate', icon: Users },
  { id: 'deploy', label: 'Export', icon: Rocket },
];

const sampleQueries = [
  'Tìm công nghệ pin thể rắn cho xe điện sau năm 2021',
  'Semiconductor packaging by leading manufacturers in 2023',
  'pn=EP AND txt all "battery thermal management"',
];

type SourceFilter = 'all' | 'EPO' | 'PatentsView';
type SortMode = 'relevance' | 'newest' | 'oldest' | 'assignee';

export default function Home() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Patent[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [generatedQuery, setGeneratedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedPatent, setSelectedPatent] = useState<Patent | null>(null);
  const [useAI, setUseAI] = useState(true);
  const [activeTab, setActiveTab] = useState<DemoTab>('analyse');
  const [error, setError] = useState('');
  const [openMenu, setOpenMenu] = useState<'solutions' | 'teams' | null>(null);
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [savedQueries, setSavedQueries] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [yearFilter, setYearFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('relevance');
  const [comparePatents, setComparePatents] = useState<Patent[]>([]);

  useEffect(() => {
    setQueryHistory(readStoredList('patentsphere-query-history'));
    setSavedQueries(readStoredList('patentsphere-saved-queries'));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveTab((current) => {
        const index = demoTabs.findIndex((tab) => tab.id === current);
        return demoTabs[(index + 1) % demoTabs.length].id;
      });
    }, 4000);

    return () => window.clearInterval(timer);
  }, []);

  const visibleResults = useMemo(() => {
    const filtered = results.filter((patent) => {
      const sourceMatch = sourceFilter === 'all' || patent.source === sourceFilter;
      const yearMatch = !yearFilter || patent.patent_date?.startsWith(yearFilter);
      const assignee = patent.assignees?.[0]?.assignee_organization || '';
      const assigneeMatch = !assigneeFilter || assignee.toLowerCase().includes(assigneeFilter.toLowerCase());
      return sourceMatch && yearMatch && assigneeMatch;
    });

    return [...filtered].sort((first, second) => {
      if (sortMode === 'newest') return (second.patent_date || '').localeCompare(first.patent_date || '');
      if (sortMode === 'oldest') return (first.patent_date || '').localeCompare(second.patent_date || '');
      if (sortMode === 'assignee') {
        const firstAssignee = first.assignees?.[0]?.assignee_organization || '';
        const secondAssignee = second.assignees?.[0]?.assignee_organization || '';
        return firstAssignee.localeCompare(secondAssignee);
      }
      return 0;
    });
  }, [assigneeFilter, results, sortMode, sourceFilter, yearFilter]);

  const resultLabel = useMemo(() => {
    if (loading) return 'Đang truy vấn EPO và PatentsView...';
    const count = totalCount > 0 ? totalCount.toLocaleString() : results.length;
    return `Tìm thấy ${count} kết quả · Trang ${page}`;
  }, [loading, page, results.length, totalCount]);

  const resetHome = () => {
    setHasSearched(false);
    setResults([]);
    setTotalCount(0);
    setPage(1);
    setGeneratedQuery('');
    setError('');
  };

  const persistList = (key: string, values: string[]) => {
    window.localStorage.setItem(key, JSON.stringify(values));
  };

  const rememberQuery = (value: string) => {
    const nextHistory = [value, ...queryHistory.filter((item) => item !== value)].slice(0, 6);
    setQueryHistory(nextHistory);
    persistList('patentsphere-query-history', nextHistory);
  };

  const saveCurrentQuery = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const nextSaved = [trimmed, ...savedQueries.filter((item) => item !== trimmed)].slice(0, 8);
    setSavedQueries(nextSaved);
    persistList('patentsphere-saved-queries', nextSaved);
  };

  const removeSavedQuery = (value: string) => {
    const nextSaved = savedQueries.filter((item) => item !== value);
    setSavedQueries(nextSaved);
    persistList('patentsphere-saved-queries', nextSaved);
  };

  const handleSearch = async (event?: FormEvent, newPage: number = 1) => {
    event?.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setHasSearched(true);
    if (newPage === 1) setResults([]);

    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const response = await searchPatentsAction(query, useAI, newPage);
      setResults(response.data.patents || []);
      setTotalCount(response.data.total_patent_count || 0);
      setGeneratedQuery(response.generatedQuery);
      setPage(newPage);
      rememberQuery(query.trim());
    } catch (searchError) {
      console.error('Search failed', searchError);
      setError('Không thể hoàn tất truy vấn lúc này. Hãy kiểm tra API key, cú pháp truy vấn hoặc thử lại sau.');
      setResults([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyGeneratedQuery = async () => {
    if (!generatedQuery) return;
    await navigator.clipboard.writeText(generatedQuery);
  };

  const handleExportBrief = () => {
    if (visibleResults.length === 0) return;

    const rows = visibleResults.slice(0, 10).map((patent, index) => {
      const assignee = patent.assignees?.[0]?.assignee_organization || 'Unknown assignee';
      const abstract = patent.patent_abstract && patent.patent_abstract !== 'No Abstract'
        ? patent.patent_abstract.slice(0, 650)
        : 'No abstract returned by source API.';
      return [
        `## ${index + 1}. ${patent.patent_title}`,
        `- Patent: ${patent.patent_number}`,
        `- Date: ${patent.patent_date || 'N/A'}`,
        `- Assignee: ${assignee}`,
        `- Source: ${patent.source || 'Unknown'}`,
        `- Abstract: ${abstract}`,
      ].join('\n');
    });

    const brief = [
      '# PatentSphere AI Brief',
      `Query: ${query || 'N/A'}`,
      `Generated query: ${generatedQuery || 'N/A'}`,
      `Exported results: ${Math.min(visibleResults.length, 10)} of ${visibleResults.length}`,
      '',
      ...rows,
    ].join('\n\n');

    const blob = new Blob([brief], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `patentsphere_brief_${Date.now()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleCompare = (patent: Patent) => {
    setComparePatents((current) => {
      if (current.some((item) => item.patent_id === patent.patent_id)) {
        return current.filter((item) => item.patent_id !== patent.patent_id);
      }
      return [patent, ...current].slice(0, 3);
    });
  };

  const handleExport = async (mode: 'current' | 'top100' = 'current') => {
    if (results.length === 0) return;
    setIsExporting(true);

    try {
      let dataToExport = [...results];

      if (mode === 'top100' && page === 1 && totalCount > results.length) {
        try {
          const response = await searchPatentsAction(query, useAI, 2);
          const mergedMap = new Map<string, Patent>();
          dataToExport.forEach((patent) => mergedMap.set(patent.patent_number, patent));
          response.data.patents?.forEach((patent) => mergedMap.set(patent.patent_number, patent));
          dataToExport = Array.from(mergedMap.values()).slice(0, 100);
        } catch (exportError) {
          console.error('Failed to fetch more results for export', exportError);
        }
      }

      const headers = ['Patent Number', 'Title', 'Date', 'Assignee', 'Inventors', 'Source', 'Link'];
      const csvRows = dataToExport.map((patent) => {
        const assignee = patent.assignees?.[0]?.assignee_organization || 'N/A';
        const inventors = patent.inventors?.map((inventor) => `${inventor.inventor_first_name} ${inventor.inventor_last_name}`).join('; ') || 'N/A';
        const cleanNumber = patent.patent_number.replace(/[^a-zA-Z0-9]/g, '');
        const link = `https://patents.google.com/patent/${/^[A-Za-z]{2}/.test(cleanNumber) ? cleanNumber : `US${cleanNumber}`}`;

        return [
          patent.patent_number,
          patent.patent_title,
          patent.patent_date,
          assignee,
          inventors,
          patent.source || 'Unknown',
          link,
        ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',');
      });

      const blob = new Blob(['\ufeff' + [headers.join(','), ...csvRows].join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `patents_${mode}_${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black">
      <header className="animate-fade-in-up opacity-0 sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-xl" style={{ animationDelay: '0.1s' }}>
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <button onClick={resetHome} className="flex items-center gap-2 text-left">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white shadow-sm">
              <Star className="h-5 w-5 fill-black text-black" />
            </span>
            <span className="text-lg font-semibold tracking-tight">PatentSphere</span>
          </button>

          <div className="hidden items-center gap-8 md:flex">
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'solutions' ? null : 'solutions')}
                className="flex items-center gap-1 text-sm text-gray-700 transition-colors hover:text-black"
              >
                Solutions
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {openMenu === 'solutions' && (
                <div className="absolute left-0 top-8 w-72 rounded-2xl border border-gray-200 bg-white p-2 text-left shadow-[0_18px_50px_rgba(15,23,42,0.14)]">
                  <NavMenuButton icon={BrainCircuit} title="AI Query Builder" description="Viết query EPO từ câu hỏi tự nhiên" onClick={() => { setUseAI(true); setOpenMenu(null); document.getElementById('query-workspace')?.scrollIntoView({ behavior: 'smooth' }); }} />
                  <NavMenuButton icon={Filter} title="Filter & Sort" description="Lọc theo nguồn, năm, chủ sở hữu" onClick={() => { setOpenMenu(null); document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }); }} />
                  <NavMenuButton icon={Clipboard} title="AI Brief Export" description="Xuất brief Markdown cho nhóm đọc nhanh" onClick={() => { setOpenMenu(null); document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }); }} />
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'teams' ? null : 'teams')}
                className="flex items-center gap-1 text-sm text-gray-700 transition-colors hover:text-black"
              >
                For IP Teams
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {openMenu === 'teams' && (
                <div className="absolute left-0 top-8 w-72 rounded-2xl border border-gray-200 bg-white p-2 text-left shadow-[0_18px_50px_rgba(15,23,42,0.14)]">
                  <NavMenuButton icon={Scale} title="Legal review" description="So sánh nhanh tối đa 3 đơn" onClick={() => { setOpenMenu(null); document.getElementById('compare')?.scrollIntoView({ behavior: 'smooth' }); }} />
                  <NavMenuButton icon={Database} title="R&D discovery" description="Bắt đầu bằng truy vấn công nghệ mẫu" onClick={() => { setQuery(sampleQueries[0]); setOpenMenu(null); document.getElementById('query-workspace')?.scrollIntoView({ behavior: 'smooth' }); }} />
                  <NavMenuButton icon={Users} title="Business teams" description="Xuất CSV và brief để chia sẻ nội bộ" onClick={() => { setOpenMenu(null); document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }); }} />
                </div>
              )}
            </div>
            <a className="text-sm text-gray-700 transition-colors hover:text-black" href="#workflow">Workflow</a>
            <a className="text-sm text-gray-700 transition-colors hover:text-black" href="#results">Results</a>
          </div>

          <div className="flex items-center gap-3">
            <button className="hidden text-sm text-gray-700 hover:text-black sm:block">Login</button>
            <Button className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800" onClick={() => handleSearch()}>
              Get started free
            </Button>
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-6 pb-20 pt-20 text-center md:pb-28 md:pt-24">
          <div className="animate-fade-in-up inline-flex items-center gap-2 opacity-0" style={{ animationDelay: '0.2s' }}>
            <span className="flex h-6 w-6 items-center justify-center rounded border border-gray-300">
              <Star className="h-3.5 w-3.5 fill-black text-black" />
            </span>
            <span className="text-sm font-medium text-black">AI patent search for research, legal, and product teams</span>
          </div>

          <h1 className="animate-fade-in-up mx-auto mt-8 max-w-5xl text-5xl font-normal leading-[1.08] tracking-tight opacity-0 md:text-7xl lg:text-[80px]" style={{ animationDelay: '0.3s' }}>
            Tra cứu IP nhanh hơn.
            <span className="block bg-gradient-to-r from-black via-gray-500 to-gray-400 bg-clip-text text-transparent">
              Không cần học query.
            </span>
          </h1>

          <p className="animate-fade-in-up mx-auto mt-5 max-w-2xl text-lg leading-8 text-gray-600 opacity-0 md:text-xl" style={{ animationDelay: '0.4s' }}>
            Nhập câu hỏi tự nhiên, PatentSphere tự chuyển thành truy vấn phù hợp, tìm trên EPO và PatentsView, rồi hỗ trợ phân tích từng bằng sáng chế bằng AI.
          </p>

          <form id="query-workspace" onSubmit={(event) => handleSearch(event, 1)} className="animate-fade-in-up mx-auto mt-8 max-w-3xl opacity-0" style={{ animationDelay: '0.5s' }}>
            <div className="rounded-3xl border border-gray-200 bg-white p-2 text-left shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
              <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="h-5 w-5 text-black" />
                  <span className="text-sm font-semibold">AI Query Builder</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="ai-mode" checked={useAI} onCheckedChange={setUseAI} />
                  <Label htmlFor="ai-mode" className="cursor-pointer text-xs font-medium text-gray-600">
                    {useAI ? 'AI đang bật' : 'Manual query'}
                  </Label>
                </div>
              </div>

              <div className="relative">
                <Textarea
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ví dụ: tìm công nghệ pin thể rắn cho xe điện sau năm 2021..."
                  className="min-h-[112px] resize-none border-0 px-4 py-4 text-base leading-7 shadow-none placeholder:text-gray-300 focus-visible:ring-0 md:text-lg"
                  disabled={loading}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      handleSearch(event, 1);
                    }
                  }}
                />
                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                  <Button type="button" variant="outline" className="hidden rounded-full md:inline-flex" onClick={saveCurrentQuery} disabled={!query.trim()}>
                    <Bookmark className="mr-2 h-4 w-4" />
                    Lưu
                  </Button>
                  <Button type="submit" className="rounded-full bg-black px-6 text-white hover:bg-gray-800" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {loading ? 'Đang tìm...' : 'Ask AI'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {sampleQueries.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => setQuery(sample)}
                  className="rounded-full border border-gray-100 px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-700"
                >
                  {sample}
                </button>
              ))}
            </div>

            {(queryHistory.length > 0 || savedQueries.length > 0) && (
              <div className="mt-5 grid gap-3 text-left md:grid-cols-2">
                {savedQueries.length > 0 && (
                  <QueryList
                    title="Saved queries"
                    items={savedQueries}
                    icon={Bookmark}
                    onUse={setQuery}
                    onRemove={removeSavedQuery}
                  />
                )}
                {queryHistory.length > 0 && (
                  <QueryList
                    title="Recent queries"
                    items={queryHistory}
                    icon={Clock}
                    onUse={setQuery}
                  />
                )}
              </div>
            )}
          </form>

          <div id="workflow" className="animate-fade-in-up mx-auto mt-12 max-w-3xl opacity-0" style={{ animationDelay: '0.6s' }}>
            <div className="grid rounded-lg bg-gray-100 p-1 md:hidden">
              <div className="grid grid-cols-2 gap-1">
                {demoTabs.map((tab) => <DemoTabButton key={tab.id} tab={tab} activeTab={activeTab} onSelect={setActiveTab} />)}
              </div>
            </div>
            <div className="hidden items-center justify-center rounded-lg bg-gray-100 p-1 md:flex">
              {demoTabs.map((tab, index) => (
                <div key={tab.id} className="flex items-center">
                  <DemoTabButton tab={tab} activeTab={activeTab} onSelect={setActiveTab} />
                  {index < demoTabs.length - 1 && <span className="mx-1 h-5 w-px bg-gray-300" />}
                </div>
              ))}
            </div>
          </div>

          <div className="animate-fade-in-up mx-auto mt-8 max-w-5xl opacity-0" style={{ animationDelay: '0.7s' }}>
            <div className="relative h-[420px] overflow-hidden rounded-3xl border border-gray-200 bg-[radial-gradient(circle_at_top_left,#f8fafc,white_45%,#f3f4f6)] shadow-[0_30px_100px_rgba(15,23,42,0.14)] md:h-[500px]">
              <div className="absolute inset-x-0 top-0 flex h-12 items-center gap-2 border-b border-gray-200 bg-white/80 px-5 backdrop-blur">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-yellow-400" />
                <span className="h-3 w-3 rounded-full bg-green-400" />
                <span className="ml-4 text-xs font-medium text-gray-500">patentsphere.ai/search</span>
              </div>

              <DemoOverlay activeTab={activeTab} />
            </div>
          </div>

          <div className="animate-fade-in-up mt-16 opacity-0" style={{ animationDelay: '0.8s' }}>
            <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-10 gap-y-5 text-sm font-semibold tracking-wide text-gray-400">
              <span>PatentsView</span>
              <span>EPO OPS</span>
              <span>Espacenet</span>
              <span>Google Patents</span>
              <span>WIPO</span>
              <span>USPTO</span>
            </div>
          </div>
        </section>

        <AnimatePresence>
          {hasSearched && (
            <motion.section
              id="results"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              className="mx-auto max-w-7xl px-6 pb-24"
            >
              <div className="mb-6 flex flex-col gap-4 border-b border-gray-200 pb-5 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Search results</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight">{resultLabel}</h2>
                  {generatedQuery && useAI && (
                    <div className="mt-3 flex max-w-3xl items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-left">
                      <Terminal className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                      <code className="text-xs leading-5 text-gray-700">{generatedQuery}</code>
                      <button type="button" onClick={handleCopyGeneratedQuery} className="ml-auto rounded-full border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:text-black">
                        <Copy className="mr-1 inline h-3 w-3" />
                        Copy
                      </button>
                    </div>
                  )}
                </div>

                {!loading && results.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="gap-2 rounded-full" onClick={handleExportBrief}>
                      <Clipboard className="h-4 w-4" />
                      Xuất AI brief
                    </Button>
                    <Button variant="outline" className="gap-2 rounded-full" onClick={() => handleExport(totalCount > results.length ? 'top100' : 'current')} disabled={isExporting}>
                      {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      {isExporting ? 'Đang xử lý...' : totalCount > results.length ? 'Xuất Top 100' : 'Xuất CSV'}
                    </Button>
                  </div>
                )}
              </div>

              {results.length > 0 && (
                <div className="mb-6 rounded-3xl border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Filter className="h-4 w-4" />
                    Filter workspace
                  </div>
                  <div className="grid gap-3 md:grid-cols-4">
                    <Select value={sourceFilter} onValueChange={(value) => setSourceFilter(value as SourceFilter)}>
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder="Source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">All sources</SelectItem>
                          <SelectItem value="EPO">EPO only</SelectItem>
                          <SelectItem value="PatentsView">PatentsView only</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <Input value={yearFilter} onChange={(event) => setYearFilter(event.target.value)} placeholder="Year, e.g. 2024" className="bg-white" />
                    <Input value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)} placeholder="Assignee contains..." className="bg-white" />
                    <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder="Sort" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="relevance">Original order</SelectItem>
                          <SelectItem value="newest">Newest first</SelectItem>
                          <SelectItem value="oldest">Oldest first</SelectItem>
                          <SelectItem value="assignee">Assignee A-Z</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="mt-3 text-xs text-gray-500">
                    Đang hiển thị {visibleResults.length} / {results.length} kết quả trong page hiện tại.
                  </p>
                </div>
              )}

              {error && (
                <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              {results.length === 0 && !loading ? (
                <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-gray-300 bg-gray-50 py-20 text-center">
                  <Search className="h-10 w-10 text-gray-300" />
                  <p className="font-medium">Không tìm thấy kết quả phù hợp.</p>
                  <p className="max-w-md text-sm text-gray-500">Hãy thử mở rộng từ khóa, bỏ bớt điều kiện ngày, hoặc bật AI để hệ thống viết lại truy vấn.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {visibleResults.map((patent, index) => (
                      <motion.div key={patent.patent_id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
                        <PatentCard patent={patent} onClick={setSelectedPatent} />
                        <Button
                          variant={comparePatents.some((item) => item.patent_id === patent.patent_id) ? 'default' : 'outline'}
                          size="sm"
                          className="mt-2 w-full gap-2 rounded-full"
                          onClick={() => toggleCompare(patent)}
                        >
                          <Scale className="h-4 w-4" />
                          {comparePatents.some((item) => item.patent_id === patent.patent_id) ? 'Đã chọn so sánh' : 'So sánh'}
                        </Button>
                      </motion.div>
                    ))}
                  </div>

                  {comparePatents.length > 0 && (
                    <div id="compare" className="mt-10 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-500">Patent compare</p>
                          <h3 className="text-xl font-semibold tracking-tight">So sánh nhanh {comparePatents.length} đơn</h3>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setComparePatents([])}>Xóa</Button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        {comparePatents.map((patent) => (
                          <div key={patent.patent_id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                            <Badge variant="outline">{patent.patent_number}</Badge>
                            <h4 className="mt-3 line-clamp-3 font-semibold">{patent.patent_title}</h4>
                            <dl className="mt-4 grid gap-2 text-sm">
                              <div><dt className="text-gray-500">Date</dt><dd>{patent.patent_date || 'N/A'}</dd></div>
                              <div><dt className="text-gray-500">Assignee</dt><dd className="line-clamp-2">{patent.assignees?.[0]?.assignee_organization || 'Unknown'}</dd></div>
                              <div><dt className="text-gray-500">Source</dt><dd>{patent.source || 'Unknown'}</dd></div>
                            </dl>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(results.length >= 20 || page > 1) && (
                    <div className="mt-10 flex items-center justify-center gap-3">
                      <Button variant="outline" onClick={() => handleSearch(undefined, Math.max(1, page - 1))} disabled={page <= 1 || loading}>
                        Trang trước
                      </Button>
                      <span className="text-sm font-medium text-gray-600">Trang {page}</span>
                      <Button variant="outline" onClick={() => handleSearch(undefined, page + 1)} disabled={loading || results.length < 20}>
                        Trang sau
                      </Button>
                    </div>
                  )}
                </>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <PatentDetail patent={selectedPatent} isOpen={!!selectedPatent} onClose={() => setSelectedPatent(null)} />
    </div>
  );
}

function readStoredList(key: string) {
  if (typeof window === 'undefined') return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function NavMenuButton({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors hover:bg-gray-50">
      <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200">
        <Icon className="h-4 w-4" />
      </span>
      <span>
        <span className="block text-sm font-semibold text-black">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-gray-500">{description}</span>
      </span>
    </button>
  );
}

function QueryList({
  title,
  items,
  icon: Icon,
  onUse,
  onRemove,
}: {
  title: string;
  items: string[];
  icon: LucideIcon;
  onUse: (value: string) => void;
  onRemove?: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item} className="flex items-center gap-2">
            <button type="button" onClick={() => onUse(item)} className="min-w-0 flex-1 truncate rounded-full border border-gray-200 bg-white px-3 py-1.5 text-left text-xs text-gray-600 hover:text-black">
              {item}
            </button>
            {onRemove && (
              <button type="button" onClick={() => onRemove(item)} className="rounded-full px-2 py-1 text-xs text-gray-400 hover:text-black">
                Xóa
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoTabButton({
  tab,
  activeTab,
  onSelect,
}: {
  tab: { id: DemoTab; label: string; icon: typeof BarChart3 };
  activeTab: DemoTab;
  onSelect: (tab: DemoTab) => void;
}) {
  const Icon = tab.icon;
  const isActive = activeTab === tab.id;

  return (
    <button
      type="button"
      onClick={() => onSelect(tab.id)}
      className={`flex min-w-[128px] items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${
        isActive ? 'bg-white text-black shadow-sm' : 'text-gray-600 hover:text-black'
      }`}
    >
      <Icon className="h-4 w-4" />
      {tab.label}
    </button>
  );
}

function DemoOverlay({ activeTab }: { activeTab: DemoTab }) {
  return (
    <div className="animate-fade-in-overlay absolute inset-0 pt-12">
      <div className="absolute inset-0 grid grid-cols-12 gap-4 p-5 md:p-8">
        <div className="col-span-12 rounded-2xl border border-gray-200 bg-white/70 p-5 text-left shadow-sm backdrop-blur md:col-span-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Database className="h-4 w-4" />
            Unified IP Search
          </div>
          <div className="mt-5 space-y-3">
            {['Natural language query', 'EPO CQL translation', 'PatentsView fallback', 'CSV-ready output'].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2 text-sm text-gray-700">
                <Check className="h-4 w-4 text-emerald-600" />
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="col-span-12 hidden rounded-2xl border border-gray-200 bg-white/70 p-5 text-left shadow-sm backdrop-blur md:col-span-8 md:block">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Live workspace</p>
              <h3 className="mt-1 text-xl font-semibold">Battery thermal management</h3>
            </div>
            <Button size="sm" className="rounded-full bg-black">
              Review
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {['12,480 matches', '84 assignees', '18 jurisdictions'].map((metric) => (
              <div key={metric} className="rounded-xl bg-gray-50 p-4">
                <p className="text-lg font-semibold">{metric.split(' ')[0]}</p>
                <p className="text-xs text-gray-500">{metric.split(' ').slice(1).join(' ')}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="animate-slide-up-overlay absolute left-1/2 top-1/2 w-[88%] max-w-xl rounded-3xl border border-gray-200 bg-white p-5 text-left shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        {activeTab === 'analyse' && <AnalyzeCard />}
        {activeTab === 'train' && <TranslateCard />}
        {activeTab === 'testing' && <ValidateCard />}
        {activeTab === 'deploy' && <ExportCard />}
      </div>
    </div>
  );
}

function AnalyzeCard() {
  return (
    <>
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-violet-50 p-2 text-violet-700"><FileSearch className="h-5 w-5" /></div>
        <div>
          <h3 className="font-semibold">Set Up Your IP Workspace</h3>
          <p className="text-sm text-gray-500">Convert business intent into searchable patent criteria.</p>
        </div>
      </div>
      <div className="mt-5 h-2 rounded-full bg-gray-100"><div className="h-2 w-1/4 rounded-full bg-violet-600" /></div>
      <div className="mt-5 grid gap-3 text-sm">
        {['Understand user intent', 'Identify assignee and date signals', 'Choose EPO + PatentsView sources', 'Prepare review queue'].map((step, index) => (
          <div key={step} className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs">{index + 1}</span>{step}</div>
        ))}
      </div>
    </>
  );
}

function TranslateCard() {
  return (
    <>
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-orange-50 p-2 text-orange-700"><BrainCircuit className="h-5 w-5" /></div>
        <div>
          <h3 className="font-semibold">AI Query Translation</h3>
          <p className="text-sm text-gray-500">Generate CQL while keeping the original intent visible.</p>
        </div>
      </div>
      <div className="mt-5 h-2 rounded-full bg-gray-100"><div className="h-2 w-2/3 rounded-full bg-orange-500" /></div>
      <div className="mt-5 rounded-2xl bg-gray-950 p-4 font-mono text-xs leading-6 text-gray-100">
        {'pa any "Apple" AND txt all "foldable display" AND pd >= 20200101'}
      </div>
    </>
  );
}

function ValidateCard() {
  return (
    <>
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><ShieldCheck className="h-5 w-5" /></div>
        <div>
          <h3 className="font-semibold">Test Suite Results</h3>
          <p className="text-sm text-gray-500">Review result health before exporting a working set.</p>
        </div>
      </div>
      <div className="mt-5 rounded-2xl bg-emerald-50 p-5 text-center">
        <p className="text-4xl font-semibold text-emerald-700">127/127</p>
        <p className="mt-1 text-sm text-emerald-800">Records normalized, deduped, and ready for review</p>
      </div>
    </>
  );
}

function ExportCard() {
  return (
    <>
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-blue-50 p-2 text-blue-700"><Globe2 className="h-5 w-5" /></div>
        <div>
          <h3 className="font-semibold">Deploy to Office Workflow</h3>
          <p className="text-sm text-gray-500">Send clean patent data into reports, sheets, or team review.</p>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {['Top 100 CSV export', 'Google Patents links', 'Espacenet deep links', 'AI summary on demand'].map((item) => (
          <div key={item} className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2 text-sm">
            {item}
            <Check className="h-4 w-4 text-blue-600" />
          </div>
        ))}
      </div>
      <Button className="mt-5 w-full rounded-full bg-black">Export Now</Button>
    </>
  );
}
