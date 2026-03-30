document.addEventListener('DOMContentLoaded', () => {
    const diaryContent = document.getElementById('diary-content');
    const voiceBtn = document.getElementById('voice-btn');
    const analyzeBtn = document.getElementById('analyze-btn');
    const aiResponseBox = document.getElementById('ai-response-box');
    const responseText = document.getElementById('response-text');
    const themeToggle = document.getElementById('theme-toggle');
    const historyList = document.getElementById('history-list');

    // [1] 데이터 복구 프로젝트
    const savedContent = localStorage.getItem('last_diary_content');
    const savedResponse = localStorage.getItem('last_ai_response');
    if (savedContent) diaryContent.value = savedContent;
    if (savedResponse) {
        responseText.innerText = savedResponse;
        aiResponseBox.classList.add('active');
    }

    // [2] 초기화: 히스토리 불러오기
    loadHistory();

    // [3] 테마 토글
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    themeToggle.querySelector('.icon').innerText = currentTheme === 'dark' ? '☀️' : '🌙';

    themeToggle.addEventListener('click', () => {
        let theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        themeToggle.querySelector('.icon').innerText = theme === 'dark' ? '☀️' : '🌙';
    });

    // [4] 음성 인식 설정
    let recognition = null;
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'ko-KR';
        recognition.interimResults = false;
        recognition.onstart = () => {
            voiceBtn.innerHTML = '<span class="icon">🔴</span> 음성 인식 중...';
            voiceBtn.style.color = '#ef4444';
            voiceBtn.setAttribute('data-recording', 'true');
        };
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            diaryContent.value += (diaryContent.value ? ' ' : '') + transcript;
        };
        recognition.onend = () => {
            voiceBtn.innerHTML = '<span class="icon">🎙️</span> 음성으로 입력하기';
            voiceBtn.style.removeProperty('color');
            voiceBtn.removeAttribute('data-recording');
        };
    }
    voiceBtn.addEventListener('click', () => {
        if (!recognition) return alert('마이크를 지원하지 않는 브라우저입니다.');
        if (voiceBtn.getAttribute('data-recording') === 'true') {
            recognition.stop();
        } else {
            recognition.start();
        }
    });

    // [5] AI 분석하기
    analyzeBtn.addEventListener('click', async () => {
        const text = diaryContent.value.trim();
        if (!text) return alert('기록할 내용이 없습니다!');
        
        analyzeBtn.disabled = true;
        analyzeBtn.innerHTML = '<span class="icon spinning">⏳</span> 분석 중...';
        responseText.innerText = 'AI 상담사가 당신의 이야기를 듣고 있습니다...';
        aiResponseBox.classList.remove('active');

        try {
            const fetchResponse = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ diary: text })
            });
            const data = await fetchResponse.json();
            if (data.error) throw new Error(data.error);

            const aiMessage = data.response;
            localStorage.setItem('last_diary_content', text);
            localStorage.setItem('last_ai_response', aiMessage);

            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = '<span class="icon">✨</span> 분석하기';
            aiResponseBox.classList.add('active');
            
            responseText.innerText = '';
            typeText(responseText, aiMessage);

            // 중요: 분석 성공 후 히스토리 즉시 갱신
            setTimeout(loadHistory, 1000); 

        } catch (err) {
            console.error('Error:', err);
            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = '<span class="icon">✨</span> 분석하기';
            responseText.innerText = `[연결 실패]: ${err.message}`;
        }
    });

    // [6] 히스토리 불러오기 함수
    async function loadHistory() {
        try {
            const res = await fetch('/api/history');
            const data = await res.json();
            
            if (data.history && data.history.length > 0) {
                historyList.innerHTML = ''; // 비우기
                data.history.forEach(item => {
                    const dateStr = new Date(item.date).toLocaleString('ko-KR', {
                        year: 'numeric', month: 'long', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                    });
                    
                    const card = document.createElement('div');
                    card.className = 'history-card';
                    card.innerHTML = `
                        <div class="card-header">
                            <span class="card-date">📅 ${dateStr}</span>
                        </div>
                        <div class="card-diary">${item.diary}</div>
                        <div class="card-ai">${item.ai_response}</div>
                    `;
                    historyList.appendChild(card);
                });
            }
        } catch (err) {
            console.error('History Error:', err);
        }
    }

    function typeText(element, text) {
        let index = 0;
        const interval = setInterval(() => {
            if (index < text.length) {
                element.innerText += text.charAt(index);
                index++;
            } else {
                clearInterval(interval);
            }
        }, 30);
    }
});

const style = document.createElement('style');
style.innerHTML = `
@keyframes spinning { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.spinning { display: inline-block; animation: spinning 1s linear infinite; }
`;
document.head.appendChild(style);
