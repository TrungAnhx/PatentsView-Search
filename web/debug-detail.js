const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const apiKey = process.env.NEXT_PUBLIC_PATENTSVIEW_API_KEY;

// Endpoint chi tiết cho 1 patent cụ thể
// Thử ID: 10000154 (Lấy từ kết quả debug trước)
const patentId = "10000154";
const apiUrl = `https://search.patentsview.org/api/v1/patent/${patentId}/`;

async function debugDetail() {
    console.log(`🕵️‍♂️ Checking details for ID: ${patentId}...`);

    try {
        const response = await axios.get(apiUrl, {
            headers: { "X-Api-Key": apiKey }
        });
        
        console.log("Keys received:", Object.keys(response.data));
        
        if (response.data.patent_abstract || response.data.abstract) {
            console.log("✅ FOUND ABSTRACT:");
            console.log(response.data.patent_abstract || response.data.abstract);
        } else {
            console.log("❌ STILL NO ABSTRACT IN DETAIL VIEW.");
            // Print everything to be sure
             console.log(JSON.stringify(response.data, null, 2));
        }

    } catch (e) { console.error("Detail Request Failed:", e.message); }
}

debugDetail();
