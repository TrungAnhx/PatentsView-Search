'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { PatentsViewResponse, Patent } from '@/types';
import { searchEPO } from '@/lib/epo-service';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface SearchResult {
    data: PatentsViewResponse;
    generatedQuery: string;
    source: 'EPO' | 'PatentsView' | 'Mixed';
}

export async function searchPatentsAction(userQuery: string, useAI: boolean = false, page: number = 1): Promise<SearchResult> {
  try {
    let epoQuery = "";
    let finalQuery = ""; 
    let pvQueryObject: any = {};
    let queryToDisplay = "";

    if (useAI && process.env.GEMINI_API_KEY) {
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
        const prompt = `
          Translate user query to EPO CQL syntax.
          User Query: "${userQuery}"
          Output CQL only.
          Mapping: Title->ti, Abstract->ab, Keyword->txt, Assignee->pa, Inventor->in, Date->pd (YYYYMMDD), Filed Country->pn.
          Example: "Apple 2024" -> pa="Apple" AND pd=2024
        `;
        try {
            const result = await model.generateContent(prompt);
            let cql = result.response.text().trim();
            cql = cql.replace(/^```cql|```$/g, '').trim();
            epoQuery = cql;
            queryToDisplay = cql;
        } catch (e) {
            epoQuery = `txt="${userQuery}"`;
            queryToDisplay = `// AI Failed, using: ${epoQuery}`;
        }
        pvQueryObject = { "_or": [{ "_text_any": { "patent_title": userQuery } }, { "_text_any": { "patent_abstract": userQuery } }, { "_text_any": { "assignees.assignee_organization": userQuery } }] };
    } else {
        const countryRegex = /\b(pn|office)=([a-zA-Z]{2})\b/i;
        const cqlRegex = /\b([a-z]{2,3})=([a-zA-Z0-9\s]+)\b/g;
        if (countryRegex.test(userQuery)) {
             finalQuery = userQuery.replace(/office=/i, 'pn=');
             epoQuery = finalQuery;
             pvQueryObject = { "_text_any": { "patent_title": "NON_US_SEARCH_SKIP" } };
             queryToDisplay = `// Country Search:\n${finalQuery}`;
        } else if (cqlRegex.test(userQuery)) {
            let keyword = "";
            let field = "";
            userQuery.replace(cqlRegex, (match, f, v) => { field = f; keyword = v.trim().replace(/^"|"$/g, ''); return match; });
            epoQuery = field === 'pa' ? `(pa any "${keyword}" OR in any "${keyword}")` : `txt all "${keyword}"`;
            pvQueryObject = { "_or": [{ "_text_any": { "patent_title": keyword } }, { "_text_any": { "patent_abstract": keyword } }, { "_text_any": { "assignees.assignee_organization": keyword } }] };
            queryToDisplay = `// Broad Search:\nEPO: ${epoQuery}`;
        } else {
            epoQuery = `txt all "${userQuery}"`;
            pvQueryObject = { "_or": [{ "_text_any": { "patent_title": userQuery } }, { "_text_any": { "patent_abstract": userQuery } }, { "_text_any": { "assignees.assignee_organization": userQuery } }] };
            queryToDisplay = `// Broad Search:\n${epoQuery}`;
        }
    }

    const [epoResult, pvResult] = await Promise.allSettled([
        searchEPO(epoQuery, page),
        page === 1 ? executePatentsViewQuery(pvQueryObject) : Promise.resolve({ patents: [], count: 0, total_patent_count: 0 })
    ]);

    const epoPatents = epoResult.status === 'fulfilled' ? epoResult.value.patents : [];
    const pvPatents = pvResult.status === 'fulfilled' ? (pvResult.value as PatentsViewResponse).patents : [];

    const mergedMap = new Map<string, Patent>();
    epoPatents.forEach(p => mergedMap.set(p.patent_number.replace(/[^a-zA-Z0-9]/g, ''), p));
    pvPatents.forEach(p => {
        const key = p.patent_number.replace(/[^a-zA-Z0-9]/g, '');
        if (!mergedMap.has(key)) mergedMap.set(key, p);
    });

    const finalPatents = Array.from(mergedMap.values());
    const epoTotal = epoResult.status === 'fulfilled' ? epoResult.value.total_patent_count : 0;
    const pvTotal = pvResult.status === 'fulfilled' ? (pvResult.value as PatentsViewResponse).total_patent_count : 0;
    const grandTotal = Math.max(epoTotal, pvTotal);

    return {
        data: { patents: finalPatents, count: finalPatents.length, total_patent_count: grandTotal },
        generatedQuery: queryToDisplay,
        source: 'Mixed'
    };
  } catch (error: any) {
    console.error('CRITICAL ERROR:', error);
    throw new Error(`Search Failed: ${error.message}`);
  }
}

