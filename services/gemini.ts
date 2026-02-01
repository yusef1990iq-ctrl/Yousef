
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * وظيفة لتحليل صورة خط اليد واستخراج النصوص الفيزيائية منها
 */
export const analyzeSolutionImage = async (base64Image: string, questionText: string) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/png', data: base64Image } },
        { text: `هذا حل لمسألة فيزياء: "${questionText}". 
        قم باستخراج القوانين والتعويضات والأرقام من خط اليد هذا بدقة. 
        أرجع النص المستخرج فقط بشكل مرتب.` }
      ]
    }
  });
  return response.text;
};

/**
 * وظيفة لتصحيح الحل وتقديم تقييم تفصيلي للخطوات
 */
export const diagnoseSolutionText = async (userAnswer: string, question: any) => {
  // نستخدم pro للمهام المعقدة مثل تصحيح الفيزياء
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `
    إجابة الطالب: "${userAnswer}"
    السؤال: "${question.text}"
    النتائج المطلوبة: "${question.targets}"
    
    المهمة: قم بتقييم حل الطالب. لكل خطوة مطلوبة، حدد ما يلي:
    1. هل استخدم القانون الصحيح؟
    2. هل التعويض الرياضي صحيح؟
    3. هل الناتج النهائي صحيح؟
    
    أرجع النتيجة بصيغة JSON كصفوف مصفوفة:
    [{ "title": "اسم الخطوة", "isLawFound": boolean, "isSubCorrect": boolean, "isResCorrect": boolean, "feedback": "ملاحظة قصيرة بالعربي" }]
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            isLawFound: { type: Type.BOOLEAN },
            isSubCorrect: { type: Type.BOOLEAN },
            isResCorrect: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING }
          },
          required: ["title", "isLawFound", "isSubCorrect", "isResCorrect", "feedback"]
        }
      }
    }
  });
  
  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("JSON Parsing Error", e);
    return null;
  }
};
