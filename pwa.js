// PWA Install Logic
let deferredPrompt;
const installAppBtn = document.getElementById('installAppBtn'); // 설정 내 버튼 (레거시 지원)
const showPwaBannerBtn = document.getElementById('showPwaBannerBtn'); // 설정 내 배너 보기 버튼 (레거시 지원)

// iOS 감지
function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// iOS Safari 감지 (다른 브라우저 제외)
function isIOSSafari() {
    const ua = navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isWebkit = /WebKit/.test(ua);
    const isChrome = /CriOS/.test(ua);
    const isFirefox = /FxiOS/.test(ua);
    return isIos && isWebkit && !isChrome && !isFirefox;
}

// PWA가 이미 설치되었는지 확인
function isPwaInstalled() {
    // standalone 모드로 실행 중이면 설치됨
    if (window.matchMedia('(display-mode: standalone)').matches) {
        return true;
    }
    // iOS Safari에서 설치되었는지 확인
    if (window.navigator.standalone === true) {
        return true;
    }
    return false;
}

// 메뉴 탭의 '앱 설치' 카드 클릭 핸들러
window.handlePwaInstallClick = async function () {
    console.log('PWA Install Clicked');

    // 1. 이미 설치된 경우
    if (isPwaInstalled()) {
        showToast('이미 앱이 설치되어 있습니다.');
        return;
    }

    // 2. iOS인 경우 (안내 모달 표시)
    if (isIOS()) {
        const iosModal = document.getElementById('ios-install-modal');
        if (iosModal) {
            iosModal.style.display = 'flex';
            // 모달 테마 색상 적용 (index.js의 onModalOpen 로직과 유사하게 동작하도록)
            if (window.onModalOpen) window.onModalOpen();
        }
        return;
    }

    // 3. Android/Desktop 등 설치 프롬프트가 준비된 경우
    if (deferredPrompt) {
        // Show the install prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        // We've used the prompt, and can't use it again, throw it away
        deferredPrompt = null;
        return;
    }

    // 4. 설치 프롬프트가 없는 경우 (브라우저 미지원 또는 이미 무시함 등)
    // 안내 메시지 표시
    showToast('브라우저 메뉴의 "홈 화면에 추가"를 이용해주세요.', 3000);

    // 추가 안내 (특정 브라우저 이슈 대응)
    setTimeout(() => {
        showToast('설치가 안 된다면 삼성 인터넷 브라우저를 권장합니다.', 4000);
    }, 3500);
};

// iOS 설치 안내 모달 닫기
window.closeIosInstallModal = function () {
    const iosModal = document.getElementById('ios-install-modal');
    if (iosModal) {
        iosModal.style.display = 'none';
        if (window.onModalClose) window.onModalClose();
    }
};

// 설치 프롬프트 이벤트 리스너
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    console.log('beforeinstallprompt fired - Install prompt ready');

    // 메뉴 카드는 항상 표시되므로 별도 UI 업데이트 불필요
});

window.addEventListener('appinstalled', () => {
    // Clear the deferredPrompt so it can be garbage collected
    deferredPrompt = null;
    console.log('PWA was installed');
    showToast('앱이 성공적으로 설치되었습니다!');

    // 설치 완료 후 메뉴 카드 숨기거나 변경 가능 (현재는 유지)
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // 절대 경로 사용 (CloudFront/Nginx 배포 환경 호환)
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }, (err) => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

// 기존 함수 호환성 유지 (오류 방지)
window.updatePwaBannerVisibility = function () { };
