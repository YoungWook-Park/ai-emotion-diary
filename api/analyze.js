// api/analyze.js (Vercel Serverless Function - 지능형 자동 모델 탐색 버전)

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'POST 요청만 허용됩니다.' });
    }

    try {
        const { diary } = request.body;
        if (!diary) return response.status(400).json({ error: '내용이 없습니다.' });

        const API_KEY = process.env.GEMINI_API_KEY;
        if (!API_KEY) return response.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });

        // 1. 현재 API 키가 이 서버에서 사용할 수 있는 모델 리스트를 먼저 가져옵니다. (진단)
        const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const listData = await listResponse.json();

        if (listData.error) throw new Error(`[API 서버 오류]: ${listData.error.message}`);

        // 2. 가용한 모델 이름만 추출 (예: gemini-1.5-flash 등)
        const availableModels = listData.models.map(m => m.name.split('/').pop());
        
        // 3. 우선순위에 따라 가장 좋은 모델 선정
        const priority = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro', 'gemini-1.0-pro'];
        const targetModel = priority.find(model => availableModels.includes(model)) || availableModels[0];

        if (!targetModel) {
            throw new Error(`사용 가능한 AI 모델이 없습니다. (목록: ${availableModels.join(', ')})`);
        }

        // 4. 결정된 최적의 모델(targetModel)로 분석 요청 수행
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `너는 따뜻한 심리 상담가야. 사용자가 작성한 일기 내용을 읽고, 사용자의 감정을 한 단어로 요약해줘. 그리고 그 감정에 공감해주고, 따뜻한 응원의 메시지를 2~3문장으로 작성해줘. 답변 형식은 반드시 '감정: [요약된 감정] \n\n[응원 메시지]'와 같이 줄바꿈을 포함해서 보내줘. 일기 내용: "${diary}"`
                    }]
                }]
            })
        });

        const data = await geminiResponse.json();
        if (data.error) throw new Error(data.error.message);

        const aiMessage = data.candidates[0].content.parts[0].text;
        
        return response.status(200).json({ success: true, response: aiMessage });

    } catch (error) {
        console.error('서버 분석 에러:', error);
        return response.status(500).json({ error: `[AI 서버 진단 실패]: ${error.message}` });
    }
}
