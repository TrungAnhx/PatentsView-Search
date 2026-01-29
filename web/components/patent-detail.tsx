'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Patent } from "@/types";
import { analyzePatentAction } from "@/app/actions";
import { Bot, FileText, Loader2, Sparkles, ExternalLink, Globe } from "lucide-react";
import ReactMarkdown from 'react-markdown';

interface PatentDetailProps {
  patent: Patent | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PatentDetail({ patent, isOpen, onClose }: PatentDetailProps) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  if (!patent) return null;

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
        // Construct extra context string from available data
        const inventors = patent.inventors?.map(i => `${i.inventor_first_name} ${i.inventor_last_name}`).join(", ") || "Unknown";
        const assignees = patent.assignees?.map(a => a.assignee_organization).join(", ") || "Unknown";
        
        const extraContext = `Inventors: ${inventors}. Assignees: ${assignees}.`;
        
        const result = await analyzePatentAction(patent.patent_title, patent.patent_abstract, extraContext);
        setAnalysis(result);
    } catch (error) {
        console.error("Analysis failed", error);
        setAnalysis("Failed to analyze patent. Please try again.");
    } finally {
        setIsAnalyzing(false);
    }
  };

  // Generate External Links
  // Note: Patent number might contain "US" prefix or commas, strip them for safety if needed
  // But usually PatentsView returns clean numbers.
  const cleanNumber = patent.patent_number.replace(/,/g, '').replace(/^US/, '');
  
  const googlePatentLink = `https://patents.google.com/patent/US${cleanNumber}/en`;
  const espacenetLink = `https://worldwide.espacenet.com/publicationDetails/biblio?CC=US&NR=${cleanNumber}&KC=&FT=D`;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px] md:w-[700px] overflow-y-auto flex flex-col p-0 gap-0">
        <div className="p-6 border-b bg-muted/20">
            <SheetHeader className="mb-4">
                <div className="flex gap-2 mb-2">
                    <Badge variant="secondary">{patent.patent_number}</Badge>
                    <Badge variant="outline">{patent.patent_date}</Badge>
                </div>
                <SheetTitle className="text-xl md:text-2xl leading-snug">{patent.patent_title}</SheetTitle>
                <SheetDescription>
                    {patent.assignees?.[0]?.assignee_organization || "Unknown Organization"}
                </SheetDescription>
            </SheetHeader>
            
            <div className="flex gap-3 mt-4">
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" asChild>
                    <a href={googlePatentLink} target="_blank" rel="noopener noreferrer">
                        <Globe className="w-3 h-3" />
                        Google Patents
                    </a>
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" asChild>
                    <a href={espacenetLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3 h-3" />
                        Espacenet
                    </a>
                </Button>
            </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
            <Tabs defaultValue="details" className="flex-1 flex flex-col h-full">
                <div className="px-6 pt-4 border-b">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="details" className="gap-2">
                            <FileText className="w-4 h-4" /> Chi tiết
                        </TabsTrigger>
                        <TabsTrigger value="analysis" className="gap-2 text-indigo-600 data-[state=active]:text-indigo-700 data-[state=active]:bg-indigo-50">
                            <Sparkles className="w-4 h-4" /> Phân tích AI
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="details" className="flex-1 p-0 m-0 overflow-hidden">
                    <ScrollArea className="h-full">
                        <div className="p-6 space-y-6">
                            <section>
                                <h3 className="font-semibold mb-2 text-sm uppercase tracking-wider text-muted-foreground">Tóm tắt (Abstract)</h3>
                                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                                    {patent.patent_abstract && patent.patent_abstract !== "No Abstract Available" 
                                        ? patent.patent_abstract 
                                        : <span className="text-muted-foreground italic">Dữ liệu tóm tắt chưa được API cập nhật. Vui lòng xem chi tiết tại link Google Patents phía trên.</span>
                                    }
                                </p>
                            </section>
                            
                            <Separator />

                            <section>
                                <h3 className="font-semibold mb-2 text-sm uppercase tracking-wider text-muted-foreground">Nhà sáng chế (Inventors)</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {patent.inventors?.map((inv, idx) => (
                                        <div key={inv.inventor_id || idx} className="text-sm p-2 bg-slate-50 dark:bg-slate-900 rounded border">
                                            {inv.inventor_first_name} {inv.inventor_last_name}
                                        </div>
                                    ))}
                                </div>
                            </section>

                             <section>
                                <h3 className="font-semibold mb-2 text-sm uppercase tracking-wider text-muted-foreground">Chủ sở hữu (Assignees)</h3>
                                <div className="space-y-2">
                                    {patent.assignees?.map((asg, idx) => (
                                        <div key={asg.assignee_id || idx} className="text-sm">
                                            <div className="font-medium">{asg.assignee_organization}</div>
                                            <div className="text-xs text-muted-foreground">{asg.assignee_first_name} {asg.assignee_last_name}</div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="analysis" className="flex-1 p-0 m-0 overflow-hidden flex flex-col">
                    <ScrollArea className="h-full">
                        <div className="p-6">
                            {!analysis && !isAnalyzing ? (
                                <div className="flex flex-col items-center justify-center h-[300px] text-center space-y-4">
                                    <div className="p-4 bg-indigo-50 rounded-full">
                                        <Bot className="w-8 h-8 text-indigo-600" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="font-semibold text-lg">Khám phá nội dung sâu hơn</h3>
                                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                            Sử dụng AI để tóm tắt nội dung, phân tích ứng dụng thực tế và đánh giá công nghệ dựa trên thông tin sẵn có.
                                        </p>
                                    </div>
                                    <Button onClick={handleAnalyze} className="bg-indigo-600 hover:bg-indigo-700">
                                        <Sparkles className="w-4 h-4 mr-2" /> Bắt đầu phân tích
                                    </Button>
                                </div>
                            ) : isAnalyzing ? (
                                <div className="flex flex-col items-center justify-center h-[300px] space-y-4">
                                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                                    <p className="text-sm text-muted-foreground animate-pulse">Đang suy luận và phân tích...</p>
                                </div>
                            ) : (
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                    <ReactMarkdown>{analysis || ""}</ReactMarkdown>
                                    <div className="mt-8 pt-4 border-t flex justify-center">
                                         <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={isAnalyzing}>
                                            <Sparkles className="w-4 h-4 mr-2" /> Phân tích lại
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </TabsContent>
            </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}