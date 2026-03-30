// api/history.js - 모든 일기 히스토리 가져오기
import Redis from 'ioredis';

let redis;
if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL);
}

export default async function handler(request, response) {
    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'GET 요청만 허용됩니다.' });
    }

    if (!redis) {
        return response.status(500).json({ error: 'Redis 연결 설정이 되어 있지 않습니다.' });
    }

    try {
        // [1] 'diary-*' 패턴의 모든 키를 가져옵니다.
        const keys = await redis.keys('diary-*');

        if (keys.length === 0) {
            return response.status(200).json({ history: [] });
        }

        // [2] 모든 키의 값을 가져옵니다.
        const dataList = await redis.mget(...keys);

        // [3] JSON 파싱 및 정렬 (최신순)
        const history = dataList
            .map(item => JSON.parse(item))
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        return response.status(200).json({ success: true, history });

    } catch (error) {
        console.error('히스토리 조회 에러:', error);
        return response.status(500).json({ error: '일기 기록을 불러오는 중 오류가 발생했습니다.' });
    }
}
