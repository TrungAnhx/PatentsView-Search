'use client';

import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Patent } from '@/types';
import { analyzePatentAction, fetchPatentDetailAction } from '@/app/actions';
import { Bot, ExternalLink, FileText, Globe, Languages, Loader2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface PatentDetailProps {
  patent: Patent | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PatentDetail({ patent, isOpen, onClose }: PatentDetailProps) {
  const [analysis, setAnalysis] = useState<{ vi: string; en: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [enrichedPatent, setEnrichedPatent] = useState<Patent | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [language, setLanguage] = useState<'vi' | 'en'>('vi');

  useEffect(() => {
    setAnalysis(null);
    setEnrichedPatent(null);
    setLanguage('vi');
  }, [patent?.patent_id]);

  useEffect(() => {
    if (!patent || !isOpen) return;

    let isCancelled = false;
    setIsLoadingDetail(true);

    fetchPatentDetailAction(patent)
      .then((detail) => {
        if (!isCancelled && detail) setEnrichedPatent(detail);
      })
      .catch((error) => {
        console.error('Detail enrichment failed', error);
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingDetail(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, patent]);

  if (!patent) return null;

  const displayPatent = enrichedPatent || patent;

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const inventors = displayPatent.inventors?.map((inventor) => `${inventor.inventor_first_name} ${inventor.inventor_last_name}`).join(', ') || 'Unknown';
      const assignees = displayPatent.assignees?.map((assignee) => assignee.assignee_organization).join(', ') || 'Unknown';
      const extraContext = `Inventors: ${inventors}. Assignees: ${assignees}.`;
      const resultJson = await analyzePatentAction(displayPatent.patent_title, displayPatent.patent_abstract, extraContext);
      setAnalysis(JSON.parse(resultJson));
    } catch (error) {
      console.error('Analysis failed', error);
      setAnalysis({ vi: 'Không thể phân tích dữ liệu lúc này.', en: 'Failed to analyze data.' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const cleanNumber = displayPatent.patent_number.replace(/[^a-zA-Z0-9]/g, '');
  const docNumber = /^[A-Za-z]{2}/.test(cleanNumber) ? cleanNumber : `US${cleanNumber}`;
  const googlePatentLink = `https://patents.google.com/patent/${docNumber}`;
  const espacenetLink = `https://worldwide.espacenet.com/patent/search?q=${cleanNumber}`;
  const activeAnalysis = analysis ? (language === 'vi' ? analysis.vi : analysis.en) : '';

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-[90vw] sm:border-l md:max-w-[1000px]">
        <div className="border-b bg-gray-50 p-6">
          <SheetHeader className="mb-4">
            <div className="mb-2 flex gap-2">
              <Badge variant="secondary">{displayPatent.patent_number}</Badge>
              <Badge variant="outline">{displayPatent.patent_date}</Badge>
              <Badge variant="outline">{displayPatent.source || 'Unknown'}</Badge>
              {isLoadingDetail && (
                <Badge variant="outline" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Đang tải chi tiết
                </Badge>
              )}
            </div>
            <SheetTitle className="text-xl leading-snug md:text-2xl">{displayPatent.patent_title}</SheetTitle>
            <SheetDescription>{displayPatent.assignees?.[0]?.assignee_organization || 'Unknown Organization'}</SheetDescription>
          </SheetHeader>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="outline" size="sm" className="h-8 gap-1 rounded-full text-xs" asChild>
              <a href={googlePatentLink} target="_blank" rel="noopener noreferrer">
                <Globe className="h-3 w-3" />
                Google Patents
              </a>
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1 rounded-full text-xs" asChild>
              <a href={espacenetLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3" />
                Espacenet
              </a>
            </Button>
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <Tabs defaultValue="details" className="flex h-full flex-1 flex-col">
            <div className="border-b px-6 pt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details" className="gap-2">
                  <FileText className="h-4 w-4" /> Chi tiết
                </TabsTrigger>
                <TabsTrigger value="analysis" className="gap-2 text-black data-[state=active]:bg-gray-100">
                  <Sparkles className="h-4 w-4" /> Phân tích AI
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="details" className="m-0 flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full">
                <div className="space-y-6 p-6">
                  <section>
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">Tóm tắt</h3>
                    <p className="text-sm leading-7 text-gray-700">
                      {displayPatent.patent_abstract && displayPatent.patent_abstract !== 'No Abstract Available' && displayPatent.patent_abstract !== 'No Abstract' ? (
                        displayPatent.patent_abstract
                      ) : (
                        <span className="italic text-gray-500">
                          Dữ liệu tóm tắt chưa được API trả về. Vui lòng xem chi tiết tại Google Patents hoặc Espacenet.
                        </span>
                      )}
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">Nhà sáng chế</h3>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {displayPatent.inventors?.length ? displayPatent.inventors.map((inventor, index) => (
                        <div key={`${inventor.inventor_id}-${index}`} className="rounded-lg border bg-gray-50 p-2 text-sm">
                          {inventor.inventor_first_name} {inventor.inventor_last_name}
                        </div>
                      )) : <p className="text-sm text-gray-500">Chưa có dữ liệu nhà sáng chế.</p>}
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">Chủ sở hữu</h3>
                    <div className="space-y-2">
                      {displayPatent.assignees?.length ? displayPatent.assignees.map((assignee, index) => (
                        <div key={`${assignee.assignee_id}-${index}`} className="text-sm">
                          <div className="font-medium">{assignee.assignee_organization}</div>
                          <div className="text-xs text-gray-500">{assignee.assignee_first_name} {assignee.assignee_last_name}</div>
                        </div>
                      )) : <p className="text-sm text-gray-500">Chưa có dữ liệu chủ sở hữu.</p>}
                    </div>
                  </section>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="analysis" className="m-0 flex flex-1 flex-col overflow-hidden p-0">
              <div className="flex justify-end border-b bg-gray-50 px-6 py-2">
                {analysis && (
                  <Button variant="ghost" size="sm" className="gap-2 text-xs" onClick={() => setLanguage(language === 'vi' ? 'en' : 'vi')}>
                    <Languages className="h-3.5 w-3.5" />
                    {language === 'vi' ? 'Xem English' : 'Xem tiếng Việt'}
                  </Button>
                )}
              </div>

              <ScrollArea className="flex-1">
                <div className="p-6">
                  {!analysis && !isAnalyzing ? (
                    <div className="flex h-[300px] flex-col items-center justify-center space-y-4 text-center">
                      <div className="rounded-full bg-gray-100 p-4">
                        <Bot className="h-8 w-8 text-black" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold">Khám phá nội dung sâu hơn</h3>
                        <p className="mx-auto max-w-xs text-sm text-gray-500">
                          AI sẽ tóm tắt nội dung, gợi ý ứng dụng thực tế và đánh giá hướng công nghệ của bằng sáng chế này.
                        </p>
                      </div>
                      <Button onClick={handleAnalyze} className="rounded-full bg-black hover:bg-gray-800">
                        <Sparkles className="mr-2 h-4 w-4" /> Bắt đầu phân tích
                      </Button>
                    </div>
                  ) : isAnalyzing ? (
                    <div className="flex h-[300px] flex-col items-center justify-center space-y-4">
                      <Loader2 className="h-8 w-8 animate-spin text-black" />
                      <p className="animate-pulse text-sm text-gray-500">Đang phân tích đa ngôn ngữ...</p>
                    </div>
                  ) : (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{activeAnalysis}</ReactMarkdown>
                      <div className="mt-8 flex justify-center border-t pt-4">
                        <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={isAnalyzing}>
                          <Sparkles className="mr-2 h-4 w-4" /> Phân tích lại
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
