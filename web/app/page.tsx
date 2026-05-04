'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronDown,
  Database,
  Download,
  FileSearch,
  Globe2,
  Loader2,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Terminal,
  Users,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveTab((current) => {
        const index = demoTabs.findIndex((tab) => tab.id === current);
        return demoTabs[(index + 1) % demoTabs.length].id;
      });
    }, 4000);

    return () => window.clearInterval(timer);
  }, []);

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
    } catch (searchError) {
      console.error('Search failed', searchError);
      setError('Không thể hoàn tất truy vấn lúc này. Hãy kiểm tra API key, cú pháp truy vấn hoặc thử lại sau.');
      setResults([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
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
            {['Solutions', 'For IP Teams'].map((item) => (
              <button key={item} className="flex items-center gap-1 text-sm text-gray-700 transition-colors hover:text-black">
                {item}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            ))}
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

          <form onSubmit={(event) => handleSearch(event, 1)} className="animate-fade-in-up mx-auto mt-8 max-w-3xl opacity-0" style={{ animationDelay: '0.5s' }}>
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
                <Button type="submit" className="absolute bottom-3 right-3 rounded-full bg-black px-6 text-white hover:bg-gray-800" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {loading ? 'Đang tìm...' : 'Ask AI'}
                </Button>
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
                    </div>
                  )}
                </div>

                {!loading && results.length > 0 && (
                  <Button variant="outline" className="gap-2 rounded-full" onClick={() => handleExport(totalCount > results.length ? 'top100' : 'current')} disabled={isExporting}>
                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {isExporting ? 'Đang xử lý...' : totalCount > results.length ? 'Xuất Top 100' : 'Xuất CSV'}
                  </Button>
                )}
              </div>

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
                    {results.map((patent, index) => (
                      <motion.div key={patent.patent_id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
                        <PatentCard patent={patent} onClick={setSelectedPatent} />
                      </motion.div>
                    ))}
                  </div>

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