async function executePatentsViewQuery(queryObject: any) {
    const apiUrl = 'https://search.patentsview.org/api/v1/patent/';
    try {
        const queryString = JSON.stringify(queryObject);
        if (queryString.includes("NON_US_SEARCH_SKIP")) return { patents: [], count: 0, total_patent_count: 0 };
        const response = await axios.get(apiUrl, {
            params: { q: queryString, size: 25, include: "patent_id,patent_number,patent_title,patent_abstract,patent_date,inventors,assignees" },
            headers: { "X-Api-Key": process.env.NEXT_PUBLIC_PATENTSVIEW_API_KEY || "", "Accept": "application/json" }
        });
        const rawPatents = response.data.patents || [];
        const mappedPatents: Patent[] = rawPatents.map((p: any) => ({
            patent_id: p.patent_id || p.id, patent_number: p.patent_number || p.number || "N/A", patent_title: p.patent_title || p.title || "No Title",
            patent_abstract: p.patent_abstract || p.abstract || "No Abstract Available", patent_date: p.patent_date || p.date || "N/A",
            inventors: p.inventors?.map((i: any) => ({ inventor_id: i.inventor_id || i.id, inventor_first_name: i.inventor_first_name || i.first_name || "", inventor_last_name: i.inventor_last_name || i.last_name || "" })) || [],
            assignees: p.assignees?.map((a: any) => ({ assignee_id: a.assignee_id || a.id, assignee_organization: a.assignee_organization || a.organization || "Unknown", assignee_first_name: a.assignee_first_name, assignee_last_name: a.assignee_last_name })) || [],
            source: 'PatentsView'
        }));
        return { patents: mappedPatents, count: response.data.count || mappedPatents.length, total_patent_count: response.data.total_patent_count || 0 };
    } catch (apiError: any) {
        return { patents: [], count: 0, total_patent_count: 0 };
    }
}

export async function analyzePatentAction(patentTitle: string, patentAbstract: string, extraContext: string = "") {
    if (!process.env.GEMINI_API_KEY) {
        return JSON.stringify({ vi: "Vui lòng cung cấp Gemini API Key.", en: "Please provide Gemini API Key." });
    }
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
        const abstractContent = patentAbstract && patentAbstract !== "No Abstract Available" && patentAbstract !== "No Abstract" ? patentAbstract : "Not provided in API response.";
        const prompt = `
            Analyze the following patent and provide results in BOTH Vietnamese and English.
            Title: ${patentTitle}
            Abstract: ${abstractContent}
            Extra Context: ${extraContext}

            Task: Provide a comprehensive summary, applications, and technical evaluation.
            OUTPUT FORMAT: Return a VALID JSON object with keys "vi" and "en". Each value is Markdown content.
            Example: {"vi": "...", "en": "..."}
            RETURN ONLY THE JSON. NO MARKDOWN BLOCKS.
        `;
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
            return text.substring(jsonStart, jsonEnd + 1);
        }
        throw new Error("Invalid AI Response");
    } catch (error) {
        return JSON.stringify({ vi: "Lỗi khi phân tích.", en: "Error during analysis." });
    }
}
