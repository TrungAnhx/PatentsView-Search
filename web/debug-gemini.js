const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const apiKey = process.env.GEMINI_API_KEY;

async function listGeminiModels() {
    console.log("🔍 Checking available Gemini Models for your API Key...");
    
    try {
        // Gọi trực tiếp REST API của Google để liệt kê model
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await axios.get(url);
        
        console.log("✅ Success! Available models:");
        const models = response.data.models || [];
        
        const generateModels = models
            .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"))
            .map(m => m.name); // output: models/gemini-pro, etc.

        if (generateModels.length === 0) {
            console.log("⚠️ No models found that support 'generateContent'.");
        } else {
            generateModels.forEach(name => console.log(` - ${name}`));
        }

    } catch (error) {
        console.error("❌ Failed to list models:");
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error("Data:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
}

listGeminiModels();
