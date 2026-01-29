const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const apiKey = process.env.NEXT_PUBLIC_PATENTSVIEW_API_KEY;
const apiUrl = 'https://search.patentsview.org/api/v1/patent/';

async function debugAbstract() {
    console.log("🕵️‍♂️ Hunting for the missing Abstract...");

    const query = JSON.stringify({ "_text_any": { "patent_title": "camera" } });

    // TEST 1: Request specific fields including 'patent_abstract' and 'abstract'
    console.log("\n--- TEST 1: Explicit Include ---");
    try {
        const response = await axios.get(apiUrl, {
            params: { 
                q: query, 
                size: 1,
                include: "patent_id,patent_title,patent_abstract,abstract" // Asking for both
            },
            headers: { "X-Api-Key": apiKey }
        });
        const p = response.data.patents[0];
        console.log("Keys received:", Object.keys(p));
        console.log("patent_abstract:", p.patent_abstract ? "FOUND" : "MISSING");
        console.log("abstract:", p.abstract ? "FOUND" : "MISSING");
    } catch (e) { console.error("Test 1 Failed:", e.message); }

    // TEST 2: NO include parameter (Fetch ALL fields)
    console.log("\n--- TEST 2: Fetch ALL Fields (No include param) ---");
    try {
        const response = await axios.get(apiUrl, {
            params: { q: query, size: 1 },
            headers: { "X-Api-Key": apiKey }
        });
        const p = response.data.patents[0];
        console.log("Keys received:", Object.keys(p));
        
        // Loop through to find anything that looks like text
        console.log("Checking for text content...");
        for (const key in p) {
            if (typeof p[key] === 'string' && p[key].length > 50) {
                console.log(`Potential candidate [${key}]: ${p[key].substring(0, 30)}...`);
            }
        }
    } catch (e) { console.error("Test 2 Failed:", e.message); }
}

debugAbstract();
