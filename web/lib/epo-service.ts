import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { Patent, PatentsViewResponse } from '@/types';

// EPO OPS Credentials (Load from Env)
const EPO_CONSUMER_KEY = process.env.EPO_CONSUMER_KEY;
const EPO_CONSUMER_SECRET = process.env.EPO_CONSUMER_SECRET;
const EPO_AUTH_URL = 'https://ops.epo.org/3.2/auth/accesstoken';
const EPO_BASE_URL = 'https://ops.epo.org/3.2/rest-services';

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * 1. Get OAuth 2.0 Access Token
 */
async function getAccessToken(): Promise<string> {
    if (!EPO_CONSUMER_KEY || !EPO_CONSUMER_SECRET) {
        throw new Error("Missing EPO Credentials in .env.local");
    }

    // Check cache
    if (cachedToken && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    try {
        const credentials = Buffer.from(`${EPO_CONSUMER_KEY}:${EPO_CONSUMER_SECRET}`).toString('base64');
        const response = await axios.post(EPO_AUTH_URL, 'grant_type=client_credentials', {
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const data = response.data;
        cachedToken = data.access_token;
        // Expires in seconds (usually 20 mins), subtract buffer
        tokenExpiry = Date.now() + (parseInt(data.expires_in) * 1000) - 60000; 
        
        return cachedToken as string;
    } catch (error: any) {
        console.error("EPO Auth Failed:", error.response?.data || error.message);
        throw new Error("Failed to authenticate with EPO OPS.");
    }
}

/**
 * 2. Search Patents (CQL Syntax)
 * Endpoint: published-data/search
 */
export async function searchEPO(cqlQuery: string, page: number = 1): Promise<PatentsViewResponse> {
    try {
        const token = await getAccessToken();
        
        // Calculate Range based on Page (50 items per page)
        // OPS Range is 1-based index
        const start = (page - 1) * 50 + 1;
        const end = page * 50;
        const rangeHeader = `${start}-${end}`;

        // Step A: Search to get List of IDs
        const searchUrl = `${EPO_BASE_URL}/published-data/search?q=${encodeURIComponent(cqlQuery)}`;
        const searchRes = await axios.get(searchUrl, {
            headers: { 
                'Authorization': `Bearer ${token}`, 
                'Accept': 'application/xml',
                'X-OPS-Range': rangeHeader
            }
        });

        const searchJson = await parseStringPromise(searchRes.data);
        
        // Extract Doc Numbers
        const biblioSearch = searchJson['ops:world-patent-data']?.['ops:biblio-search']?.[0];
        const totalCount = parseInt(biblioSearch?.['$']?.['total-result-count'] || "0");
        
        if (totalCount === 0) {
            return { patents: [], count: 0, total_patent_count: 0 };
        }

        const searchResults = biblioSearch?.['ops:search-result']?.[0]?.['ops:publication-reference'];
        if (!searchResults) return { patents: [], count: 0, total_patent_count: totalCount };

        // Construct Format: "docdb.country.number.kind" for batch retrieval
        const docIds = searchResults.map((ref: any) => {
            const doc = ref['document-id'][0];
            const country = doc['country'][0];
            const number = doc['doc-number'][0];
            const kind = doc['kind']?.[0] || '';
            return `${country}.${number}.${kind}`;
        });
        
        // Use all IDs returned by the paged search (max 50)
        const topIds = docIds;

        // Step B: Get Biblio (Title, Assignee, Inventor) AND Abstract
        const batchIds = topIds.join(',');
        const detailUrl = `${EPO_BASE_URL}/published-data/publication/epodoc/${batchIds}/biblio,abstract`;
        
        let exchangeDocs: any[] = [];
        try {
            const detailRes = await axios.get(detailUrl, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/xml' }
            });
            const detailJson = await parseStringPromise(detailRes.data);
            exchangeDocs = detailJson['ops:world-patent-data']?.['exchange-documents']?.[0]?.['exchange-document'] || [];
        } catch (detailError) {
            console.warn("EPO Detail Fetch Partial Fail:", detailError);
        }

        // Step C: Map XML to our Patent Interface
        const detailsMap = new Map<string, any>();
        if (exchangeDocs && exchangeDocs.length > 0) {
            exchangeDocs.forEach((doc: any) => {
                const biblio = doc['bibliographic-data'][0];
                const pubRef = biblio['publication-reference'][0]['document-id'][0];
                const country = pubRef['country'][0];
                const number = pubRef['doc-number'][0];
                const kind = pubRef['kind']?.[0] || '';
                
                const key1 = `${country}.${number}.${kind}`;
                const key2 = `${country}.${number}`; 
                
                detailsMap.set(key1, doc);
                detailsMap.set(key2, doc);
            });
        }

        const patents: Patent[] = topIds.map((idString: string) => {
            const parts = idString.split('.');
            const simpleId = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : idString;
            
            const doc = detailsMap.get(idString) || detailsMap.get(simpleId);
            
            if (doc) {
                const biblio = doc['bibliographic-data'][0];
                const abs = doc['abstract']?.[0]?.['p']?.[0]?.['_'] || doc['abstract']?.[0]?.['p']?.[0] || "No Abstract";
                
                const titleObj = biblio['invention-title']?.find((t: any) => t['$']['lang'] === 'en') || biblio['invention-title']?.[0];
                const title = titleObj ? (titleObj['_'] || titleObj) : "No Title";

                const pubRef = biblio['publication-reference'][0]['document-id'][0];
                const docNumber = `${pubRef['country'][0]}${pubRef['doc-number'][0]}`;
                const dateStr = pubRef['date']?.[0] || ""; 
                const formattedDate = dateStr.length === 8 ? `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}` : dateStr;

                const applicants = biblio['parties']?.[0]?.['applicants']?.[0]?.['applicant'] || [];
                const assignees = applicants.map((app: any) => ({
                    assignee_id: "N/A", 
                    assignee_organization: app['applicant-name']?.[0]?.['name']?.[0] || "Unknown",
                    assignee_country: app['applicant-name']?.[0]?.['$']?.['country']
                }));

                const inventorsList = biblio['parties']?.[0]?.['inventors']?.[0]?.['inventor'] || [];
                const inventors = inventorsList.map((inv: any) => {
                    const fullName = inv['inventor-name']?.[0]?.['name']?.[0] || "Unknown";
                    const parts = fullName.split(' ');
                    return {
                        inventor_id: "N/A",
                        inventor_last_name: parts.pop(),
                        inventor_first_name: parts.join(' ')
                    };
                });

                return {
                    patent_id: docNumber,
                    patent_number: docNumber,
                    patent_title: title,
                    patent_abstract: abs,
                    patent_date: formattedDate,
                    assignees: assignees,
                    inventors: inventors,
                    source: 'EPO'
                };
            } else {
                const cleanNumber = idString.replace(/\./g, ''); 
                return {
                    patent_id: cleanNumber,
                    patent_number: cleanNumber,
                    patent_title: "Title Not Available (Click to view)",
                    patent_abstract: "Detail data not returned by EPO API. Click to view on Espacenet.",
                    patent_date: "N/A",
                    assignees: [{ assignee_id: "na", assignee_organization: "Unknown" }],
                    inventors: [],
                    source: 'EPO'
                };
            }
        });

        return {
            patents: patents,
            count: patents.length,
            total_patent_count: totalCount
        };

    } catch (error: any) {
        console.error("EPO Search Error:", error.response?.data || error.message);
        return { patents: [], count: 0, total_patent_count: 0 };
    }
}