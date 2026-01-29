'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { PatentsViewResponse, Patent } from '@/types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Define a new return type that includes the query used
interface SearchResult {
    data: PatentsViewResponse;
    generatedQuery: string;
}

export async function searchPatentsAction(userQuery: string, useAI: boolean = false): Promise<SearchResult> {
  try {
    let finalQueryObject = {};
    let queryToDisplay = "";

    if (useAI && process.env.GEMINI_API_KEY) {
        // --- AI MODE: Advanced Query Generation ---
        // SWITCH TO: 'gemini-flash-latest' (Stable alias provided in your list)
        // This avoids the 429 Rate Limit error of the experimental 2.0 model.
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
        
                const prompt = `
                  You are an expert Patent Search Engineer. Your task is to convert a user's natural language query into a specific JSON format for the PatentsView API.
        
                  ### SYSTEM RULES
                  1. **Target API:** PatentsView Search API (JSON Query).
                  2. **Output Format:** RAW JSON ONLY. No markdown, no comments, no explanations.
                  3. **Date Format:** YYYY-MM-DD.
        
                  ### DATA SCHEMA MAPPING
                  - **"Vietnam", "VN", "Tru so tai VN":** Map to {"_eq": {"assignees.assignee_country": "VN"}}
                  - **"Title" / "Tieu de":** "patent_title"
                  - **"Abstract" / "Tom tat":** "patent_abstract"
                  - **"Date" / "Ngay":** "patent_date"
                  - **"Assignee" / "Chu so huu":** "assignees.assignee_organization"
                  - **"Inventor" / "Tac gia":** "inventors.inventor_last_name"
        
                  ### EXAMPLES
                  Input: "Tim don cua Apple nam 2024"
                  Output: {"_and": [{"_text_any": {"assignees.assignee_organization": "Apple"}}, {"_gte": {"patent_date": "2024-01-01"}}, {"_lte": {"patent_date": "2024-12-31"}}]}
        
                  Input: "Tru so tai Viet Nam"
                  Output: {"_eq": {"assignees.assignee_country": "VN"}}
        
                  ### YOUR TASK
                  Convert the following Input into JSON.
        
                  Input: "${userQuery}"
                  Output:
                `;
        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            // Robust JSON Extraction: Find the first '{' and last '}'
            const jsonStart = text.indexOf('{');
            const jsonEnd = text.lastIndexOf('}');
            
            if (jsonStart !== -1 && jsonEnd !== -1) {
                const jsonStr = text.substring(jsonStart, jsonEnd + 1);
                finalQueryObject = JSON.parse(jsonStr);
                queryToDisplay = JSON.stringify(finalQueryObject, null, 2);
                console.log("AI Generated JSON Query (Success):", queryToDisplay);
            } else {
                // If extraction fails, throw to trigger fallback
                throw new Error("No JSON found in AI response");
            }

        } catch (geminiError) {
            console.error("Gemini Critical Error:", geminiError);
            // Fallback: Inform user in the query display that AI failed
            finalQueryObject = { "_text_any": { "patent_title": userQuery, "patent_abstract": userQuery } };
            queryToDisplay = `// AI GENERATION FAILED - FALLBACK TO SIMPLE SEARCH\n// Error: ${geminiError}\n\n` + JSON.stringify(finalQueryObject, null, 2);
        }
    } else {
        // --- STANDARD MODE: Raw JSON or Simple Text ---
        try {
            finalQueryObject = JSON.parse(userQuery);
            queryToDisplay = JSON.stringify(finalQueryObject, null, 2);
            console.log("User provided valid JSON.");
        } catch (e) {
            finalQueryObject = {
                "_or": [
                    { "_text_any": { "patent_title": userQuery } },
                    { "_text_any": { "patent_abstract": userQuery } },
                    { "_text_any": { "assignees.assignee_organization": userQuery } }
                ]
            };
            queryToDisplay = JSON.stringify(finalQueryObject, null, 2);
        }
    }

    // 2. Execute the query
    const results = await executePatentsViewQuery(finalQueryObject);
    
    return {
        data: results,
        generatedQuery: queryToDisplay
    };

  } catch (error) {
    console.error('Error in searchPatentsAction:', error);
    throw new Error('Failed to search patents.');
  }
}

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
            // New API seems to use patent_id as the number sometimes, or separate patent_number
            patent_number: p.patent_number || p.number || p.patent_id || "N/A",
            patent_title: p.patent_title || p.title || "No Title",
            patent_abstract: p.patent_abstract || p.abstract || "No Abstract Available",
            patent_date: p.patent_date || p.date || "N/A",
            inventors: p.inventors?.map((i: any) => ({
                inventor_id: i.inventor_id || i.id,
                // Fix: Map 'inventor_name_first' correctly
                inventor_first_name: i.inventor_first_name || i.inventor_name_first || i.first_name || "",
                inventor_last_name: i.inventor_last_name || i.inventor_name_last || i.last_name || ""
            })) || [],
            assignees: p.assignees?.map((a: any) => ({
                assignee_id: a.assignee_id || a.id,
                assignee_organization: a.assignee_organization || a.organization || "Unknown",
                assignee_first_name: a.assignee_first_name || a.assignee_individual_name_first,
                assignee_last_name: a.assignee_last_name || a.assignee_individual_name_last
            })) || []
        }));

        return {
            patents: mappedPatents,
            count: response.data.count || mappedPatents.length,
            total_patent_count: response.data.total_patent_count || response.data.count || 0
        } as PatentsViewResponse;

    } catch (apiError: any) {
        if (apiError.response) {
             console.error("PatentsView API Error Status:", apiError.response.status);
             console.error("PatentsView API Error Data:", JSON.stringify(apiError.response.data));
        } else {
             console.error("PatentsView API Message:", apiError.message);
        }
        return { patents: [], count: 0, total_patent_count: 0 };
    }
}

export async function analyzePatentAction(patentTitle: string, patentAbstract: string, extraContext: string = "") {
    if (!process.env.GEMINI_API_KEY) {
        return "Please provide a Gemini API Key in .env.local to use the Analysis feature.";
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
        
        // Handle missing abstract gracefully
        const abstractContent = patentAbstract && patentAbstract !== "No Abstract Available" && patentAbstract !== "No Abstract" 
            ? patentAbstract 
            : "Not provided in API response.";
            
        const prompt = `
            Analyze the following patent based on available details.
            
            Title: ${patentTitle}
            Abstract: ${abstractContent}
            Extra Context (Assignees/Inventors/CPC): ${extraContext}

            Task:
            1. If Abstract is missing, INFER the likely technology and purpose based solely on the Title and Context (CPC/Assignees). STATE CLEARLY that this is an inference.
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
