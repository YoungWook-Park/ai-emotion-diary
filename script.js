document.addEventListener('DOMContentLoaded', () => {
    // === [보안 업그레이드 완료] 이제 API 키는 프론트엔드에서 아예 사라졌습니다! ===
    
    const diaryContent = document.getElementById('diary-content');
    const voiceBtn = document.getElementById('voice-btn');
    const analyzeBtn = document.getElementById('analyze-btn');
    const aiResponseBox = document.getElementById('ai-response-box');
    const responseText = document.getElementById('response-text');
    const themeToggle = document.getElementById('theme-toggle');

    // [1] 데이터 복구 프로젝트 (LocalStorage 등)
    const savedContent = localStorage.getItem('last_diary_content');
    const savedResponse = localStorage.getItem('last_ai_response');

    if (savedContent) diaryContent.value = savedContent;
    if (savedResponse) {
        responseText.innerText = savedResponse;
        aiResponseBox.classList.add('active');
    }

    // [2] 테마 토글 
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    themeToggle.querySelector('.icon').innerText = currentTheme === 'dark' ? '☀️' : '🌙';

    themeToggle.addEventListener('click', () => {
        let theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        themeToggle.querySelector('.icon').innerText = theme === 'dark' ? '☀️' : '🌙';
    });

    // [3] 음성 인식 설정 (Web Speech API)
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

    // [4] AI 분석하기 (백엔드 서버리스 함수 호출)
    analyzeBtn.addEventListener('click', async () => {
        const text = diaryContent.value.trim();
        if (!text) return alert('기기 내용이 비어 있습니다. 오늘 하루를 들려주세요!');
        
        analyzeBtn.disabled = true;
        analyzeBtn.innerHTML = '<span class="icon spinning">⏳</span> 분석 중...';
        responseText.innerText = 'AI 상담사에게 안전하게 연결 중입니다...';
        aiResponseBox.classList.remove('active');

        try {
            // 이제 구글 API가 아닌 우리가 만든 백엔드 주소(/api/analyze)로 보냅니다!
            const fetchResponse = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ diary: text }) // 데이터 이름은 'diary'로 통일
            });

            const data = await fetchResponse.json();
            
            if (data.error) throw new Error(data.error);

            // 성공 시 AI 답변 가져오기
            const aiMessage = data.response;

            // 로컬 스토리지 한 번 더 백업
            localStorage.setItem('last_diary_content', text);
            localStorage.setItem('last_ai_response', aiMessage);

            // 최종 UI 표시
            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = '<span class="icon">✨</span> 분석하기';
            aiResponseBox.classList.add('active');
            
            responseText.innerText = '';
            typeText(responseText, aiMessage);

        } catch (err) {
            console.error('Frontend Error:', err);
            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = '<span class="icon">✨</span> 분석하기';
            responseText.innerText = `[연결 실패]: ${err.message}\n\n도움말: 백엔드 서버가 켜져 있는지, 로컬 환경이라면 'vercel dev'로 접속 중인지 확인해 주세요.`;
        }
    });

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
