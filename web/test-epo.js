const axios = require('axios');
require('dotenv').config({ path: '.env.local' });
const xml2js = require('xml2js');

const CONSUMER_KEY = process.env.EPO_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.EPO_CONSUMER_SECRET;

async function testEPO() {
    console.log("🛠️ Testing EPO OPS v3.2 Connection...");
    
    if (!CONSUMER_KEY || !CONSUMER_SECRET) {
        console.error("❌ MISSING KEYS: Please add EPO_CONSUMER_KEY and EPO_CONSUMER_SECRET to .env.local");
        return;
    }

    // 1. Get Access Token
    console.log("1️⃣  Authenticating...");
    let accessToken = "";
    try {
        const credentials = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
        const authRes = await axios.post('https://ops.epo.org/3.2/auth/accesstoken', 
            'grant_type=client_credentials', 
            {
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        accessToken = authRes.data.access_token;
        console.log("✅ Auth Success! Token received.");
    } catch (e) {
        console.error("❌ Auth Failed:", e.response ? e.response.data : e.message);
        return;
    }

    // 2. Search for a simple patent (e.g. "plastic")
    console.log("\n2️⃣  Searching for 'plastic'...");
    try {
        const searchUrl = `https://ops.epo.org/3.2/rest-services/published-data/search?q=ti%3Dplastic`;
        const searchRes = await axios.get(searchUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/xml' }
        });
        
        console.log("✅ Search Success! Status:", searchRes.status);
        
        // Parse XML sample
        const parser = new xml2js.Parser();
        parser.parseString(searchRes.data, (err, result) => {
            if (err) console.error("XML Parse Error");
            else {
                const total = result['ops:world-patent-data']['ops:biblio-search'][0]['$']['total-result-count'];
                console.log(`📊 Found ${total} patents.`);
            }
        });

    } catch (e) {
        console.error("❌ Search Failed:", e.response ? e.response.status : e.message);
        if (e.response) console.log(e.response.data);
    }
}

testEPO();
