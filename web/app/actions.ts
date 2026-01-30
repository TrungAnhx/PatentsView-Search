'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { PatentsViewResponse, Patent } from '@/types';
import { searchEPO } from '@/lib/epo-service';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Define a new return type that includes the query used
interface SearchResult {
    data: PatentsViewResponse;
    generatedQuery: string;
    source: 'EPO' | 'PatentsView';
}

export async function searchPatentsAction(userQuery: string, useAI: boolean = false): Promise<SearchResult> {
  try {
    let finalQuery = ""; // This will be CQL (for EPO) or JSON (fallback)
    let queryToDisplay = "";
    let searchSource: 'EPO' | 'PatentsView' = 'EPO'; // Default to EPO

    // 1. Generate Query using AI (Targeting EPO CQL)
    if (useAI && process.env.GEMINI_API_KEY) {
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
        
        const prompt = `
          You are an expert Patent Search Engineer specializing in EPO OPS (CQL Syntax).
          Your task is to convert a user's natural language query into a VALID CQL Query String.

          ### TARGET: EPO OPS API (CQL)
          - Use **CQL (Contextual Query Language)**.
          - NO JSON. Just a query string.

          ### FIELD MAPPING
          - **Title:** ti
          - **Abstract:** ab
          - **Title OR Abstract:** txt (Use this for general keywords!)
          - **Assignee (Applicant):** pa (e.g., pa="Apple")
          - **Inventor:** in (e.g., in="Jobs")
          - **Date:** pd (Format YYYYMMDD or range)
            - 2024 -> pd=2024
            - >= 2024-01-01 -> pd>=20240101
          - **Classification (CPC):** cpc

          ### EXAMPLES
          Input: "Tim don cua Apple nam 2024"
          Output: pa="Apple" AND pd=2024

          Input: "camera sensor"
          Output: txt="camera sensor"

          Input: "Sony patents about VR"
          Output: pa="Sony" AND txt="VR"
          
          Input: "assignee country la viet nam"
          Output: pa="VN" (Note: EPO maps country codes in applicant fields sometimes, but strict country search is harder. Use free text matching or rely on applicant address fields if supported. Better: pa all "VN")

          ### YOUR TASK
          Input: "${userQuery}"
          Output (CQL String Only):
        `;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            finalQuery = response.text().trim();
            // Remove markdown codes if any
            finalQuery = finalQuery.replace(/```cql/g, '').replace(/```/g, '').trim();
            queryToDisplay = finalQuery;
            console.log("AI Generated CQL Query:", finalQuery);
        } catch (geminiError) {
            console.error("Gemini Error:", geminiError);
            // Fallback to simple CQL
            finalQuery = `txt="${userQuery}"`;
            queryToDisplay = "// AI Failed, using Simple Search:\n" + finalQuery;
        }
    } else {
        // Standard Mode (User inputs CQL directly or simple text)
        // Check if looks like CQL (contains =)
        if (userQuery.includes('=') || userQuery.includes(' AND ') || userQuery.includes(' OR ')) {
            finalQuery = userQuery;
            queryToDisplay = userQuery;
        } else {
            // Simple text -> Search in text fields
            finalQuery = `txt="${userQuery}"`;
            queryToDisplay = "// Auto-converted to CQL:\n" + finalQuery;
        }
    }

    // 2. Execute Query (Try EPO First)
    try {
        console.log(`Executing EPO Search with: ${finalQuery}`);
        const epoResults = await searchEPO(finalQuery);
        
        // If results found, return them
        if (epoResults.count > 0) {
            return {
                data: epoResults,
                generatedQuery: queryToDisplay,
                source: 'EPO'
            };
        } else {
             console.log("EPO returned 0 results. Trying PatentsView as fallback...");
             throw new Error("Zero results from EPO"); // Trigger catch block to try PatentsView
        }

    } catch (epoError) {
        console.warn("EPO Search Failed or Empty. Falling back to PatentsView.", epoError);
        
        // --- FALLBACK TO PATENTSVIEW ---
        searchSource = 'PatentsView';
        
        // We need to convert the query to PatentsView JSON format (since we prepared CQL)
        // For simplicity in fallback, we just do a simple text search
        const fallbackQueryObject = {
            "_or": [
                { "_text_any": { "patent_title": userQuery } },
                { "_text_any": { "patent_abstract": userQuery } }
            ]
        };
        const pvResults = await executePatentsViewQuery(fallbackQueryObject);
        
        return {
            data: pvResults,
            generatedQuery: "// EPO Failed (" + epoError + "). Fallback to PatentsView JSON:\n" + JSON.stringify(fallbackQueryObject, null, 2),
            source: 'PatentsView'
        };
    }
  } catch (error) {
    console.error('Error in searchPatentsAction:', error);
    throw new Error('Failed to search patents.');
  }
}

// Keep existing PatentsView executor for fallback
async function executePatentsViewQuery(queryObject: any) {
    const apiUrl = 'https://search.patentsview.org/api/v1/patent/';
    try {
        const queryString = JSON.stringify(queryObject);
        const response = await axios.get(apiUrl, {
            params: {
                q: queryString,
                size: 20,
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
        console.error("PatentsView Fallback Error:", apiError.message);
        return { patents: [], count: 0, total_patent_count: 0 };
    }
}

// Keep Analysis function (Updated to use extra context)
export async function analyzePatentAction(patentTitle: string, patentAbstract: string, extraContext: string = "") {
    if (!process.env.GEMINI_API_KEY) {
        return "Please provide a Gemini API Key in .env.local to use the Analysis feature.";
    }
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
        
        const abstractContent = patentAbstract && patentAbstract !== "No Abstract Available" && patentAbstract !== "No Abstract" 
            ? patentAbstract 
            : "Not provided in API response.";
            
        const prompt = `
            Analyze the following patent based on available details.
            
            Title: ${patentTitle}
            Abstract: ${abstractContent}
            Extra Context (Assignees/Inventors/CPC): ${extraContext}

            Task:
            1. If Abstract is missing, INFER the likely technology and purpose based solely on the Title and Context.
            2. If Abstract is present, summarize it.
            
            Please provide the output in Markdown format with the following sections:
            1. **Tóm tắt (Summary)**: A concise summary (or inference) in Vietnamese.
            2. **Ứng dụng thực tế (Applications)**: Potential real-world use cases.
            3. **Đánh giá (Analysis)**: Technical analysis of the innovation.
            
            Tone: Professional, Technical yet accessible. Language: Vietnamese.
        `;

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error("Error analyzing patent:", error);
        return "An error occurred during analysis.";
    }
}