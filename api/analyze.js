// api/analyze.js - 2026년 미래형 모델 완벽 대응 버전
import Redis from 'ioredis';

let redis;
if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL);
}

export default async function handler(request, response) {
    if (request.method !== 'POST') return response.status(405).json({ error: 'POST 전용' });

    try {
        const { diary } = request.body;
        const API_KEY = process.env.GEMINI_API_KEY;

        if (!API_KEY) throw new Error("GEMINI_API_KEY 가 없습니다.");

        // [1] 가용한 모델 목록 가져오기
        const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const listData = await listRes.json();

        if (!listData.models) {
            console.error("📍 목록 조회 실패 원본:", JSON.stringify(listData));
            throw new Error("모델 목록을 불러올 수 없습니다.");
        }

        // [2] 2026년 리스트 기반의 최적 모델 선정 (supportedGenerationMethods 사용)
        const candidates = listData.models
            .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
            .map(m => m.name);
        
        console.log("📍 가용한 미래형 모델들:", candidates);

        // 우선순위: 2.5 Flash -> 2.0 Flash -> 최신 Flash
        const priorities = [
            'models/gemini-2.5-flash',
            'models/gemini-2.0-flash',
            'models/gemini-flash-latest',
            'models/gemini-1.5-flash',
            'models/gemini-pro-latest'
        ];
        
        const targetModel = priorities.find(p => candidates.includes(p)) || candidates[0];

        if (!targetModel) throw new Error("사용 가능한 생성 모델이 없습니다.");

        console.log(`🚀 [자동 선택] ${targetModel} 모델로 분석을 시작합니다!`);

        // [3] 분석 수행
        const analyzeRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${targetModel}:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `너는 따뜻한 심리 상담가야. 사용자가 일기를 읽고 한단어 요약과 따뜻한 응원을 해줘: "${diary}"` }] }]
            })
        });

        const data = await analyzeRes.json();
        if (data.error) throw new Error(data.error.message);

        const aiMessage = data.candidates[0].content.parts[0].text;
        
        // [4] Redis 저장
        if (redis) {
            try {
                const diaryId = `diary-${Date.now()}`;
                await redis.set(diaryId, JSON.stringify({ diary, ai_response: aiMessage, date: new Date().toISOString() }), 'EX', 604800);
                console.log("✅ Redis 저장 완료!");
            } catch (e) { console.error("Redis 저장 실패:", e.message); }
        }

        return response.status(200).json({ success: true, response: aiMessage });

    } catch (error) {
        console.error('🔥 최종 서버 에러:', error.message);
        return response.status(500).json({ error: error.message });
    }
}
