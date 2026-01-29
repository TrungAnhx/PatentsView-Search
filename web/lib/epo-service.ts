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
export async function searchEPO(cqlQuery: string): Promise<PatentsViewResponse> {
    try {
        const token = await getAccessToken();
        
        // Step A: Search to get List of IDs
        const searchUrl = `${EPO_BASE_URL}/published-data/search?q=${encodeURIComponent(cqlQuery)}`;
        const searchRes = await axios.get(searchUrl, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/xml' }
        });

        const searchJson = await parseStringPromise(searchRes.data);
        
        // Extract Doc Numbers
        // Structure: <ops:world-patent-data> ... <ops:biblio-search> ... <ops:search-result> ... <ops:publication-reference>
        const biblioSearch = searchJson['ops:world-patent-data']?.['ops:biblio-search']?.[0];
        const totalCount = parseInt(biblioSearch?.['$']?.['total-result-count'] || "0");
        
        if (totalCount === 0) {
            return { patents: [], count: 0, total_patent_count: 0 };
        }

        const searchResults = biblioSearch?.['ops:search-result']?.[0]?.['ops:publication-reference'];
        if (!searchResults) return { patents: [], count: 0, total_patent_count: totalCount };

        // Construct Format: "docdb.country.number.kind" for batch retrieval
        // Example: EP.1000.A1
        const docIds = searchResults.map((ref: any) => {
            const doc = ref['document-id'][0];
            const country = doc['country'][0];
            const number = doc['doc-number'][0];
            const kind = doc['kind']?.[0] || '';
            return `${country}.${number}.${kind}`;
        }); // Take first 10-20 IDs usually. EPO limits batch size.
        
        // Limit to top 10 for detailed retrieval (EPO limit is strict)
        const topIds = docIds.slice(0, 10);

        // Step B: Get Biblio (Title, Assignee, Inventor) AND Abstract
        // Batch URL: published-data/publication/epodoc/{ids}/biblio,abstract
        const batchIds = topIds.join(',');
        const detailUrl = `${EPO_BASE_URL}/published-data/publication/epodoc/${batchIds}/biblio,abstract`;
        
        const detailRes = await axios.get(detailUrl, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/xml' }
        });
        
        const detailJson = await parseStringPromise(detailRes.data);
        const exchangeDocs = detailJson['ops:world-patent-data']?.['exchange-documents']?.[0]?.['exchange-document'];

        // Step C: Map XML to our Patent Interface
        const patents: Patent[] = exchangeDocs.map((doc: any) => {
            const biblio = doc['bibliographic-data'][0];
            const abs = doc['abstract']?.[0]?.['p']?.[0]?.['_'] || doc['abstract']?.[0]?.['p']?.[0] || "No Abstract";
            
            // Title
            const titleObj = biblio['invention-title']?.find((t: any) => t['$']['lang'] === 'en') || biblio['invention-title']?.[0];
            const title = titleObj ? (titleObj['_'] || titleObj) : "No Title";

            // ID / Number
            const pubRef = biblio['publication-reference'][0]['document-id'][0];
            const docNumber = `${pubRef['country'][0]}${pubRef['doc-number'][0]}`;
            const dateStr = pubRef['date'][0]; // YYYYMMDD
            const formattedDate = `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}`;

            // Assignees
            const applicants = biblio['parties']?.[0]?.['applicants']?.[0]?.['applicant'] || [];
            const assignees = applicants.map((app: any) => ({
                assignee_id: "N/A", // EPO doesn't give UUIDs
                assignee_organization: app['applicant-name']?.[0]?.['name']?.[0] || "Unknown",
                assignee_country: app['applicant-name']?.[0]?.['$']?.['country'] // Often in attribute
            }));

            // Inventors
            const inventorsList = biblio['parties']?.[0]?.['inventors']?.[0]?.['inventor'] || [];
            const inventors = inventorsList.map((inv: any) => {
                const fullName = inv['inventor-name']?.[0]?.['name']?.[0] || "Unknown";
                // Simple split for first/last
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
                inventors: inventors
            };
        });

        return {
            patents: patents,
            count: patents.length,
            total_patent_count: totalCount
        };

    } catch (error: any) {
        console.error("EPO Search Error:", error.response?.data || error.message);
        // Don't crash app, return empty
        return { patents: [], count: 0, total_patent_count: 0 };
    }
}
