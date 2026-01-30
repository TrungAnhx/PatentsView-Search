const axios = require('axios');
require('dotenv').config({ path: '.env.local' });
const xml2js = require('xml2js');

const CONSUMER_KEY = process.env.EPO_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.EPO_CONSUMER_SECRET;

async function runTest() {
    console.log("🧪 STARTING EPO QUERY LAB...");
    
    // 1. Get Token
    const credentials = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
    const authRes = await axios.post('https://ops.epo.org/3.2/auth/accesstoken', 'grant_type=client_credentials', {
        headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const token = authRes.data.access_token;
    console.log("🔑 Token acquired.\n");

    // 2. Define Candidates
    const candidates = [
        'pa=Apple',                 // 1. Simple
        'pa="Apple"',               // 2. Quoted
        'pa all "Apple"',           // 3. All operator
        'pa any "Apple"',           // 4. Any operator
        'pa="Apple Inc"',           // 5. Specific
        'pa="Apple*"',              // 6. Wildcard inside
        'pa=Apple*',                // 7. Wildcard outside
        'txt="Apple"',              // 8. Text Search (Control Group)
        'ia="Apple"'                // 9. Inventor/Applicant
    ];

    // 3. Run Tests
    for (const q of candidates) {
        try {
            const url = `https://ops.epo.org/3.2/rest-services/published-data/search?q=${encodeURIComponent(q)}`;
            const res = await axios.get(url, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/xml' }
            });
            
            const parser = new xml2js.Parser();
            parser.parseString(res.data, (err, result) => {
                if (!err) {
                    const count = result['ops:world-patent-data']['ops:biblio-search'][0]['$']['total-result-count'];
                    console.log(`Query: [ ${q.padEnd(20)} ] => Count: ${count}`);
                }
            });
        } catch (e) {
            console.log(`Query: [ ${q.padEnd(20)} ] => ERROR: ${e.response ? e.response.status : e.message}`);
        }
        // Small delay to be nice to API
        await new Promise(r => setTimeout(r, 500));
    }
}

runTest();
