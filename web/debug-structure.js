const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const apiKey = process.env.NEXT_PUBLIC_PATENTSVIEW_API_KEY;
const apiUrl = 'https://search.patentsview.org/api/v1/patent/';

async function debugDataStructure() {
    console.log("🔍 Inspecting API Response Structure...");
    
    // Query that worked previously
    const jsonQuery = JSON.stringify({"_text_any": {"patent_title": "camera"}});

    try {
        const response = await axios.get(apiUrl, {
            params: { 
                q: jsonQuery,
                size: 1 
                // Not specifying 'include' to see ALL available fields by default
            }, 
            headers: { "X-Api-Key": apiKey, "Accept": "application/json" }
        });

        if (response.data.patents && response.data.patents.length > 0) {
            console.log("✅ DATA RECEIVED. Here is the exact structure of one patent:");
            console.log(JSON.stringify(response.data.patents[0], null, 2));
        } else {
            console.log("⚠️ No patents found to inspect.");
        }

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

debugDataStructure();
