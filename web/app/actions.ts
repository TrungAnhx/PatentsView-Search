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

    // --- STEP 1: PREPARE QUERIES ---
    if (useAI && process.env.GEMINI_API_KEY) {
        // AI MODE: Generate both CQL (for EPO) and JSON (for PatentsView)
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
        
        // For PatentsView, we use a broad text search based on original query
        pvQueryObject = {
             "_or": [
                { "_text_any": { "patent_title": userQuery } },
                { "_text_any": { "patent_abstract": userQuery } },
                { "_text_any": { "assignees.assignee_organization": userQuery } }
            ]
        };

    } else {
        // --- STANDARD MODE (Manual Input) ---
        const countryRegex = /\b(pn|office)=([a-zA-Z]{2})\b/i;
        const cqlRegex = /\b([a-z]{2,3})=([a-zA-Z0-9\s]+)\b/g;
        
        if (countryRegex.test(userQuery)) {
             finalQuery = userQuery.replace(/office=/i, 'pn=');
             epoQuery = finalQuery;
             pvQueryObject = { "_text_any": { "patent_title": "NON_US_SEARCH_SKIP" } };
             queryToDisplay = `// Country Search:\n${finalQuery}`;
        } 
        else if (cqlRegex.test(userQuery)) {
            let keyword = "";
            userQuery.replace(cqlRegex, (match, field, value) => {
                keyword = value.trim().replace(/^"|"$/g, '');
                return match;
            });
            
            // Broaden EPO Query
            let field = "";
            userQuery.replace(cqlRegex, (match, f, v) => { field = f; return match; });
            
            if (field === 'pa') {
                epoQuery = `(pa any "${keyword}" OR in any "${keyword}")`;
            } else {
                epoQuery = `txt all "${keyword}"`;
            }
            
            pvQueryObject = {
                 "_or": [
                    { "_text_any": { "patent_title": keyword } },
                    { "_text_any": { "patent_abstract": keyword } },
                    { "_text_any": { "assignees.assignee_organization": keyword } }
                ]
            };
            queryToDisplay = `// Broad Search:\nEPO: ${epoQuery}`;

        } else {
            epoQuery = `txt all "${userQuery}"`;
            pvQueryObject = {
                 "_or": [
                    { "_text_any": { "patent_title": userQuery } },
                    { "_text_any": { "patent_abstract": userQuery } },
                    { "_text_any": { "assignees.assignee_organization": userQuery } }
                ]
            };
            queryToDisplay = `// Broad Search:\n${epoQuery}`;
        }
    }

    // --- STEP 2: EXECUTE IN PARALLEL ---
    console.log(`🚀 Searching... EPO: [${epoQuery}] Page: ${page}`);
    
    // Skip PV for page > 1 to avoid complexity and focus on EPO pagination
    const [epoResult, pvResult] = await Promise.allSettled([
        searchEPO(epoQuery, page),
        page === 1 ? executePatentsViewQuery(pvQueryObject) : Promise.resolve({ patents: [], count: 0, total_patent_count: 0 })
    ]);

    const epoPatents = epoResult.status === 'fulfilled' ? epoResult.value.patents : [];
    const pvPatents = pvResult.status === 'fulfilled' ? (pvResult.value as PatentsViewResponse).patents : [];

    console.log(`📊 Results: EPO=${epoPatents.length}, PV=${pvPatents.length}`);

    // --- STEP 3: MERGE & DEDUPLICATE ---
    const mergedMap = new Map<string, Patent>();

    epoPatents.forEach(p => {
        const key = p.patent_number.replace(/[^a-zA-Z0-9]/g, '');
        mergedMap.set(key, p);
    });

    pvPatents.forEach(p => {
        const key = p.patent_number.replace(/[^a-zA-Z0-9]/g, '');
        if (!mergedMap.has(key)) mergedMap.set(key, p);
    });

    const finalPatents = Array.from(mergedMap.values());
    
    const epoTotal = epoResult.status === 'fulfilled' ? epoResult.value.total_patent_count : 0;
    const pvTotal = pvResult.status === 'fulfilled' ? (pvResult.value as PatentsViewResponse).total_patent_count : 0;
    const grandTotal = Math.max(epoTotal, pvTotal);

    return {
        data: {
            patents: finalPatents,
            count: finalPatents.length,
            total_patent_count: grandTotal
        },
        generatedQuery: queryToDisplay,
        source: 'Mixed'
    };

  } catch (error: any) {
    console.error('CRITICAL ERROR in searchPatentsAction:', error);
    throw new Error(`Search Failed: ${error.message || String(error)}`);
  }
}

async function executePatentsViewQuery(queryObject: any) {
    const apiUrl = 'https://search.patentsview.org/api/v1/patent/';
    try {
        const queryString = JSON.stringify(queryObject);
        if (queryString.includes("NON_US_SEARCH_SKIP")) return { patents: [], count: 0, total_patent_count: 0 };

        const response = await axios.get(apiUrl, {
            params: {
                q: queryString,
                size: 25, 
                include: "patent_id,patent_number,patent_title,patent_abstract,patent_date,inventors,assignees" 
            },
            headers: {
                "X-Api-Key": process.env.NEXT_PUBLIC_PATENTSVIEW_API_KEY || "",
                "Accept": "application/json"
            }
        });

        const rawPatents = response.data.patents || [];
        const mappedPatents: Patent[] = rawPatents.map((p: any) => ({
            patent_id: p.patent_id || p.id,
            patent_number: p.patent_number || p.number || "N/A",
            patent_title: p.patent_title || p.title || "No Title",
            patent_abstract: p.patent_abstract || p.abstract || "No Abstract Available",
            patent_date: p.patent_date || p.date || "N/A",
            inventors: p.inventors?.map((i: any) => ({
                inventor_id: i.inventor_id || i.id,
                inventor_first_name: i.inventor_first_name || i.first_name || "",
                inventor_last_name: i.inventor_last_name || i.last_name || ""
            })) || [],
            assignees: p.assignees?.map((a: any) => ({
                assignee_id: a.assignee_id || a.id,
                assignee_organization: a.assignee_organization || a.organization || "Unknown",
                assignee_first_name: a.assignee_first_name,
                assignee_last_name: a.assignee_last_name
            })) || [],
            source: 'PatentsView'
        }));

        return {
            patents: mappedPatents,
            count: response.data.count || mappedPatents.length,
            total_patent_count: response.data.total_patent_count || 0
        } as PatentsViewResponse;
    } catch (apiError: any) {
        console.error("PatentsView Error:", apiError.message);
        return { patents: [], count: 0, total_patent_count: 0 };
    }
}

export async function analyzePatentAction(patentTitle: string, patentAbstract: string, extraContext: string = "") {
    if (!process.env.GEMINI_API_KEY) {
        return "Please provide a Gemini API Key in .env.local to use the Analysis feature.";
    }
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
        const abstractContent = patentAbstract && patentAbstract !== "No Abstract Available" && patentAbstract !== "No Abstract" 
            ? patentAbstract 
            : "Not provided in API response.";
        const prompt = `Analyze: ${patentTitle} Abs: ${abstractContent} Context: ${extraContext}`;
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        return "An error occurred during analysis.";
    }
}