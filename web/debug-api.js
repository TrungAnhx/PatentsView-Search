const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const apiKey = process.env.NEXT_PUBLIC_PATENTSVIEW_API_KEY;
const apiUrl = 'https://search.patentsview.org/api/v1/patent/';

async function debugAPI() {
    console.log("🛠️  Debugging PatentsView Search API (Round 2)...");
    
    // Test 1: POST with JSON Query (Legacy Format on New Endpoint? Unlikely but trying)
    /*
    console.log("\n--- TEST 1: POST Method ---");
    try {
        const response = await axios.post(apiUrl, {
            q: { \"_text_any\": { \"patent_title\": \"camera\" } },
            f: [\"patent_id\", \"patent_title\"]
        }, {
            headers: { \"X-Api-Key\": apiKey, \"Content-Type\": \"application/json\" }
        });
        console.log("POST Success:", response.status);
    } catch (error) {
        console.log("POST Failed:", error.response ? error.response.status : error.message);
    }
    */

    // Test 2: GET with Lucene Syntax specifying field
    // Documentation says default operator is OR.
    // Maybe plain text 'camera' is ambiguous. Let's try 'title:camera'
    console.log("\n--- TEST 2: GET Method with Field Specific Query ---");
    const queryString = 'patent_title:camera';
    console.log(`Query: ${queryString}`);
    
    try {
        const response = await axios.get(apiUrl, {
            params: { q: queryString, size: 5 },
            headers: { "X-Api-Key": apiKey, "Accept": "application/json" }
        });
        console.log("✅ GET Success! Status:", response.status);
        console.log("Results found:", response.data.count);
        if(response.data.patents && response.data.patents.length > 0) {
             console.log("Sample Data:", JSON.stringify(response.data.patents[0], null, 2));
        }
    } catch (error) {
        console.log("GET Failed:", error.response ? error.response.status : error.message);
        if (error.response) console.log("Error Data:", JSON.stringify(error.response.data));
    }

    // Test 3: GET with simple text but fully qualified
    console.log("\n--- TEST 3: GET Method with simple text ---");
    try {
         // Trying with JSON stringified query in GET (Old style)
         const jsonQuery = JSON.stringify({"_text_any": {"patent_title": "camera"}});
         const response = await axios.get(apiUrl, {
            params: { q: jsonQuery }, // Some APIs expect JSON inside 'q' param
            headers: { "X-Api-Key": apiKey }
        });
        console.log("✅ GET (JSON) Success! Status:", response.status);
    } catch (error) {
        console.log("GET (JSON) Failed:", error.response ? error.response.status : error.message);
    }
}

debugAPI();