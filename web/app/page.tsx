'use client';

import { useState } from 'react';
import { Search, Sparkles, Loader2, BookOpen, BrainCircuit, Code, Terminal } from 'lucide-react';
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
  const [generatedQuery, setGeneratedQuery] = useState<string>(''); // Store the JSON query
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedPatent, setSelectedPatent] = useState<Patent | null>(null);
  const [useAI, setUseAI] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);
    setResults([]); 
    setGeneratedQuery(''); // Reset query display

    try {
      const response = await searchPatentsAction(query, useAI);
      setResults(response.data.patents || []);
      setGeneratedQuery(response.generatedQuery);
    } catch (error) {
      console.error("Search failed", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="border-b bg-white dark:bg-slate-900 sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-xl text-primary cursor-pointer" onClick={() => {setHasSearched(false); setQuery(""); setResults([]); setGeneratedQuery("")}}>
                <div className="bg-primary text-primary-foreground p-1 rounded-md">
                    <BookOpen className="w-5 h-5" />
                </div>
                PatentsView AI
            </div>
            <div className="text-sm text-muted-foreground hidden sm:block">
                Powered by Gemini & PatentsView
            </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        
        {/* Search Hero Section */}
        <div className={`transition-all duration-500 ease-in-out flex flex-col items-center ${hasSearched ? 'py-4' : 'py-20 md:py-32'}`}>
            <h1 className={`text-3xl md:text-5xl font-bold text-center mb-6 tracking-tight ${hasSearched ? 'hidden' : 'block'}`}>
                Khám phá thế giới <span className="text-primary">Sáng chế</span>
            </h1>
            <p className={`text-muted-foreground text-center mb-8 max-w-2xl ${hasSearched ? 'hidden' : 'block'}`}>
                Hệ thống tra cứu dữ liệu sở hữu trí tuệ toàn cầu. <br/>
                Sử dụng chế độ thông minh để tìm kiếm theo ngôn ngữ tự nhiên.
            </p>

            <div className="w-full max-w-2xl flex flex-col gap-4">
                <form onSubmit={handleSearch} className="relative group w-full">
                    {useAI ? (
                        // AI Mode: Simple Input
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
                        // Standard Mode: Textarea for JSON or Input
                        <div className="relative">
                             <div className="absolute top-4 left-3 flex items-start pointer-events-none">
                                <Search className={`w-5 h-5 ${loading ? 'text-primary' : 'text-muted-foreground'}`} />
                            </div>
                            <Textarea 
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder='Nhập từ khóa hoặc JSON Query chuẩn (VD: {"_text_any": {"patent_title": "camera"}})'
                                className="pl-10 min-h-[56px] text-lg shadow-sm rounded-xl resize-y border-slate-200 dark:border-slate-800 pt-3.5"
                                disabled={loading}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSearch(e);
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

                {/* Query Viewer Section */}
                {generatedQuery && hasSearched && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-2 rounded-md border border-slate-200 bg-slate-50 dark:bg-slate-900 overflow-hidden"
                    >
                        <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 text-xs font-mono text-muted-foreground flex items-center gap-2 border-b">
                            <Terminal className="w-3 h-3" />
                            {useAI ? "Gemini Generated Query (JSON)" : "Sent Query (JSON)"}
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

        {/* Results Section */}
        <AnimatePresence>
            {hasSearched && (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mt-8"
                >
                    <div className="flex items-center justify-between mb-6 border-b pb-4">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            Kết quả tìm kiếm
                        </h2>
                        <span className="text-muted-foreground text-sm">
                            {loading ? "Đang tải..." : `${results.length} kết quả`}
                        </span>
                    </div>

                    {results.length === 0 && !loading ? (
                        <div className="text-center py-20 text-muted-foreground bg-white dark:bg-slate-900 rounded-lg border border-dashed flex flex-col items-center gap-2">
                            <Search className="w-10 h-10 text-slate-300" />
                            <p>Không tìm thấy kết quả nào phù hợp.</p>
                            <p className="text-sm text-slate-400">Hãy kiểm tra lại cú pháp Query hoặc thử từ khóa khác.</p>
                        </div>
                    ) : (
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