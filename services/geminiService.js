import { GoogleGenAI } from "@google/genai";

export const generatePatientReport = async (patient) => {
  // NOTE: In a real backend architecture, this key should be kept server-side.
  if (!process.env.API_KEY) {
    return "API Key not configured. Please add your key to services/geminiService.js or use Vite.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: "YOUR_ACTUAL_GOOGLE_API_KEY" });
    
    const vitalSummary = `
      Patient Name: ${patient.name}
      Age: ${patient.age}
      Status: ${patient.status}
      Current Vitals:
      - Heart Rate: ${patient.currentVitals.bpm.toFixed(0)} BPM
      - SpO2: ${patient.currentVitals.spo2.toFixed(0)} %
      - Temperature: ${patient.currentVitals.temp.toFixed(1)} C
    `;

    const prompt = `
      Act as a medical AI assistant.
      Analyze the following patient vital signs and status.
      Generate a concise clinical summary report (max 150 words).
      Highlight any potential risks based on the vitals provided.
      
      Data:
      ${vitalSummary}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "No analysis available.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error generating report. Please check API configuration.";
  }
};