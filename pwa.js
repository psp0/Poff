// PWA Install Logic
let deferredPrompt;
const installAppBtn = document.getElementById('installAppBtn'); // 설정 내 버튼
const showPwaBannerBtn = document.getElementById('showPwaBannerBtn'); // 설정 내 배너 보기 버튼
const pwaBanner = document.getElementById('pwa-install-banner');
const pwaInstallBtn = document.getElementById('pwa-install-btn');
const pwaCloseBtn = document.getElementById('pwa-install-close');
let bannerTimeout = null;

// 홈 탭 활성화 여부 확인
function isHomeTabActive() {
    const homeView = document.getElementById('view-home');
    // 초기 로드 시 active 클래스가 없을 수 있으므로 스타일 체크도 병행하거나,
    // index.js의 초기화 로직을 신뢰. 여기서는 classList를 확인.
    // view-home이 active 클래스를 가지고 있거나, style.display가 block인 경우
    return homeView && (homeView.classList.contains('active') || homeView.style.display === 'block');
}

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

// 배너 표시 (애니메이션)
// 배너 표시 (애니메이션)
function showPwaBanner() {
    if (pwaBanner && !isPwaInstalled()) {
        // 홈 화면이 아니면 표시하지 않음
        if (!isHomeTabActive()) return;

        // 이미 닫았으면 표시 안 함
        if (sessionStorage.getItem('pwa-banner-dismissed') === 'true') {
            return;
        }

        // 이미 표시 대기 중이면 중복 실행 방지
        if (bannerTimeout) clearTimeout(bannerTimeout);

        // 약간의 딜레이 후 배너 표시 (UX 개선)
        bannerTimeout = setTimeout(() => {
            // 타임아웃 후에도 여전히 홈 화면인지 확인
            if (isHomeTabActive()) {
                pwaBanner.classList.remove('hidden');
                pwaBanner.classList.add('visible');
            }
        }, 2000); // 2초 후 표시
    }
}

// iOS용 배너 표시 (설치 방법 안내)
// iOS용 배너 표시 (설치 방법 안내)
function showIOSInstallBanner() {
    if (pwaBanner && !isPwaInstalled() && isIOSSafari()) {
        // 홈 화면이 아니면 표시하지 않음
        if (!isHomeTabActive()) return;

        // 이미 닫았으면 표시 안 함
        if (sessionStorage.getItem('pwa-banner-dismissed') === 'true') {
            return;
        }

        // 이미 표시 대기 중이면 중복 실행 방지
        if (bannerTimeout) clearTimeout(bannerTimeout);

        // iOS용 설치 안내 텍스트로 변경
        const textEl = pwaBanner.querySelector('.pwa-install-text');
        const btnEl = pwaBanner.querySelector('.pwa-install-btn');

        if (textEl) {
            textEl.innerHTML = `
                <strong>PokeHabit 앱 설치(iOS)</strong>
                <span>하단 <svg style="width:16px;height:16px;vertical-align:middle;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg> 공유 버튼 → 홈 화면에 추가</span>
            `;
        }
        if (btnEl) {
            btnEl.style.display = 'none'; // iOS에서는 직접 설치 불가
        }

        bannerTimeout = setTimeout(() => {
            // 타임아웃 후에도 여전히 홈 화면인지 확인
            if (isHomeTabActive()) {
                pwaBanner.classList.remove('hidden');
                pwaBanner.classList.add('visible');
            }
        }, 2000);
    }
}

// 배너 숨기기
function hidePwaBanner() {
    if (bannerTimeout) {
        clearTimeout(bannerTimeout);
        bannerTimeout = null;
    }
    if (pwaBanner) {
        pwaBanner.classList.remove('visible');
        pwaBanner.classList.add('hidden');
    }
}

// 탭 변경 시 호출될 함수 (전역 노출)
window.updatePwaBannerVisibility = function () {
    if (isHomeTabActive()) {
        if (isIOSSafari()) {
            showIOSInstallBanner();
        } else {
            showPwaBanner();
        }
    } else {
        hidePwaBanner();
    }
};

// 설치 프롬프트 실행
async function triggerInstall() {
    if (!deferredPrompt) {
        return;
    }
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    // We've used the prompt, and can't use it again, throw it away
    deferredPrompt = null;
    // Hide both the banner and settings button
    hidePwaBanner();
    if (installAppBtn) {
        installAppBtn.style.display = 'none';
    }
}

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;

    // 설정 내 버튼 표시 (기존 기능 유지)
    if (installAppBtn) {
        installAppBtn.style.display = 'flex';
    }
    if (showPwaBannerBtn) {
        showPwaBannerBtn.style.display = 'flex';
    }

    // 하단 배너 표시
    showPwaBanner();

    console.log('beforeinstallprompt fired');
});

// 설정 내 설치 버튼 클릭
if (installAppBtn) {
    installAppBtn.addEventListener('click', triggerInstall);
}

// 하단 배너 설치 버튼 클릭
if (pwaInstallBtn) {
    pwaInstallBtn.addEventListener('click', triggerInstall);
}

// 설정 내 배너 보기 버튼 클릭
if (showPwaBannerBtn) {
    showPwaBannerBtn.addEventListener('click', () => {
        // 닫기 기록 초기화
        sessionStorage.removeItem('pwa-banner-dismissed');

        // 배너 표시
        if (isIOSSafari()) {
            showIOSInstallBanner();
        } else {
            showPwaBanner();
        }

        // 설정 패널 닫기 (global function assumed)
        if (window.closeSettings) {
            window.closeSettings();
        } else {
            const settingsPanel = document.getElementById('settings-panel');
            if (settingsPanel) {
                settingsPanel.classList.remove('slide-visible');
                settingsPanel.classList.add('slide-hidden');
            }
        }
    });
}

// 배너 닫기 버튼
if (pwaCloseBtn) {
    pwaCloseBtn.addEventListener('click', () => {
        hidePwaBanner();
        // 세션 동안 다시 표시하지 않음 (선택적: localStorage로 영구 저장 가능)
        sessionStorage.setItem('pwa-banner-dismissed', 'true');
    });
}

// 페이지 로드 완료 후 iOS 배너 표시 체크
document.addEventListener('DOMContentLoaded', () => {
    // iOS Safari인 경우 iOS용 배너 표시 (beforeinstallprompt가 발생하지 않으므로)
    if (isIOSSafari() && !isPwaInstalled()) {
        showIOSInstallBanner();
        if (showPwaBannerBtn) {
            showPwaBannerBtn.style.display = 'flex';
        }
    }
});

window.addEventListener('appinstalled', () => {
    // Hide the app-provided install promotion
    hidePwaBanner();
    if (installAppBtn) {
        installAppBtn.style.display = 'none';
    }
    if (showPwaBannerBtn) {
        showPwaBannerBtn.style.display = 'none';
    }
    // Clear the deferredPrompt so it can be garbage collected
    deferredPrompt = null;
    console.log('PWA was installed');
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // 상대 경로 사용하여 배포 환경에 맞게 동작
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }, (err) => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}
