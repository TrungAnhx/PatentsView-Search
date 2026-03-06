'use client';

import { useState } from 'react';
import { Search, Sparkles, Loader2, BookOpen, BrainCircuit, Terminal, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; 
import { PatentCard } from '@/components/patent-card';
import { PatentDetail } from '@/components/patent-detail';
import { searchPatentsAction } from './actions';
import { Patent } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Patent[]>([]);
  const [totalCount, setTotalCount] = useState(0); 
  const [page, setPage] = useState(1);
  const [generatedQuery, setGeneratedQuery] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedPatent, setSelectedPatent] = useState<Patent | null>(null);
  const [useAI, setUseAI] = useState(false);

  const handleSearch = async (e: React.FormEvent, newPage: number = 1) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);
    if (newPage === 1) setResults([]); 
    
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const response = await searchPatentsAction(query, useAI, newPage);
      setResults(response.data.patents || []);
      setTotalCount(response.data.total_patent_count || 0); 
      setGeneratedQuery(response.generatedQuery);
      setPage(newPage);
    } catch (error) {
      console.error("Search failed", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (results.length === 0) return;

    // Define CSV headers
    const headers = ["Patent Number", "Title", "Date", "Assignee", "Inventors", "Source", "Link"];
    
    // Map results to CSV rows
    const csvRows = results.map(p => {
      const assignee = p.assignees?.[0]?.assignee_organization || "N/A";
      const inventors = p.inventors?.map(i => `${i.inventor_first_name} ${i.inventor_last_name}`).join("; ") || "N/A";
      const cleanNumber = p.patent_number.replace(/[^a-zA-Z0-9]/g, '');
      const link = `https://patents.google.com/patent/US${cleanNumber}`;
      
      return [
        `"${p.patent_number}"`,
        `"${p.patent_title.replace(/"/g, '""')}"`,
        `"${p.patent_date}"`,
        `"${assignee.replace(/"/g, '""')}"`,
        `"${inventors.replace(/"/g, '""')}"`,
        `"${p.source}"`,
        `"${link}"`
      ].join(",");
    });

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `patents_export_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const onNextPage = () => handleSearch(null as any, page + 1);
  const onPrevPage = () => handleSearch(null as any, Math.max(1, page - 1));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <header className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div 
                className="flex items-center gap-2 font-black text-2xl tracking-tighter cursor-pointer group" 
                onClick={() => {setHasSearched(false); setQuery(""); setResults([]); setTotalCount(0); setPage(1); setGeneratedQuery("")}}
            >
                <div className="bg-gradient-to-tr from-primary to-indigo-600 text-primary-foreground p-1.5 rounded-xl shadow-indigo-200 shadow-lg group-hover:scale-110 transition-transform">
                    <Sparkles className="w-6 h-6 fill-current" />
                </div>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                    Patent<span className="text-indigo-600">Sphere</span>
                </span>
            </div>
            <div className="hidden md:flex items-center gap-6">
                <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 border-l pl-4">
                    Global Intelligence <br/> Engine v1.0
                </div>
            </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        
        <div className={`transition-all duration-500 ease-in-out flex flex-col items-center ${hasSearched ? 'py-4' : 'py-20 md:py-32'}`}>
            <h1 className={`text-3xl md:text-5xl font-bold text-center mb-6 tracking-tight ${hasSearched ? 'hidden' : 'block'}`}>
                Khám phá <span className="text-primary">PatentSphere</span>
            </h1>
            <p className={`text-muted-foreground text-center mb-8 max-w-2xl ${hasSearched ? 'hidden' : 'block'}`}>
                Hệ thống tra cứu dữ liệu sở hữu trí tuệ toàn cầu. <br/>
                Sử dụng sức mạnh của AI để tìm kiếm và phân tích hàng triệu bằng sáng chế.
            </p>

            <div className="w-full max-w-2xl flex flex-col gap-4">
                <form onSubmit={(e) => handleSearch(e, 1)} className="relative group w-full">
                    {useAI ? (
                        <div className="relative">
                            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                <BrainCircuit className={`w-5 h-5 ${loading ? 'text-indigo-500 animate-pulse' : 'text-indigo-500'}`} />
                            </div>
                            <Input 
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Ví dụ: Tìm bằng sáng chế của Apple về màn hình năm 2023..."
                                className="pl-10 h-14 text-lg shadow-sm rounded-full border-indigo-200 bg-indigo-50/30 focus-visible:ring-indigo-500"
                                disabled={loading}
                            />
                             <Button 
                                type="submit" 
                                className="absolute right-2 top-2 bottom-2 rounded-full px-6 bg-indigo-600 hover:bg-indigo-700"
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                                {loading ? "Đang tìm..." : "Hỏi AI"}
                            </Button>
                        </div>
                    ) : (
                        <div className="relative">
                             <div className="absolute top-4 left-3 flex items-start pointer-events-none">
                                <Search className={`w-5 h-5 ${loading ? 'text-primary' : 'text-muted-foreground'}`} />
                            </div>
                            <Textarea 
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder='Nhập từ khóa (vd: pa=Apple) hoặc JSON Query chuẩn'
                                className="pl-10 min-h-[56px] text-lg shadow-sm rounded-xl resize-y border-slate-200 dark:border-slate-800 pt-3.5"
                                disabled={loading}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSearch(e, 1);
                                    }
                                }}
                            />
                            <Button 
                                type="submit" 
                                className="absolute right-2 bottom-2 rounded-lg px-4"
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            </Button>
                        </div>
                    )}
                </form>

                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center space-x-2">
                        <Switch 
                            id="ai-mode" 
                            checked={useAI}
                            onCheckedChange={setUseAI}
                        />
                        <Label htmlFor="ai-mode" className="cursor-pointer flex items-center gap-2 select-none">
                            {useAI ? (
                                <span className="text-indigo-600 font-semibold flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" /> Chế độ thông minh (AI) đang bật
                                </span>
                            ) : (
                                <span className="text-muted-foreground text-sm">Bật chế độ AI để hỗ trợ tạo Query</span>
                            )}
                        </Label>
                    </div>
                </div>

                {generatedQuery && hasSearched && useAI && (
                    <motion.div  
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-2 rounded-md border border-slate-200 bg-slate-50 dark:bg-slate-900 overflow-hidden"
                    >
                        <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 text-xs font-mono text-muted-foreground flex items-center gap-2 border-b">
                            <Terminal className="w-3 h-3" />
                            {useAI ? "Gemini Generated Query (CQL)" : "Sent Query"}
                        </div>
                        <div className="p-4 overflow-x-auto">
                            <pre className="text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all">
                                {generatedQuery}
                            </pre>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>

        <AnimatePresence>
            {hasSearched && (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mt-8 pb-20"
                >
                    <div className="flex items-center justify-between mb-6 border-b pb-4">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                Kết quả tìm kiếm
                            </h2>
                            <span className="text-muted-foreground text-sm">
                                {loading ? "Đang tải..." : `Tìm thấy ${totalCount > 0 ? totalCount.toLocaleString() : results.length} kết quả (Trang ${page})`}
                            </span>
                        </div>
                        
                        {!loading && results.length > 0 && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="gap-2"
                                onClick={handleExport}
                            >
                                <Download className="w-4 h-4" />
                                Xuất CSV
                            </Button>
                        )}
                    </div>

                    {results.length === 0 && !loading ? (
                        <div className="text-center py-20 text-muted-foreground bg-white dark:bg-slate-900 rounded-lg border border-dashed flex flex-col items-center gap-2">
                            <Search className="w-10 h-10 text-slate-300" />
                            <p>Không tìm thấy kết quả nào phù hợp.</p>
                            <p className="text-sm text-slate-400">Hãy kiểm tra lại cú pháp Query hoặc thử từ khóa khác.</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {results.map((patent, index) => (
                                    <motion.div
                                        key={patent.patent_id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                    >
                                        <PatentCard 
                                            patent={patent} 
                                            onClick={setSelectedPatent} 
                                        />
                                    </motion.div>
                                ))}
                            </div>

                            {(results.length >= 20 || page > 1) && (
                                <div className="flex justify-center items-center gap-4 mt-10">
                                    <Button 
                                        variant="outline" 
                                        onClick={onPrevPage} 
                                        disabled={page <= 1 || loading}
                                    >
                                        &laquo; Trang trước
                                    </Button>
                                    <span className="text-sm font-medium">Trang {page}</span>
                                    <Button 
                                        variant="outline" 
                                        onClick={onNextPage} 
                                        disabled={loading || results.length < 20}
                                    >
                                        Trang sau &raquo;
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
      </main>

      <PatentDetail 
        patent={selectedPatent} 
        isOpen={!!selectedPatent} 
        onClose={() => setSelectedPatent(null)} 
      />
    </div>
  );
}
