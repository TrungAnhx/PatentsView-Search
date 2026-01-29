const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const apiKey = process.env.NEXT_PUBLIC_PATENTSVIEW_API_KEY;

// Thử URL endpoint khác hoặc phương thức GET
// PatentsView document suggests POST /patents/query is legacy but usually works.
// Let's try GET method which is often more stable for simple queries.
const apiUrl = 'https://api.patentsview.org/patents/query';

async function testConnection() {
    console.log("Testing PatentsView API (GET Method)...");
    
    // Query format for GET: ?q={"_text_any":{"patent_title":"Computer"}}
    const query = JSON.stringify({ "_text_any": { "patent_title": "Computer" } });
    const fields = JSON.stringify(["patent_id", "patent_title"]);

    try {
        const response = await axios.get(apiUrl, {
            params: {
                q: query,
                f: fields,
                o: JSON.stringify({ "per_page": 5 })
            },
            headers: {
                "X-Api-Key": apiKey || ""
            }
        });

        console.log("Status:", response.status);
        console.log("Data count:", response.data.count);
        if (response.data.patents && response.data.patents.length > 0) {
            console.log("First patent found:", response.data.patents[0].patent_title);
            console.log("✅ API Connection Successful with GET!");
        }

    } catch (error) {
        console.error("❌ API Request Failed:");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
}

testConnection();